import { Car } from './Car.ts';

console.log("search called");

onmessage = function(e) {
    console.log('Message received from main script: ' + e.data);
  }
