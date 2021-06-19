import { Room } from './Room.ts';

export const MAX_SPEED = 2.;
export const MAX_STEER = Math.PI;

export class State {
    x = 0;
    y = 0;
    heading = 0;
}

export interface StateWithCostSerialized {
    x: number;
    y: number;
    heading: number;
    cost: number;
    speed: number;
}
export class StateWithCost extends State {
    id = 0;
    cost = 0;
    steer = 0;
    speed = 1;
    from: StateWithCost | null = null;
    to: StateWithCost[] = [];
    constructor(state: State, cost: number, steer: number, speed: number){
        super();
        this.x = state.x;
        this.y = state.y;
        this.heading = state.heading;
        this.cost = cost;
        this.steer = steer;
        this.speed = speed;
        this.from = null;
    }

    /// Serialize this object in a form suitable for transferring among web workers
    serialize(): StateWithCostSerialized {
        return {
            x: this.x,
            y: this.y,
            heading: this.heading,
            speed: this.speed,
            cost: this.cost,
        }
    }

    static deserialize(data: StateWithCostSerialized) {
        const ret = new StateWithCost(data, data.cost, 0, data.speed);
        return ret;
    }
}

export const distRadius = 10;
export const distThreshold = distRadius * distRadius;
export const wrapAngle = (x: number) => x - Math.floor((x + Math.PI) / (2 * Math.PI)) * (2 * Math.PI);
export const compareState = (s1: State, s2: State) => {
    let deltaAngle = wrapAngle(s1.heading - s2.heading);
    return compareDistance(s1, s2) && Math.abs(deltaAngle) < Math.PI / 4.;
}
export function compareDistance(s1: State, s2: State, threshold: number = distThreshold){
    const deltaX = s1.x - s2.x;
    const deltaY = s1.y - s2.y;
    return deltaX * deltaX + deltaY * deltaY < threshold;
}


export class Car{
    x = 100;
    y = 100;
    angle = 0;
    steer = 0;
    desiredSteer = 0;
    speed = 0;
    desiredSpeed = 0;
    auto: boolean = true;
    goal: State | null = null;
    path: StateWithCost[] | null = null;
    searchState?: {
        searchTree: StateWithCost[],
        treeSize: number,
        start: State,
        goal: State,
    };

    copyFrom(other: any){
        if(this.goal && (this.goal.x !== other.goal.x || this.goal.y !== other.goal.y || this.goal.heading !== other.goal.heading)){
            this.path = null;
        }

        for(var property in this) {
            if(property !== "searchState" && property !== "path")
                this[property] = other[property];
        }
    }

    move(x: number, y: number) {
        this.desiredSpeed = Math.min(MAX_SPEED, Math.max(-MAX_SPEED, this.desiredSpeed + x));
    }

    moveSteer(steer: number){
        this.desiredSteer = steer;
    }

    private stepMove(px: number, py: number, heading: number, steer: number, speed?: number, deltaTime: number = 1): State {
        speed ??= this.speed;
        const [x, y] = [speed * deltaTime, 0];
        heading = heading + Math.max(-1, Math.min(1, steer)) * x * 0.01 * MAX_STEER;
        const dx = Math.cos(heading) * x - Math.sin(heading) * y + px;
        const dy = Math.sin(heading) * x + Math.cos(heading) * y + py;
        return {x: dx, y: dy, heading};
    }

    nextRelativeAngle(){
        if(!this.path || this.path.length === 0)
            return 0;
        const nextNode = this.path[this.path.length-1];
        return Math.atan2(nextNode.y - this.y, nextNode.x - this.x);
    }

    step(width: number, height: number, room: Room, deltaTime: number = 1){
        if(this.auto){
            const thisState = {x: this.x, y: this.y, heading: this.angle};
            if(this.goal && this.path && !compareState(this.goal, thisState)){
                const nextNode = 1 < this.path.length ? this.path[this.path.length - 1] : {...this.goal, steer: this.steer, speed: this.speed};
                if(compareState(nextNode, thisState))
                    this.path.pop();
                const [dx, dy] = [this.goal.x - this.x, this.goal.y - this.y];
                if(Math.abs(wrapAngle(this.goal.heading - this.angle)) < Math.PI / 4.)
                    this.desiredSpeed = Math.sign(nextNode.speed) * Math.min(1, Math.max(0, (Math.sqrt(dx * dx + dy * dy) - distRadius) / 50));
                else
                    this.desiredSpeed = Math.sign(nextNode.speed);
                const relativeAngle = Math.atan2(nextNode.y - this.y, nextNode.x - this.x);
                this.desiredSteer = Math.max(-1, Math.min(1, wrapAngle(relativeAngle - this.angle)));
            }
            else{
                this.desiredSpeed = 0.;
            }
        }
        this.speed = this.desiredSpeed < this.speed ?
            Math.max(this.desiredSpeed, this.speed - Math.PI) : Math.min(this.desiredSpeed, this.speed + Math.PI);
        const STEER_SPEED = 0.1;
        this.steer = Math.abs(this.steer - this.desiredSteer) < deltaTime * STEER_SPEED ? this.desiredSteer
            : this.steer < this.desiredSteer ? this.steer + deltaTime * STEER_SPEED
            : this.steer - deltaTime * STEER_SPEED;
        const {x: dx, y: dy, heading} = this.stepMove(this.x, this.y, this.angle, this.steer);
        if(0 < dx && dx < width && 0 < dy && dy < height && !room.checkHit({x: dx, y: dy})){
            this.x = dx;
            this.y = dy;
            this.angle = heading;
        }
        else{
            this.speed = 0;
        }
    }

    prediction() {
        let [x, y, heading] = [this.x, this.y, this.angle];
        const ret = [];
        for(let t = 0; t < 10; t++){
            ret.push([x, y, heading]);
            ({x, y, heading} = this.stepMove(x, y, heading, this.steer, undefined, 2));
        }
        return ret;
    }

    /// RRT* search
    search(depth: number = 3, room: Room, callback: (prevPos: StateWithCost, nextPos: StateWithCost) => void, switchBack: boolean = false){
        const interpolate = (start: State, steer: number, distance: number, fn: (state: State) => boolean) => {
            const INTERPOLATE_INTERVAL = 10.;
            const interpolates = Math.floor(Math.abs(distance) / INTERPOLATE_INTERVAL);
            for(let i = 0; i < interpolates; i++){
                let next = this.stepMove(start.x, start.y, start.heading, steer, 1, Math.sign(distance) * i * INTERPOLATE_INTERVAL);
                if(fn(next))
                    return true;
            }
            return false;
        };
        const nodes: StateWithCost[] = [];
        const edges: [StateWithCost, StateWithCost][] = [];
        let skippedNodes = 0;

        const checkGoal = (node: StateWithCost) => {
            if(this.goal && compareState(node, this.goal)){
                this.path = [];
                for(; node.from; node = node.from)
                    this.path.push(node);
                return true;
            }
            return false;
        };

        const search = (start: StateWithCost, depth: number, direction: number, expandStates = 1) => {
            if(depth < 1 || 10000 < nodes.length)
                return;
            if(checkGoal(start))
                return;
            for(let i = 0; i <= expandStates; i++){
                let {x, y, heading} = start;
                let steer = Math.random() - 0.5;
                let changeDirection = switchBack && Math.random() < 0.2;
                const nextDirection = changeDirection ? -direction : direction;
                let distance = 10 + Math.random() * 50;
                let next = this.stepMove(x, y, heading, steer, 1, nextDirection * distance);
                const hit = interpolate(start, steer, nextDirection * distance, (state) =>
                    0 <= state.x && state.x < room.width &&
                    0 <= state.y && state.y < room.height &&
                    room.checkHit({x: state.x, y: state.y}) !== null);
                if(hit)
                    continue;
                // Changing direction costs
                let node = new StateWithCost(next, start.cost + distance + (changeDirection ? 1000 : 0), steer, nextDirection);
                let foundNode = null;
                let skip = false;
                for(let existingNode of nodes){
                    if(compareState(existingNode, node)){
                        if(existingNode !== start && existingNode.from !== start && start.to.indexOf(existingNode) < 0){
                            if(existingNode.cost > node.cost &&
                                interpolate(start, steer, nextDirection * distance, (state) =>
                                    0 <= state.x && state.x < room.width &&
                                    0 <= state.y && state.y < room.height &&
                                    room.checkHit({x: state.x, y: state.y}) !== null))
                            {
                                existingNode.cost = node.cost;
                                const toIndex = existingNode.from?.to.indexOf(existingNode);
                                console.log(`toIndex: ${toIndex}`)
                                if(toIndex !== undefined && 0 <= toIndex)
                                    existingNode.from?.to.splice(toIndex, 1);
                                else{
                                    return;
                                    throw "Shouldn't happen";
                                }
                                existingNode.from = start;
                                start.to.push(existingNode);
                                existingNode.x = node.x;
                                existingNode.y = node.y;
                                existingNode.heading = node.heading;
                            }
                            foundNode = existingNode;
                            break;
                        }
                        else
                        {
                            skip = true;
                        }
                    }
                }
                if(skip)
                    continue;
                if(!foundNode){
                    node.from = start;
                    start.to.push(node);
                    nodes.push(node);
                    // callback(start, node);
                    search(node, depth - 1, nextDirection, expandStates);
                }
                else{
                    skippedNodes++;
                }
            }
        };

        if(this.searchState &&
            compareDistance({x: this.x, y: this.y, heading: this.angle}, this.searchState.start, distThreshold * 100.) &&
            this.goal && compareDistance(this.goal, this.searchState.goal))
        {
            const enumTree = (root: StateWithCost) => {
                nodes.push(root);
                for(let node of root.to){
                    enumTree(node);
                }
            };
            for(let root of this.searchState.searchTree)
                enumTree(root);
            const traceTree = (root: StateWithCost, depth: number = 1, expandDepth = 1) => {
                if(depth < 1)
                    return;
                if(!root || checkGoal(root))
                    return;
                if(switchBack || -0.1 < root.speed)
                    search(root, expandDepth, 1, 1);
                if(switchBack || root.speed < 0.1)
                    search(root, expandDepth, -1, 1);
                if(0 < root.to.length){
                    for(let i = 0; i < 2; i++){
                        const idx = Math.floor(Math.random() * root.to.length);
                        traceTree(root.to[idx], depth - 1, expandDepth);
                    }
                }
                // nodes.push(root);
                if(this.searchState)
                    this.searchState.treeSize++;
            };
            const treeSize = this.searchState.treeSize;
            this.searchState.treeSize = 0;
            // nodes.push(this.searchState.searchTree);
            for(let root of this.searchState.searchTree)
                traceTree(root, 10, treeSize < 5000 ? 1 : 0);
            this.searchState.goal = this.goal;
        }
        else if(this.goal){
            let roots = [];
            if(switchBack || -0.1 < this.speed){
                const root = new StateWithCost({x: this.x, y: this.y, heading: this.angle}, 0, 0, 1);
                nodes.push(root);
                search(root, depth, 1);
                roots.push(root);
            }
            if(switchBack || this.speed < 0.1){
                const root = new StateWithCost({x: this.x, y: this.y, heading: this.angle}, 0, 0, -1);
                nodes.push(root);
                search(root, depth, -1);
                roots.push(root);
            }
            if(roots){
                if(this.searchState){
                    this.searchState.searchTree = roots;
                    this.searchState.start = {x: this.x, y: this.y, heading: this.angle};
                    this.searchState.goal = this.goal;
                }
                else{
                    this.searchState = {
                        searchTree: roots,
                        treeSize: 0,
                        start: {x: this.x, y: this.y, heading: this.angle},
                        goal: this.goal,
                    };
                }
            }
        }
        this.path?.forEach(node => {
            if(nodes.indexOf(node) < 0)
                nodes.push(node);
        });
        nodes.forEach((node, index) => node.id = index);
        const connections: [number, number][] = [];
        nodes.forEach((node, index) => {
            if(node.from){
                callback(node.from, node);
                if(!(node.from.id < nodes.length)) throw `No node id for from: ${node.from.id}`;
                if(!(node.id < nodes.length)) throw `No node id for to: ${node.id}`;
                connections.push([node.from.id, node.id]);
            }
        })
        const nodeBuffer = new Float32Array(nodes.length * 5);
        nodes.forEach((node, i) => {
            nodeBuffer[i * 5] = node.x;
            nodeBuffer[i * 5 + 1] = node.y;
            nodeBuffer[i * 5 + 2] = node.heading;
            nodeBuffer[i * 5 + 3] = node.cost;
            nodeBuffer[i * 5 + 4] = node.speed;
        });

        // validate
        for(let con of connections){
            if(!(con[0] < nodes.length)) throw `No node id for from: ${con}`;
            if(!(con[1] < nodes.length)) throw `No node id for to: ${con}`;
        }
        return {
            skippedNodes,
            nodes: nodeBuffer.buffer,
            path: this.path?.map(node => node.id),
        };
    }
}
