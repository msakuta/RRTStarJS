# RRT* search demo

Very simple script to demonstrate RRT* pathfinding.

Try it now on your browser! https://msakuta.github.io/RRTStarJS/

## Screenshot

![screenshot](images/RRTstar.png)

## Status

Currently the path finding is very dumb and sometimes fails to find a path or even
follow a found path.
## How to build

This project assumes [deno](https://deno.land/) but you could use Node.js to build.

Install [bundler](https://deno.land/x/bundler@0.7.0) by

    deno install --unstable --allow-read --allow-write --allow-net --allow-env --name bundler https://deno.land/x/bundler/cli.ts

Compile with

    bundler bundle --config tsconfig.json index.ts=index.js

and start a file server by installing file server

    deno install --allow-net --allow-read https://deno.land/std@0.95.0/http/file_server.ts

and run it

    file_server .

and browse http://localhost:4507/ (or whatever the file_server tells to use).

## Reference

https://theclassytim.medium.com/robotic-path-planning-rrt-and-rrt-212319121378