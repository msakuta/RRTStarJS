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
    id = 0;
    cost = 0;
    steer = 0;
    speed = 1;
    from = null;
    to = [];
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
    serialize() {
        return {
            x: this.x,
            y: this.y,
            heading: this.heading,
            speed: this.speed,
            cost: this.cost
        };
    }
    static deserialize(data) {
        const ret = new StateWithCost(data, data.cost, 0, data.speed);
        return ret;
    }
}
const distRadius = 10;
const distThreshold = 10 * 10;
const wrapAngle = (x)=>x - Math.floor((x + Math.PI) / (2 * Math.PI)) * (2 * Math.PI)
;
const compareState = (s1, s2)=>{
    let deltaAngle = wrapAngle(s1.heading - s2.heading);
    return compareDistance(s1, s2) && Math.abs(deltaAngle) < Math.PI / 4;
};
function compareDistance(s1, s2, threshold = distThreshold) {
    const deltaX = s1.x - s2.x;
    const deltaY = s1.y - s2.y;
    return deltaX * deltaX + deltaY * deltaY < threshold;
}
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
    searchNodes = 100;
    searchState;
    copyFrom(other) {
        if (this.goal && (this.goal.x !== other.goal.x || this.goal.y !== other.goal.y || this.goal.heading !== other.goal.heading)) {
            this.path = null;
        }
        for(var property in this){
            if (property !== "searchState" && property !== "path") this[property] = other[property];
        }
    }
    moveFromMsg(data) {
        this.x = data.x;
        this.y = data.y;
        this.angle = data.angle;
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
        return wrapAngle(Math.atan2(nextNode.y - this.y, nextNode.x - this.x) - this.angle);
    }
    followPath() {
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
            const relativeAngle = wrapAngle(Math.atan2(nextNode.y - this.y, nextNode.x - this.x) - this.angle);
            const nextNextNode = 2 < this.path.length ? this.path[this.path.length - 2] : {
                ...this.goal,
                steer: this.steer,
                speed: this.speed
            };
            if ((this.x - nextNextNode.x) * (this.x - nextNextNode.x) + (this.y - nextNextNode.y) * (this.y - nextNextNode.y) < (nextNode.x - nextNextNode.x) * (nextNode.x - nextNextNode.x) + (nextNode.y - nextNextNode.y) * (nextNode.y - nextNextNode.y) && nextNode.speed < 0 !== (relativeAngle < -Math.PI / 2 || Math.PI / 2 < relativeAngle)) this.path.pop();
            this.desiredSteer = Math.max(-1, Math.min(1, relativeAngle));
        } else {
            this.desiredSpeed = 0;
        }
    }
    step(width, height, room, deltaTime = 1) {
        if (this.auto) {
            this.followPath();
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
        const nodes = [];
        const edges = [];
        let skippedNodes = 0;
        const checkGoal = (node)=>{
            if (this.goal && compareState(node, this.goal)) {
                this.path = [];
                for(; node.from; node = node.from)this.path.push(node);
                return true;
            }
            return false;
        };
        const search = (start, depth, direction, expandStates = 1)=>{
            if (depth < 1 || 10000 < nodes.length) return;
            if (checkGoal(start)) return;
            for(let i = 0; i <= expandStates; i++){
                let { x , y , heading  } = start;
                let steer2 = Math.random() - 0.5;
                let changeDirection = switchBack && Math.random() < 0.2;
                const nextDirection = changeDirection ? -direction : direction;
                let distance = 10 + Math.random() * 50;
                let next = this.stepMove(x, y, heading, steer2, 1, nextDirection * distance);
                const hit = interpolate(start, steer2, nextDirection * distance, (state1)=>0 <= state1.x && state1.x < room.width && 0 <= state1.y && state1.y < room.height && room.checkHit({
                        x: state1.x,
                        y: state1.y
                    }) !== null
                );
                if (hit) continue;
                let node = new StateWithCost(next, start.cost + distance + (changeDirection ? 1000 : 0), steer2, nextDirection);
                let foundNode = null;
                let skip = false;
                for (let existingNode of nodes){
                    if (compareState(existingNode, node)) {
                        if (existingNode !== start && existingNode.from !== start && start.to.indexOf(existingNode) < 0) {
                            if (existingNode.cost > node.cost) {
                                existingNode.cost = node.cost;
                                const toIndex = existingNode.from?.to.indexOf(existingNode);
                                if (toIndex !== undefined && 0 <= toIndex) existingNode.from?.to.splice(toIndex, 1);
                                else {
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
                        } else {
                            skip = true;
                        }
                    }
                }
                if (skip) continue;
                if (!foundNode) {
                    node.from = start;
                    start.to.push(node);
                    node.id = nodes.length;
                    nodes.push(node);
                    search(node, depth - 1, nextDirection, expandStates);
                } else {
                    skippedNodes++;
                }
            }
        };
        const enumTree = (root)=>{
            nodes.push(root);
            for (let node of root.to){
                enumTree(node);
            }
        };
        if (this.searchState && compareDistance({
            x: this.x,
            y: this.y,
            heading: this.angle
        }, this.searchState.start, distThreshold * 100) && this.goal && compareDistance(this.goal, this.searchState.goal)) {
            if (this.searchState) {
                for (let root of this.searchState.searchTree)enumTree(root);
            }
            console.log(`Using existing tree with ${nodes.length} nodes`);
            const traceTree = (root, depth = 1, expandDepth = 1)=>{
                if (depth < 1) return;
                if (!root || checkGoal(root)) return;
                if (switchBack || -0.1 < root.speed) search(root, expandDepth, 1, 1);
                if (switchBack || root.speed < 0.1) search(root, expandDepth, -1, 1);
                if (0 < root.to.length) {
                    for(let i = 0; i < 2; i++){
                        const idx = Math.floor(Math.random() * root.to.length);
                        traceTree(root.to[idx], depth - 1, expandDepth);
                    }
                }
                if (this.searchState) this.searchState.treeSize++;
            };
            if (0 < nodes.length && nodes.length < 10000) {
                for(let i = 0; i < this.searchNodes; i++){
                    const idx = Math.floor(Math.random() * nodes.length);
                    traceTree(nodes[idx]);
                }
            }
            const treeSize = this.searchState.treeSize;
            this.searchState.treeSize = 0;
            this.searchState.goal = this.goal;
        } else if (this.goal) {
            console.log(`Rebuilding tree with ${nodes.length} nodes should be 0`);
            let roots = [];
            if (switchBack || -0.1 < this.speed) {
                const root = new StateWithCost({
                    x: this.x,
                    y: this.y,
                    heading: this.angle
                }, 0, 0, 1);
                nodes.push(root);
                search(root, depth, 1);
                roots.push(root);
            }
            if (switchBack || this.speed < 0.1) {
                const root = new StateWithCost({
                    x: this.x,
                    y: this.y,
                    heading: this.angle
                }, 0, 0, -1);
                nodes.push(root);
                search(root, depth, -1);
                roots.push(root);
            }
            if (roots) {
                if (this.searchState) {
                    this.searchState.searchTree = roots;
                    this.searchState.start = {
                        x: this.x,
                        y: this.y,
                        heading: this.angle
                    };
                    this.searchState.goal = this.goal;
                } else {
                    this.searchState = {
                        searchTree: roots,
                        treeSize: 0,
                        start: {
                            x: this.x,
                            y: this.y,
                            heading: this.angle
                        },
                        goal: this.goal
                    };
                }
            }
        }
        nodes.forEach((node, index)=>node.id = index
        );
        const connections = [];
        nodes.forEach((node, index)=>{
            if (node.from) {
                callback(node.from, node);
                if (!(node.from.id < nodes.length)) throw `No node id for from: ${node.from.id}`;
                if (!(node.id < nodes.length)) throw `No node id for to: ${node.id}`;
                connections.push([
                    node.from.id,
                    node.id
                ]);
            }
        });
        this.path?.forEach((node)=>{
            if (nodes.indexOf(node) < 0) {
                node.id = nodes.length;
                nodes.push(node);
            }
        });
        const nodeBuffer = new Float32Array(nodes.length * 5);
        nodes.forEach((node, i)=>{
            nodeBuffer[i * 5] = node.x;
            nodeBuffer[i * 5 + 1] = node.y;
            nodeBuffer[i * 5 + 2] = node.heading;
            nodeBuffer[i * 5 + 3] = node.cost;
            nodeBuffer[i * 5 + 4] = node.speed;
        });
        for (let con of connections){
            if (!(con[0] < nodes.length)) throw `No node id for from: ${con}`;
            if (!(con[1] < nodes.length)) throw `No node id for to: ${con}`;
        }
        this.path?.forEach((node)=>{
            if (!(node.id in nodes)) throw `Path node not in nodes ${node.id}`;
        });
        return {
            skippedNodes,
            nodes: nodeBuffer.buffer,
            path: this.path?.map((node)=>node.id
            )
        };
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
function sliderInit(sliderId, labelId, writer) {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    if (!slider || !label) return;
    label.innerHTML = slider.value;
    const paramsContainer = document.getElementById("paramsContainer");
    const updateFromInput = (_event)=>{
        let value = label.innerHTML = slider.value;
        if (value !== undefined) writer(parseInt(value));
    };
    slider.addEventListener("input", updateFromInput);
    return {
        elem: slider
    };
}
sliderInit("searchNodesInput", "searchNodesLabel", (value)=>{
    car.searchNodes = value;
});
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
    if (carElem) carElem.innerHTML = `x: ${car.x.toFixed(2)}, y: ${car.y.toFixed(2)}, heading: ${car.angle.toFixed(2)} steer: ${car.steer.toFixed(2)} relativeAngle: ${(car.nextRelativeAngle() / Math.PI).toFixed(2)} searchTree size: ${searchTree.length}`;
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
        const nodes = [];
        const nodesArray = new Float32Array(e.data.nodes);
        for(let i = 0; i < nodesArray.length / 5; i++){
            nodes.push(StateWithCost.deserialize({
                x: nodesArray[i * 5],
                y: nodesArray[i * 5 + 1],
                heading: nodesArray[i * 5 + 2],
                cost: nodesArray[i * 5 + 3],
                speed: nodesArray[i * 5 + 4]
            }));
        }
        car.path = e.data.path?.map((nodeId)=>nodes[nodeId]
        );
        const connections = [];
        const connectionsArray = new Int32Array(e.data.connections);
        searchTree = [];
        for(let i1 = 0; i1 < connectionsArray.length / 2; i1++){
            if (nodes.length <= connectionsArray[i1 * 2]) throw "no way";
            if (nodes.length <= connectionsArray[i1 * 2 + 1]) throw "no way2";
            searchTree.push([
                nodes[connectionsArray[i1 * 2]],
                nodes[connectionsArray[i1 * 2 + 1]], 
            ]);
        }
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
            car: {
                x: car.x,
                y: car.y,
                angle: car.angle,
                speed: car.speed,
                auto: car.auto,
                goal: car.goal,
                searchNodes: car.searchNodes
            }
        });
    }
    webWorker.postMessage({
        type: "move",
        car: {
            x: car.x,
            y: car.y,
            angle: car.angle
        }
    });
    render();
    requestAnimationFrame(step);
}
requestAnimationFrame(step);
