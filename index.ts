
import { Room } from './Room.ts';
import { Car, distRadius, State, StateWithCost } from './Car.ts';

const MAX_SPEED = 2.;

class CarRender extends Car {
    render(ctx: CanvasRenderingContext2D){
        ctx.strokeStyle = "#0f0";
        this.prediction().forEach(([x, y, angle]) => this.renderFrame(ctx, x, y, angle));
        ctx.strokeStyle = "#000";
        this.renderFrame(ctx, this.x, this.y, this.angle, true);
    }

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
}

class RoomRender extends Room {
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
}

var webWorker = new Worker("search.js");

console.log('Message posted to worker');

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
if(!canvas){
    throw "canvas must exist";
}

let car = new CarRender();
const {width, height} = canvas.getBoundingClientRect();
let room = new RoomRender(width, height);
let searchTree: [StateWithCost, StateWithCost][] = [];
let skippedNodes = 0;

webWorker.postMessage({
    type: "initRoom",
    width,
    height,
});

function render(){
    const ctx = canvas?.getContext("2d");
    const hit = room.checkHit(car);
    if(ctx){
        const {width, height} = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, width, height);
        car.render(ctx);
        if(car.path && car.goal){
            ctx.strokeStyle = "#00f";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(car.goal.x, car.goal.y);
            car.path.forEach(node => {
                ctx.lineTo(node.x, node.y);
            });
            ctx.lineTo(car.x, car.y);
            ctx.stroke();
        }
        searchTree.forEach(([prevState, nextState]: [StateWithCost, StateWithCost]) => {
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(prevState.x, prevState.y);
            ctx.lineTo(nextState.x, nextState.y);
            ctx.strokeStyle = `rgba(${prevState.cost}, 0, 0, 0.5)`;
            ctx.stroke();
        });
        if(car.goal){
            const drawPath = (goal: State) => {
                ctx.beginPath();
                ctx.ellipse(goal.x, goal.y, distRadius, distRadius, 0, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(goal.x, goal.y);
                ctx.lineTo(goal.x + 2 * distRadius * Math.cos(goal.heading),
                    goal.y + 2 * distRadius * Math.sin(goal.heading));
                ctx.stroke();
            }
            ctx.lineWidth = 8;
            ctx.strokeStyle = `#ffffff`;
            drawPath(car.goal);
            ctx.lineWidth = 3;
            ctx.strokeStyle = `#ff00ff`;
            drawPath(car.goal);
        }
        if(dragStart && dragTarget){
            ctx.lineWidth = 3;
            ctx.strokeStyle = `#ff00ff`;
            ctx.beginPath();
            ctx.moveTo(dragStart[0], dragStart[1]);
            ctx.lineTo(dragTarget[0], dragTarget[1]);
            ctx.stroke();
        }
        room.render(ctx, hit ? hit[0] : null);
    }
    const carElem = document.getElementById("car");
    if(carElem)
        carElem.innerHTML = `x: ${car.x.toFixed(2)}, y: ${car.y.toFixed(2)}, heading: ${car.angle.toFixed(2)
            } searchTree size: ${searchTree.length} skipped: ${skippedNodes}`;
    const autopilotElem = document.getElementById("autopilot");
    if(autopilotElem)
        autopilotElem.innerHTML = car.auto ? "on" : "off";
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
        case 'z':
            car.auto = !car.auto;
            if(!car.auto)
                searchTree.length = 0;
            break;
    }
}

let dragStart: [number, number] | undefined;
let dragTarget: [number, number] | undefined;

canvas.addEventListener("mousedown", (ev: MouseEvent) => {
    dragStart = [ev.clientX, ev.clientY];
});

canvas.addEventListener("mousemove", (ev: MouseEvent) => {
    dragTarget = [ev.clientX, ev.clientY];
});

canvas.addEventListener("mouseup", (ev: MouseEvent) => {
    if(dragStart){
        car.goal = {
            x: dragStart[0],
            y: dragStart[1],
            heading: Math.atan2(ev.clientY - dragStart[1], ev.clientX - dragStart[0])
        };
        car.path = null;
        dragStart = undefined;
        dragTarget = undefined;
    }
})

webWorker.onmessage = (e) => {
    searchTree = e.data.searchTree;
    car.path = e.data.path;
};

let t = 0;

function step(){
    const {width, height} = canvas.getBoundingClientRect();
    if(buttonState.w)
        car.move(0.05, 0);
    if(buttonState.s)
        car.move(-0.05, 0);
    if(!buttonState.w && !buttonState.s)
        car.move(0, 0);
    car.step(width, height, room);

    if(t++ % 10 === 0 && car.auto){
        webWorker.postMessage({
            type: "search",
            car,
        })
    }

    render();

    requestAnimationFrame(step);
}

requestAnimationFrame(step);
