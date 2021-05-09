const MAX_SPEED = 2.;

class Car{
    x = 100;
    y = 100;
    angle = 0;
    steer = 0;
    desiredSteer = 0;
    speed = 0;

    renderFrame(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number){
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.rect(-10, -5, 20, 10);
        ctx.stroke();
        ctx.restore();
    }

    render(ctx: CanvasRenderingContext2D){
        ctx.strokeStyle = "#0f0";
        this.prediction().forEach(([x, y, angle]) => this.renderFrame(ctx, x, y, angle));
        ctx.strokeStyle = "#000";
        this.renderFrame(ctx, this.x, this.y, this.angle);
    }

    move(x: number, y: number) {
        this.speed = Math.min(MAX_SPEED, Math.max(-MAX_SPEED, this.speed + x));
    }

    moveSteer(steer: number){
        this.desiredSteer = steer;
    }

    private stepMove(px: number, py: number, angle: number, steer: number, speed?: number, deltaTime: number = 1): [number, number, number] {
        speed ??= this.speed;
        const [x, y] = [speed * deltaTime, 0];
        angle = angle + steer * x * 0.01 * Math.PI;
        const dx = Math.cos(angle) * x - Math.sin(angle) * y + px;
        const dy = Math.sin(angle) * x + Math.cos(angle) * y + py;
        return [dx, dy, angle];
    }

    step(width: number, height: number, room: Room, deltaTime: number = 1){
        this.speed = 0 < this.speed ? Math.max(0, this.speed - 0.01) : Math.min(0, this.speed + 0.01);
        const STEER_SPEED = 0.1;
        this.steer = Math.abs(this.steer - this.desiredSteer) < deltaTime * STEER_SPEED ? this.desiredSteer
            : this.steer < this.desiredSteer ? this.steer + deltaTime * STEER_SPEED
            : this.steer - deltaTime * STEER_SPEED;
        const [dx, dy, angle] = this.stepMove(this.x, this.y, this.angle, this.steer);
        if(0 < dx && dx < width && 0 < dy && dy < height && !room.checkHit({x: dx, y: dy})){
            this.x = dx;
            this.y = dy;
            this.angle = angle;
        }
        else{
            this.speed = 0;
        }
    }

    prediction() {
        let [x, y, angle] = [this.x, this.y, this.angle];
        const ret = [];
        for(let t = 0; t < 10; t++){
            ret.push([x, y, angle]);
            [x, y, angle] = this.stepMove(x, y, angle, this.steer, undefined, 2);
        }
        return ret;
    }

    search(depth: number = 3, room: Room, callback: (prevPos: number[], nextPos: number[]) => void){
        const search = (start: [number, number, number], depth: number) => {
            if(depth < 1)
                return;
            for(let i = -1; i <= 1; i++){
                let [x, y, angle] = [start[0], start[1], start[2]];
                let next = this.stepMove(x, y, angle, 1. * i, 1, 20);
                if(room.checkHit({x, y}) === null){
                    callback([x, y, angle], next);
                    search(next, depth - 1);
                }
            }
        };
        search(
            [this.x, this.y, this.angle], depth);
    }
}

class Room {
    walls: number[][] = [];
    constructor(){
        this.walls = [
            [10, 10],
            [240, 10],
            [240, 100],
            [260, 100],
            [260, 10],
            [490, 10],
            [490, 490],
            [10, 490],
            [10, 300],
            [250, 300],
            [250, 280],
            [10, 280],
        ];
    }

    render(ctx: CanvasRenderingContext2D, highlight: number | null){
        if(highlight !== null){
            ctx.strokeStyle = "#f00";
            ctx.lineWidth = 5;
            ctx.beginPath();
            const v0 = this.walls[highlight];
            const v1 = this.walls[(highlight + 1) % this.walls.length];
            ctx.moveTo(v0[0], v0[1])
            ctx.lineTo(v1[0], v1[1]);
            ctx.stroke();
        }
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.beginPath();
        this.walls.forEach((pos) => ctx.lineTo(pos[0], pos[1]));
        ctx.closePath();
        ctx.stroke();
    }

    checkHit(car: {x: number, y: number}): number[] | null {
        function zipAdjacent(a: any[]) {
            let ret = [];
            for(let i = 0; i < a.length; i++){
                ret.push([a[i], a[(i + 1) % a.length]]);
            }
            return ret;
        }
        function zipAdjacentReduce(a: any[], fn: (a: any, b: any, acc: any) => any, initialValue: any) {
            let ret = initialValue;
            for(let i = 0; i < a.length-1; i++){
                ret = fn(a[i], a[i+1], ret);
            }
            return ret;
        }
        let hit = zipAdjacent(this.walls).reduce((acc: number[] | null, [pos, nextPos]: number[][], idx: number) => {
            function distanceToLine(line0: number[], line1: number[], pos: number[]): number {
                const direction = [line1[0] - line0[0], line1[1] - line0[1]];
                const length = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1]);
                direction[0] /= length;
                direction[1] /= length;
                const normal = [direction[1], -direction[0]];
                let directionComp = direction[0] * (pos[0] - line0[0]) + direction[1] * (pos[1] - line0[1]);
                if(directionComp < 0){
                    const delta = [pos[0] - line0[0], pos[1] - line0[1]];
                    return Math.sqrt(delta[0] * delta[0] + delta[1] * delta[1]);
                }
                else if(length < directionComp){
                    const delta = [pos[0] - line1[0], pos[1] - line1[1]];
                    return Math.sqrt(delta[0] * delta[0] + delta[1] * delta[1]);
                }
                return Math.abs(normal[0] * (pos[0] - line0[0]) + normal[1] * (pos[1] - line0[1]));
            }
            const dist = distanceToLine(pos, nextPos, [car.x, car.y]);
            return acc ?? (dist < 10 ? [idx, dist] : null);
        }, null);
        return hit;
    }
}

let car = new Car();
let room = new Room();

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
function render(){
    const ctx = canvas?.getContext("2d");
    const hit = room.checkHit(car);
    if(ctx){
        const {width, height} = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, width, height);
        car.render(ctx);
        ctx.strokeStyle = "#f77";
        ctx.beginPath();
        car.search(5, room, (prevState, nextState) => {
            ctx.moveTo(prevState[0], prevState[1]);
            ctx.lineTo(nextState[0], nextState[1]);
        });
        ctx.stroke();
        room.render(ctx, hit ? hit[0] : null);
    }
    const carElem = document.getElementById("car");
    if(carElem)
        carElem.innerHTML = `${car.x.toFixed(2)}, ${car.y.toFixed(2)}, hit: ${hit}`;
}

class ButtonState{
    w = false;
    a = false;
    s = false;
    d = false;
}

const buttonState = new ButtonState();

window.onload = render;

window.onkeydown = (ev: KeyboardEvent) => {
    switch(ev.key){
        case 'w': buttonState.w = true; break;
        case 'a': car.moveSteer(-1); break;
        case 's': buttonState.s = true; break;
        case 'd': car.moveSteer(1); break;
    }
}

window.onkeyup = (ev: KeyboardEvent) => {
    switch(ev.key){
        case 'w': buttonState.w = false; break;
        case 's': buttonState.s = false; break;
        case 'a': case 'd': car.moveSteer(0); break;
    }
}

function step(){
    const {width, height} = canvas.getBoundingClientRect();
    if(buttonState.w)
        car.move(0.05, 0);
    if(buttonState.s)
        car.move(-0.05, 0);
    if(!buttonState.w && !buttonState.s)
        car.move(0, 0);
    car.step(width, height, room);
    render();

    requestAnimationFrame(step);
}

requestAnimationFrame(step);
