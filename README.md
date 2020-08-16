# Memcached-Server-Redis-ExpressJs
Example of Caching using Memcached and Redis Server in Express JS

## Technologies
* Redis
* Express JS

## Setup
To run this project, install it locally using npm:

#### Clone Repository
```
$ git clone https://github.com/GaneshUP/Memcached-Server-Redis-ExpressJs.git
```

#### Create .env File
1. Create a file with name .env inside project root folder
2. .env file should be like below:
```
PORT=5000
REDIS_HOST=<Redis Server Host>
REDIS_PORT=<Redis Server Port>
REDIS_PASS=<Redis Server Password>
REDIS_USER=<Redis Server Username>
MEMCACHED_HOST=<Memcached Server Host>
MEMCACHED_PORT=<Memcached Server Port>
```

## Run Project
```
$ cd Memcached-Server-Redis-ExpressJs
$ npm install
$ npm start
```