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
        const searchNodes: [number, number][] = [];
        const ret = car.search(5, room, (prevState, nextState) => {
            searchNodes.push([prevState.id, nextState.id]);
        }, e.data.switchBack);
        const connectionsArray = new Int32Array(searchNodes.length * 2);
        searchNodes.forEach(([from, to], i) => {
            connectionsArray[i * 2] = from;
            connectionsArray[i * 2 + 1] = to;
        });
        const connectionBuffer = connectionsArray.buffer;
        try{
            const msg = {
                ...ret,
                connections: connectionBuffer,
            };
            console.log(`Before Transfer: ${msg.nodes.byteLength}, ${connectionBuffer.byteLength}`);
            self.postMessage(msg, [msg.nodes, msg.connections]);
            console.log(`After Transferred: ${msg.nodes.byteLength}, ${connectionBuffer.byteLength}`);
        } catch(e) {
            console.error("Stack overflow!!!!!");
        }
    }
}
