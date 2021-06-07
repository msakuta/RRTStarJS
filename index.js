function zipAdjacent(a) {
    let ret = [];
    for(let i = 0; i < a.length; i++){
        ret.push([
            a[i],
            a[(i + 1) % a.length]
        ]);
    }
    return ret;
}
class Room {
    walls = [];
    width;
    height;
    constructor(width1, height1){
        this.walls = [
            [
                10,
                10
            ],
            [
                240,
                10
            ],
            [
                240,
                100
            ],
            [
                260,
                100
            ],
            [
                260,
                10
            ],
            [
                490,
                10
            ],
            [
                490,
                490
            ],
            [
                10,
                490
            ],
            [
                10,
                300
            ],
            [
                250,
                300
            ],
            [
                250,
                280
            ],
            [
                10,
                280
            ], 
        ];
        this.width = width1;
        this.height = height1;
    }
    checkHit(car) {
        let hit = zipAdjacent(this.walls).reduce((acc, [pos, nextPos], idx)=>{
            function distanceToLine(line0, line1, pos1) {
                const direction = [
                    line1[0] - line0[0],
                    line1[1] - line0[1]
                ];
                const length = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1]);
                direction[0] /= length;
                direction[1] /= length;
                const normal = [
                    direction[1],
                    -direction[0]
                ];
                let directionComp = direction[0] * (pos1[0] - line0[0]) + direction[1] * (pos1[1] - line0[1]);
                if (directionComp < 0) {
                    const delta = [
                        pos1[0] - line0[0],
                        pos1[1] - line0[1]
                    ];
                    return Math.sqrt(delta[0] * delta[0] + delta[1] * delta[1]);
                } else if (length < directionComp) {
                    const delta = [
                        pos1[0] - line1[0],
                        pos1[1] - line1[1]
                    ];
                    return Math.sqrt(delta[0] * delta[0] + delta[1] * delta[1]);
                }
                return Math.abs(normal[0] * (pos1[0] - line0[0]) + normal[1] * (pos1[1] - line0[1]));
            }
            const dist = distanceToLine(pos, nextPos, [
                car.x,
                car.y
            ]);
            return acc ?? (dist < 10 ? [
                idx,
                dist
            ] : null);
        }, null);
        return hit;
    }
}
const MAX_SPEED = 2;
const MAX_STEER = Math.PI;
class State {
    x = 0;
    y = 0;
    heading = 0;
}
class StateWithCost extends State {
    cost = 0;
    steer = 0;
    speed = 1;
    from = null;
    constructor(state, cost, steer1, speed1){
        super();
        this.x = state.x;
        this.y = state.y;
        this.heading = state.heading;
        this.cost = cost;
        this.steer = steer1;
        this.speed = speed1;
        this.from = null;
    }
}
const distRadius = 10;
const distThreshold = 10 * 10;
const wrapAngle = (x)=>x - Math.floor((x + Math.PI) / (2 * Math.PI)) * (2 * Math.PI)
;
const compareState = (s1, s2)=>{
    let deltaX = s1.x - s2.x;
    let deltaY = s1.y - s2.y;
    let deltaAngle = wrapAngle(s1.heading - s2.heading);
    return deltaX * deltaX + deltaY * deltaY < distThreshold && Math.abs(deltaAngle) < Math.PI / 4;
};
class Car {
    x = 100;
    y = 100;
    angle = 0;
    steer = 0;
    desiredSteer = 0;
    speed = 0;
    desiredSpeed = 0;
    auto = true;
    goal = null;
    path = null;
    copyFrom(other) {
        for(var property in this){
            this[property] = other[property];
        }
    }
    move(x, y) {
        this.desiredSpeed = Math.min(MAX_SPEED, Math.max(-MAX_SPEED, this.desiredSpeed + x));
    }
    moveSteer(steer) {
        this.desiredSteer = steer;
    }
    stepMove(px, py, heading, steer, speed, deltaTime = 1) {
        speed ??= this.speed;
        const [x, y] = [
            speed * deltaTime,
            0
        ];
        heading = heading + Math.max(-1, Math.min(1, steer)) * x * 0.01 * MAX_STEER;
        const dx = Math.cos(heading) * x - Math.sin(heading) * y + px;
        const dy = Math.sin(heading) * x + Math.cos(heading) * y + py;
        return {
            x: dx,
            y: dy,
            heading
        };
    }
    nextRelativeAngle() {
        if (!this.path || this.path.length === 0) return 0;
        const nextNode = this.path[this.path.length - 1];
        return Math.atan2(nextNode.y - this.y, nextNode.x - this.x);
    }
    step(width, height, room, deltaTime = 1) {
        if (this.auto) {
            const thisState = {
                x: this.x,
                y: this.y,
                heading: this.angle
            };
            if (this.goal && this.path && !compareState(this.goal, thisState)) {
                const nextNode = 1 < this.path.length ? this.path[this.path.length - 1] : {
                    ...this.goal,
                    steer: this.steer,
                    speed: this.speed
                };
                if (compareState(nextNode, thisState)) this.path.pop();
                const [dx, dy] = [
                    this.goal.x - this.x,
                    this.goal.y - this.y
                ];
                if (Math.abs(wrapAngle(this.goal.heading - this.angle)) < Math.PI / 4) this.desiredSpeed = Math.sign(nextNode.speed) * Math.min(1, Math.max(0, (Math.sqrt(dx * dx + dy * dy) - distRadius) / 50));
                else this.desiredSpeed = Math.sign(nextNode.speed);
                const relativeAngle = Math.atan2(nextNode.y - this.y, nextNode.x - this.x);
                this.desiredSteer = Math.max(-1, Math.min(1, wrapAngle(relativeAngle - this.angle)));
            } else {
                this.desiredSpeed = 0;
            }
        }
        this.speed = this.desiredSpeed < this.speed ? Math.max(this.desiredSpeed, this.speed - Math.PI) : Math.min(this.desiredSpeed, this.speed + Math.PI);
        const STEER_SPEED = 0.1;
        this.steer = Math.abs(this.steer - this.desiredSteer) < deltaTime * STEER_SPEED ? this.desiredSteer : this.steer < this.desiredSteer ? this.steer + deltaTime * STEER_SPEED : this.steer - deltaTime * STEER_SPEED;
        const { x: dx , y: dy , heading  } = this.stepMove(this.x, this.y, this.angle, this.steer);
        if (0 < dx && dx < width && 0 < dy && dy < height && !room.checkHit({
            x: dx,
            y: dy
        })) {
            this.x = dx;
            this.y = dy;
            this.angle = heading;
        } else {
            this.speed = 0;
        }
    }
    prediction() {
        let [x, y, heading] = [
            this.x,
            this.y,
            this.angle
        ];
        const ret = [];
        for(let t = 0; t < 10; t++){
            ret.push([
                x,
                y,
                heading
            ]);
            ({ x , y , heading  } = this.stepMove(x, y, heading, this.steer, undefined, 2));
        }
        return ret;
    }
    search(depth = 3, room, callback, switchBack = false) {
        const interpolate = (start, steer2, distance, fn)=>{
            const INTERPOLATE_INTERVAL = 10;
            const interpolates = Math.floor(Math.abs(distance) / 10);
            for(let i = 0; i < interpolates; i++){
                let next = this.stepMove(start.x, start.y, start.heading, steer2, 1, Math.sign(distance) * i * 10);
                if (fn(next)) return true;
            }
            return false;
        };
        let nodes = [];
        let skippedNodes = 0;
        const search = (start, depth, direction)=>{
            if (depth < 1) return;
            if (this.goal && compareState(start, this.goal)) {
                this.path = [];
                for(let node = start; start.from; start = start.from)this.path.push(start);
                return;
            }
            for(let i = 0; i <= 5; i++){
                let { x , y , heading  } = start;
                let steer2 = Math.random() - 0.5;
                let changeDirection = switchBack && Math.random() < 0.2;
                const nextDirection = changeDirection ? -direction : direction;
                let distance = 10 + Math.random() * 50;
                let next = this.stepMove(x, y, heading, steer2, 1, nextDirection * distance);
                let hit = interpolate(start, steer2, nextDirection * distance, (state1)=>0 <= state1.x && state1.x < room.width && 0 <= state1.y && state1.y < room.height && room.checkHit({
                        x: state1.x,
                        y: state1.y
                    }) !== null
                );
                if (!hit) {
                    let node = new StateWithCost(next, start.cost + distance + (changeDirection ? 1000 : 0), steer2, nextDirection);
                    let foundNode = null;
                    for (let existingNode of nodes){
                        if (compareState(existingNode, node)) {
                            if (existingNode.cost > node.cost) {
                                existingNode.cost = node.cost;
                                existingNode.from = start;
                            }
                            foundNode = existingNode;
                            break;
                        }
                    }
                    if (!foundNode) {
                        node.from = start;
                        nodes.push(node);
                        search(node, depth - 1, nextDirection);
                    } else {
                        skippedNodes++;
                    }
                }
            }
        };
        if (switchBack || -0.1 < this.speed) search(new StateWithCost({
            x: this.x,
            y: this.y,
            heading: this.angle
        }, 0, 0, 1), depth, 1);
        if (switchBack || this.speed < 0.1) search(new StateWithCost({
            x: this.x,
            y: this.y,
            heading: this.angle
        }, 0, 0, -1), depth, -1);
        nodes.forEach((node)=>{
            if (node.from) callback(node.from, node);
        });
        return skippedNodes;
    }
}
class CarRender extends Car {
    render(ctx) {
        ctx.strokeStyle = "#0f0";
        this.prediction().forEach(([x, y, angle])=>this.renderFrame(ctx, x, y, angle)
        );
        ctx.strokeStyle = "#000";
        this.renderFrame(ctx, this.x, this.y, this.angle, true);
    }
    renderFrame(ctx, x, y, angle, drawDirection = false) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.rect(-10, -5, 20, 10);
        ctx.stroke();
        if (drawDirection) {
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
    render(ctx, highlight) {
        if (highlight !== null) {
            ctx.strokeStyle = "#f00";
            ctx.lineWidth = 5;
            ctx.beginPath();
            const v0 = this.walls[highlight];
            const v1 = this.walls[(highlight + 1) % this.walls.length];
            ctx.moveTo(v0[0], v0[1]);
            ctx.lineTo(v1[0], v1[1]);
            ctx.stroke();
        }
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.beginPath();
        this.walls.forEach((pos)=>ctx.lineTo(pos[0], pos[1])
        );
        ctx.closePath();
        ctx.stroke();
    }
}
var webWorker = new Worker("search.js");
console.log('Message posted to worker');
const canvas = document.getElementById("canvas");
let car = new CarRender();
const { width: width2 , height: height2  } = canvas.getBoundingClientRect();
let room = new RoomRender(width2, height2);
let searchTree = [];
webWorker.postMessage({
    type: "initRoom",
    width: width2,
    height: height2
});
const autopilotElem = document.getElementById("autopilot");
function toggleAutopilot() {
    autopilotElem.checked = car.auto = !car.auto;
    if (!car.auto) searchTree.length = 0;
}
autopilotElem?.addEventListener("click", toggleAutopilot);
function render() {
    const ctx = canvas?.getContext("2d");
    const hit = room.checkHit(car);
    if (ctx) {
        const { width: width3 , height: height3  } = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, width3, height3);
        car.render(ctx);
        if (car.path && car.goal) {
            ctx.strokeStyle = "#00f";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(car.goal.x, car.goal.y);
            car.path.forEach((node)=>{
                ctx.lineTo(node.x, node.y);
            });
            ctx.lineTo(car.x, car.y);
            ctx.stroke();
        }
        searchTree.forEach(([prevState, nextState])=>{
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(prevState.x, prevState.y);
            ctx.lineTo(nextState.x, nextState.y);
            ctx.strokeStyle = `rgba(${prevState.cost}, 0, 0, 0.5)`;
            ctx.stroke();
        });
        if (car.goal) {
            const drawPath = (goal)=>{
                ctx.beginPath();
                ctx.ellipse(goal.x, goal.y, 10, 10, 0, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(goal.x, goal.y);
                ctx.lineTo(goal.x + 2 * 10 * Math.cos(goal.heading), goal.y + 2 * 10 * Math.sin(goal.heading));
                ctx.stroke();
            };
            ctx.lineWidth = 8;
            ctx.strokeStyle = `#ffffff`;
            drawPath(car.goal);
            ctx.lineWidth = 3;
            ctx.strokeStyle = `#ff00ff`;
            drawPath(car.goal);
        }
        if (dragStart && dragTarget) {
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
    if (carElem) carElem.innerHTML = `x: ${car.x.toFixed(2)}, y: ${car.y.toFixed(2)}, heading: ${car.angle.toFixed(2)} steer: ${car.steer.toFixed(2)} relativeAngle: ${car.nextRelativeAngle().toFixed(2)} searchTree size: ${searchTree.length}`;
    if (autopilotElem) autopilotElem.checked = car.auto;
}
class ButtonState {
    w = false;
    a = false;
    s = false;
    d = false;
}
const buttonState = new ButtonState();
window.onload = render;
window.onkeydown = (ev)=>{
    switch(ev.key){
        case 'w':
            buttonState.w = true;
            break;
        case 'a':
            car.moveSteer(-1);
            break;
        case 's':
            buttonState.s = true;
            break;
        case 'd':
            car.moveSteer(1);
            break;
    }
};
window.onkeyup = (ev)=>{
    switch(ev.key){
        case 'w':
            buttonState.w = false;
            break;
        case 's':
            buttonState.s = false;
            break;
        case 'a':
        case 'd':
            car.moveSteer(0);
            break;
        case 'z':
            toggleAutopilot();
            break;
    }
};
let dragStart;
let dragTarget;
canvas.addEventListener("mousedown", (ev)=>{
    dragStart = [
        ev.clientX,
        ev.clientY
    ];
});
canvas.addEventListener("mousemove", (ev)=>{
    dragTarget = [
        ev.clientX,
        ev.clientY
    ];
});
canvas.addEventListener("mouseup", (ev)=>{
    if (dragStart) {
        car.goal = {
            x: dragStart[0],
            y: dragStart[1],
            heading: Math.atan2(ev.clientY - dragStart[1], ev.clientX - dragStart[0])
        };
        car.path = null;
        dragStart = undefined;
        dragTarget = undefined;
    }
});
let pendingSearch = false;
webWorker.onmessage = (e)=>{
    if (car.auto) {
        searchTree = e.data.searchTree;
        car.path = e.data.path;
    }
    pendingSearch = false;
};
let t = 0;
function step() {
    const { width: width3 , height: height3  } = canvas.getBoundingClientRect();
    if (buttonState.w) car.move(0.05, 0);
    if (buttonState.s) car.move(-0.05, 0);
    if (!buttonState.w && !buttonState.s) car.move(0, 0);
    car.step(width3, height3, room);
    if ((t++) % 10 === 0 && car.auto && !pendingSearch) {
        const switchBackCheck = document.getElementById('switchBack');
        pendingSearch = true;
        webWorker.postMessage({
            type: "search",
            switchBack: switchBackCheck?.checked,
            car
        });
    }
    render();
    requestAnimationFrame(step);
}
requestAnimationFrame(step);
