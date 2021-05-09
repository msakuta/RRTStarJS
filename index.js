const MAX_SPEED = 2;
class State {
    [0] = 0;
    [1] = 0;
    [2] = 0;
}
class StateWithCost extends State {
    cost = 0;
    steer = 0;
    speed = 1;
    from = null;
    constructor(state, cost, steer1, speed1){
        super();
        this[0] = state[0];
        this[1] = state[1];
        this[2] = state[2];
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
    let deltaX = s1[0] - s2[0];
    let deltaY = s1[1] - s2[1];
    let deltaAngle = wrapAngle(s1[2] - s2[2]);
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
    render(ctx) {
        ctx.strokeStyle = "#0f0";
        this.prediction().forEach(([x, y, angle])=>this.renderFrame(ctx, x, y, angle)
        );
        ctx.strokeStyle = "#000";
        this.renderFrame(ctx, this.x, this.y, this.angle, true);
    }
    move(x, y) {
        this.desiredSpeed = Math.min(MAX_SPEED, Math.max(-MAX_SPEED, this.desiredSpeed + x));
    }
    moveSteer(steer) {
        this.desiredSteer = steer;
    }
    stepMove(px, py, angle, steer, speed, deltaTime = 1) {
        speed ??= this.speed;
        const [x, y] = [
            speed * deltaTime,
            0
        ];
        angle = angle + steer * x * 0.01 * Math.PI;
        const dx = Math.cos(angle) * x - Math.sin(angle) * y + px;
        const dy = Math.sin(angle) * x + Math.cos(angle) * y + py;
        return [
            dx,
            dy,
            angle
        ];
    }
    step(width, height, room, deltaTime = 1) {
        if (this.auto) {
            if (this.goal && this.path && !compareState(this.goal, [
                this.x,
                this.y,
                this.angle
            ])) {
                const nextNode = 1 < this.path.length ? this.path[this.path.length - 1] : {
                    ...this.goal,
                    steer: this.steer,
                    speed: this.speed
                };
                if (compareState(nextNode, [
                    this.x,
                    this.y,
                    this.angle
                ])) this.path.pop();
                const [dx, dy] = [
                    this.goal[0] - this.x,
                    this.goal[1] - this.y
                ];
                if (Math.abs(wrapAngle(this.goal[2] - this.angle)) < Math.PI / 4) this.desiredSpeed = Math.sign(nextNode.speed) * Math.min(1, Math.max(0, (Math.sqrt(dx * dx + dy * dy) - distRadius) / 50));
                else this.desiredSpeed = Math.sign(nextNode.speed);
                this.desiredSteer = nextNode.steer;
            } else {
                this.desiredSpeed = 0;
            }
        }
        this.speed = this.desiredSpeed < this.speed ? Math.max(this.desiredSpeed, this.speed - 0.1) : Math.min(this.desiredSpeed, this.speed + 0.1);
        const STEER_SPEED = 0.1;
        this.steer = Math.abs(this.steer - this.desiredSteer) < deltaTime * STEER_SPEED ? this.desiredSteer : this.steer < this.desiredSteer ? this.steer + deltaTime * STEER_SPEED : this.steer - deltaTime * STEER_SPEED;
        const [dx, dy, angle] = this.stepMove(this.x, this.y, this.angle, this.steer);
        if (0 < dx && dx < width && 0 < dy && dy < height && !room.checkHit({
            x: dx,
            y: dy
        })) {
            this.x = dx;
            this.y = dy;
            this.angle = angle;
        } else {
            this.speed = 0;
        }
    }
    prediction() {
        let [x, y, angle] = [
            this.x,
            this.y,
            this.angle
        ];
        const ret = [];
        for(let t = 0; t < 10; t++){
            ret.push([
                x,
                y,
                angle
            ]);
            [x, y, angle] = this.stepMove(x, y, angle, this.steer, undefined, 2);
        }
        return ret;
    }
    search(depth = 3, room, callback) {
        const interpolate = (start, steer2, distance, fn)=>{
            const INTERPOLATE_INTERVAL = 10;
            const interpolates = Math.floor(Math.abs(distance) / 10);
            for(let i = 0; i < interpolates; i++){
                let next = this.stepMove(start[0], start[1], start[2], steer2, 1, Math.sign(distance) * i * 10);
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
                let [x, y, angle] = [
                    start[0],
                    start[1],
                    start[2]
                ];
                let steer2 = Math.random() - 0.5;
                let distance = 10 + Math.random() * 50;
                let next = this.stepMove(x, y, angle, steer2, 1, direction * distance);
                let hit = interpolate(start, steer2, direction * distance, (state1)=>0 <= state1[0] && state1[0] < room.width && 0 <= state1[1] && state1[1] < room.height && room.checkHit({
                        x: state1[0],
                        y: state1[1]
                    }) !== null
                );
                if (!hit) {
                    let node = new StateWithCost(next, start.cost + distance, steer2, direction);
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
                        search(node, depth - 1, direction);
                    } else {
                        skippedNodes++;
                    }
                }
            }
        };
        if (-0.1 < this.speed) search(new StateWithCost([
            this.x,
            this.y,
            this.angle
        ], 0, 0, 1), depth, 1);
        if (this.speed < 0.1) search(new StateWithCost([
            this.x,
            this.y,
            this.angle
        ], 0, 0, -1), depth, -1);
        nodes.forEach((node)=>{
            if (node.from) callback(node.from, node);
        });
        return skippedNodes;
    }
}
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
    constructor(width, height){
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
        this.width = width;
        this.height = height;
    }
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
const canvas = document.getElementById("canvas");
let car = new Car();
const { width: width1 , height: height1  } = canvas.getBoundingClientRect();
let room = new Room(width1, height1);
let searchTree = [];
let skippedNodes = 0;
function render() {
    const ctx = canvas?.getContext("2d");
    const hit = room.checkHit(car);
    if (ctx) {
        const { width: width2 , height: height2  } = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, width2, height2);
        car.render(ctx);
        if (car.path && car.goal) {
            ctx.strokeStyle = "#00f";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(car.goal[0], car.goal[1]);
            car.path.forEach((node)=>{
                ctx.lineTo(node[0], node[1]);
            });
            ctx.lineTo(car.x, car.y);
            ctx.stroke();
        }
        searchTree.forEach(([prevState, nextState])=>{
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(prevState[0], prevState[1]);
            ctx.lineTo(nextState[0], nextState[1]);
            ctx.strokeStyle = `rgba(${prevState.cost}, 0, 0, 0.5)`;
            ctx.stroke();
        });
        if (car.goal) {
            const drawPath = (goal)=>{
                ctx.beginPath();
                ctx.ellipse(goal[0], goal[1], 10, 10, 0, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(goal[0], goal[1]);
                ctx.lineTo(goal[0] + 2 * 10 * Math.cos(goal[2]), goal[1] + 2 * 10 * Math.sin(goal[2]));
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
    if (carElem) carElem.innerHTML = `${car.x.toFixed(2)}, ${car.y.toFixed(2)}, hit: ${hit} searchTree size: ${searchTree.length} skipped: ${skippedNodes}`;
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
            car.auto = !car.auto;
            if (!car.auto) searchTree.length = 0;
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
        car.goal = [
            dragStart[0],
            dragStart[1],
            Math.atan2(ev.clientY - dragStart[1], ev.clientX - dragStart[0])
        ];
        car.path = null;
        dragStart = undefined;
        dragTarget = undefined;
    }
});
let t = 0;
function step() {
    const { width: width2 , height: height2  } = canvas.getBoundingClientRect();
    if (buttonState.w) car.move(0.05, 0);
    if (buttonState.s) car.move(-0.05, 0);
    if (!buttonState.w && !buttonState.s) car.move(0, 0);
    car.step(width2, height2, room);
    if ((t++) % 10 === 0 && car.auto) {
        searchTree = [];
        skippedNodes = car.search(15, room, (prevState, nextState)=>{
            searchTree.push([
                prevState,
                nextState
            ]);
        });
    }
    render();
    requestAnimationFrame(step);
}
requestAnimationFrame(step);
