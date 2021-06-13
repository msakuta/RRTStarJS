import { Car, StateWithCost } from './Car.ts';
import { Room } from './Room.ts';

console.log("search called");

const room = new Room(200, 200);
const car = new Car();

onmessage = function(e) {
    if(e.data.type === "initRoom"){
        console.log('initRoom Message received from main script: ' + e.data);
        room.width = e.data.width;
        room.height = e.data.height;
    }
    else if(e.data.type === "search"){
        console.log('initRoom Message received from main script: ' + e.data);
        car.copyFrom(e.data.car);
        const searchNodes: [StateWithCost, StateWithCost][] = [];
        car.search(20, room, (prevState, nextState) => {
            searchNodes.push([prevState, nextState]);
        }, e.data.switchBack);
        self.postMessage({
            searchNodes,
            path: car.path,
        });
    }
}
