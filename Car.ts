import { Room } from './Room.ts';

export const MAX_SPEED = 2.;
export const MAX_STEER = Math.PI;

export class State {
    x = 0;
    y = 0;
    heading = 0;
}

export class StateWithCost extends State {
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
        searchTree: StateWithCost,
        treeSize: number,
        goal: State,
    };

    copyFrom(other: any){
        for(var property in this) {
            if(property !== "searchState")
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
        let nodes: StateWithCost[] = [];
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

        const search = (start: StateWithCost, depth: number, direction: number, expandStates = 2) => {
            if(depth < 1)
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
                let hit = interpolate(start, steer, nextDirection * distance, (state) => 0 <= state.x && state.x < room.width &&
                    0 <= state.y && state.y < room.height &&
                    room.checkHit({x: state.x, y: state.y}) !== null);
                if(!hit){
                    // Changing direction costs
                    let node = new StateWithCost(next, start.cost + distance + (changeDirection ? 1000 : 0), steer, nextDirection);
                    let foundNode = null;
                    for(let existingNode of nodes){
                        if(compareState(existingNode, node)){
                            if(existingNode.cost > node.cost){
                                existingNode.cost = node.cost;
                                existingNode.from = start;
                            }
                            foundNode = existingNode;
                            break;
                        }
                    }
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
            }
        };

        if(this.searchState &&
            compareDistance({x: this.x, y: this.y, heading: this.angle}, this.searchState.searchTree, distThreshold * 10.) &&
            this.goal && !compareDistance(this.goal, this.searchState.goal)){
            const traceTree = (root: StateWithCost, depth: number = 1, expandDepth = 1) => {
                if(depth < 1)
                    return;
                if(checkGoal(root))
                    return;
                if(switchBack || -0.1 < this.speed)
                    search(root, expandDepth, 1, 1);
                if(switchBack || this.speed < 0.1)
                    search(root, expandDepth, -1, 1);
                for(let node of root.to){
                    traceTree(node, depth  - 1, expandDepth);
                }
                nodes.push(root);
                if(this.searchState)
                    this.searchState.treeSize++;
            };
            const treeSize = this.searchState.treeSize;
            this.searchState.treeSize = 0;
            traceTree(this.searchState.searchTree, 30, treeSize < 5000 ? 1 : 0);
        }
        else if(this.goal){
            if(switchBack || -0.1 < this.speed){
                const root = new StateWithCost({x: this.x, y: this.y, heading: this.angle}, 0, 0, 1);
                search(root, depth, 1);
                this.searchState = {
                    searchTree: root,
                    treeSize: 0,
                    goal: this.goal,
                };
            }
            if(switchBack || this.speed < 0.1){
                const root = new StateWithCost({x: this.x, y: this.y, heading: this.angle}, 0, 0, -1);
                search(root, depth, -1);
                this.searchState = {
                    searchTree: root,
                    treeSize: 0,
                    goal: this.goal,
                };
            }
        }
        nodes.forEach(node => {
            if(node.from)
                callback(node.from, node);
        })
        return skippedNodes;
    }
}
