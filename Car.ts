import { Room } from './Room.ts';

export const MAX_SPEED = 2.;


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
    let deltaX = s1.x - s2.x;
    let deltaY = s1.y - s2.y;
    let deltaAngle = wrapAngle(s1.heading - s2.heading);
    return deltaX * deltaX + deltaY * deltaY < distThreshold && Math.abs(deltaAngle) < Math.PI / 4.;
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

    renderFrame(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, drawDirection: boolean = false){
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.rect(-10, -5, 20, 10);
        ctx.stroke();
        if(drawDirection){
            ctx.beginPath();
            ctx.moveTo(5, -3);
            ctx.lineTo(5, 3);
            ctx.lineTo(9, 0);
            ctx.closePath();
            ctx.stroke();
        }
        ctx.restore();
    }

    render(ctx: CanvasRenderingContext2D){
        ctx.strokeStyle = "#0f0";
        this.prediction().forEach(([x, y, angle]) => this.renderFrame(ctx, x, y, angle));
        ctx.strokeStyle = "#000";
        this.renderFrame(ctx, this.x, this.y, this.angle, true);
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
        heading = heading + steer * x * 0.01 * Math.PI;
        const dx = Math.cos(heading) * x - Math.sin(heading) * y + px;
        const dy = Math.sin(heading) * x + Math.cos(heading) * y + py;
        return {x: dx, y: dy, heading};
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
                this.desiredSteer = nextNode.steer;
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
    search(depth: number = 3, room: Room, callback: (prevPos: StateWithCost, nextPos: StateWithCost) => void){
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

        const search = (start: StateWithCost, depth: number, direction: number) => {
            if(depth < 1)
                return;
            if(this.goal && compareState(start, this.goal)){
                this.path = [];
                for(let node = start; start.from; start = start.from)
                    this.path.push(start);
                return;
            }
            for(let i = 0; i <= 5; i++){
                let {x, y, heading} = start;
                let steer = Math.random() - 0.5;
                let distance = 10 + Math.random() * 50;
                let next = this.stepMove(x, y, heading, steer, 1, direction * distance);
                let hit = interpolate(start, steer, direction * distance, (state) => 0 <= state.x && state.x < room.width &&
                    0 <= state.y && state.y < room.height &&
                    room.checkHit({x: state.x, y: state.y}) !== null);
                if(!hit){
                    let node = new StateWithCost(next, start.cost + distance, steer, direction);
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
                        nodes.push(node);
                        // callback(start, node);
                        search(node, depth - 1, direction);
                    }
                    else{
                        skippedNodes++;
                    }
                }
            }
        };
        if(-0.1 < this.speed)
            search(new StateWithCost({x: this.x, y: this.y, heading: this.angle}, 0, 0, 1), depth, 1);
        if(this.speed < 0.1)
            search(new StateWithCost({x: this.x, y: this.y, heading: this.angle}, 0, 0, -1), depth, -1);
        nodes.forEach(node => {
            if(node.from)
                callback(node.from, node);
        })
        return skippedNodes;
    }
}
