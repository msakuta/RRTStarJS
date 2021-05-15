import { Car, StateWithCost } from './Car.ts';
import { Room } from './Room.ts';

console.log("search called");

let room = new Room(200, 200);

onmessage = function(e) {
    if(e.data.type === "initRoom"){
        console.log('initRoom Message received from main script: ' + e.data);
        room.width = e.data.width;
        room.height = e.data.height;
    }
    else if(e.data.type === "search"){
        console.log('initRoom Message received from main script: ' + e.data);
        let car = new Car();
        car.copyFrom(e.data.car);
        const searchTree: [StateWithCost, StateWithCost][] = [];
        car.search(15, room, (prevState, nextState) => {
            searchTree.push([prevState, nextState]);
        });
        self.postMessage({
            searchTree,
            path: car.path,
        });
    }
}
