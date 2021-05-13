
function zipAdjacent<T>(a: T[]): [T, T][] {
    let ret: [T, T][] = [];
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


export class Room {
    walls: number[][] = [];
    width: number;
    height: number;
    constructor(width: number, height: number){
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
        this.width = width;
        this.height = height;
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
