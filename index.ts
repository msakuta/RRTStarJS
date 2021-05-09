

const MAX_SPEED = 2.;

class Car{
    x = 10;
    y = 10;
    angle = 0;
    steer = 0;
    speed = 0;
    render(ctx: CanvasRenderingContext2D){
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.rect(-10, -5, 20, 10);
        ctx.stroke();
        ctx.restore();
    }

    move(x: number, y: number) {
        this.speed = Math.min(MAX_SPEED, Math.max(-MAX_SPEED, this.speed + x));
    }

    moveSteer(steer: number){
        this.steer = steer;
    }

    step(width: number, height: number){
        this.speed = 0 < this.speed ? Math.max(0, this.speed - 0.01) : Math.min(0, this.speed + 0.01);
        const [x, y] = [this.speed, 0];
        const angle = this.angle + this.steer * x * 0.01 * Math.PI;
        const dx = Math.cos(angle) * x - Math.sin(angle) * y + this.x;
        const dy = Math.sin(angle) * x + Math.cos(angle) * y + this.y;
        if(0 < dx && dx < width && 0 < dy && dy < height){
            this.x = dx;
            this.y = dy;
            this.angle = angle;
        }
        else{
            this.speed = 0;
        }
    }
}

let car = new Car();

console.log(`Car is at ${car.x}, ${car.y}`);

const carElem = document.getElementById("car");
if(carElem)
    carElem.innerHTML = `${car.x}, ${car.y}`;

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
function render(){
    const ctx = canvas?.getContext("2d");
    if(ctx){
        const {width, height} = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        ctx.moveTo(10, 10);
        ctx.lineTo(50, 50);
        ctx.stroke();
        car.render(ctx);
    }
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
    car.step(width, height);
    render();

    requestAnimationFrame(step);
}

requestAnimationFrame(step);
