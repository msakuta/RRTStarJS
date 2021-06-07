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
console.log("search called");
let room = new Room(200, 200);
onmessage = function(e) {
    if (e.data.type === "initRoom") {
        console.log('initRoom Message received from main script: ' + e.data);
        room.width = e.data.width;
        room.height = e.data.height;
    } else if (e.data.type === "search") {
        console.log('initRoom Message received from main script: ' + e.data);
        let car = new Car();
        car.copyFrom(e.data.car);
        const searchTree = [];
        car.search(20, room, (prevState, nextState)=>{
            searchTree.push([
                prevState,
                nextState
            ]);
        }, e.data.switchBack);
        self.postMessage({
            searchTree,
            path: car.path
        });
    }
};
