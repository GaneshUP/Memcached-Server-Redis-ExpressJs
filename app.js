const express = require('express');
require('dotenv').config();
const app = express();
const morgan = require('morgan');
const bodyParser = require('body-parser');
const redis = require("redis");
const helper = require('./src/helper');
const _ = require('lodash');
const fs = require('fs');
const Memcached =  require('memcached');
// all global configurations should be applied to the .config object of the Client.
Memcached.config.poolSize = 5;

// Create memcached memory client
const memcached = new Memcached(process.env.MEMCACHED_HOST + ':' + process.env.MEMCACHED_PORT, {retries:10,retry:10000,remove:true});

// Define tracking Id's
const trackingIds = ["INF-yj562hjojzbtez", "INF-3gbfcjjsd6vhvo", "INF-ixpktk3itsk86", "INF-1bi5qk0zocqcz"];

// Create redis client
const client = redis.createClient('redis://' + process.env.REDIS_USER + ':' + process.env.REDIS_PASS + '@' + process.env.REDIS_HOST + ':' + process.env.REDIS_PORT);

// Print redis errors to the console
client.on('error', (err) => {
    console.log("Error " + err);
});

// Flush Redis DB
// client.flushdb();

// Add Morgan to app for log all the requests
app.use(morgan('dev'));

// Add Body Parser
app.use(bodyParser.urlencoded({
    extended: false
}));

app.use(bodyParser.json());

// Add CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === "OPTIONS") {
        res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, PATCH, DELETE');
        return res.status(200).json({});
    }
    next();
});

// Handle incoming POST requests to /visitors/events/
app.post('/visitors/events/', (req, res) => {
    // Check the body value is empty
    if(_.isEmpty(req.body.value) ){
        return res.status(400).json({
            code: "ERROR",
            message: "Invalid request"
        });
    }
    // Get the event key
    let eventKey = helper.getEventKey(req.body.value);
    // Check the the event key
    if(eventKey === "NONE"){
        return res.status(404).json({
            code: "ERROR",
            message: "Invalid Event type"
        });
    }
    // Add current timestamp
    req.body.value.timestamp = new Date();
    // Get and add event to memcache
    memcached.get(eventKey, function (err, data) {
        let events = [];
        // check data is empty
        if(_.isEmpty(data)){
            events.push(req.body);
            memcached.set(eventKey, JSON.stringify(events), 600, (err)=>{
                if(err){
                    console.log(err.message);
                }
            });
        }else{
            events = JSON.parse(data);
            // Push event to  events array
            events.push(req.body);
            memcached.replace(eventKey, JSON.stringify(events), 600, (err)=>{
                if(err){
                    console.log(err.message);
                }
            });
        }
    });
    // Get the events by key
    client.get(eventKey, (err, strEvents) =>{
        // Check error
        if(err){
            return res.status(500).json({
                code: "ERROR",
                message: err.message
            });
        }
        let events = [];
        // Get existing events
        if(!_.isEmpty(strEvents)){
            events = JSON.parse(strEvents);
        }
        // Push event to  events array
        events.push(req.body);
        client.set(eventKey, JSON.stringify(events));   
    });
    res.status(200).json({
        code: "SUCESS",
        message: "Event added successfully"
    });
});

// Handle incoming GET requests to /visitors/events/
app.get('/visitors/events/', (req, res) => {
    let eventKey = req.query.type;
    // check empty
    if(eventKey === undefined){
        return res.status(404).json({
            code: "ERROR",
            message: "Type parameter required."
        });
    }
    // Check event key in array
    if(!["CLICK", "SIGNUP", "NAVIGATE", "CHAT"].includes(eventKey)){
        return res.status(400).json({
            code: "ERROR",
            message: "Invalid event type."
        });
    }
    // Get the events by keyvalue
    client.get(eventKey, (err, strEvents) =>{
        // Check error
        if(err){
            return res.status(500).json({
                code: "ERROR",
                message: err.message
            });
        }
        let events = [];
        // Get existing events
        if(!_.isEmpty(strEvents)){
            events = JSON.parse(strEvents);
            // Filter the events
            helper.filterEvents(events).then(events => {
                // send response
                res.status(200).json({
                    code: "SUCCESS",
                    result: {
                        type: eventKey,
                        totalEventsCaptured: events.length,
                        eventsCapturedByTrackingIds: _.countBy(events, "trackingId")
                    }
                });
            }).catch(err =>{
                console.log(err);
                res.status(200).json({
                    code: "ERROR",
                    message: err.message
                });
            });
        }else{
            // Send response for empty event types
            res.status(200).json({
                code: "SUCCESS",
                result: {
                    type: eventKey,
                    totalEventsCaptured: events.length,
                    eventsCapturedByTrackingIds: {}
                }
            });
        }
    });
});

// Handle incoming GET requests to /visitors/events/trackingId/
app.get("/visitors/events/trackingId", (req, res) =>{
    let trackingId = req.query.trackingId;
    // check empty
    if(trackingId === undefined){
        return res.status(404).json({
            code: "ERROR",
            message: "Type parameter required."
        });
    }
    let events=[];
    getAllEvents("CLICK").then(events => {
        events.push(events);
        return getAllEvents("SIGNUP");
    }).then(events => {
        events.push(events);
        return getAllEvents("NAVIGATE");
    }).then(events => {
        events.push(events);
        return getAllEvents("CHAT");
    }).then(events => {
        // Send response
        events.push(events);
        res.status(200).json({
            code: "SUCCESS",
            result: {
                trackingId: trackingId,
                totalEventsCaptured: events.filter(event =>{
                    return event.value !== undefined ? (event.value.trackingId == trackingId) : false;
                }).length
            }
        });
    }).catch(err => {
        return res.status(500).json({
            code: "ERROR",
            message: err.message
        });
    })
})

// Get all the events by id
getAllEvents = (eventkey) => {
    return new Promise((resolve, reject) => {
        client.get(eventkey, (err, strEvents) =>{
            if(err){
                return reject(err);
            }
            if(!_.isEmpty(strEvents)){
                resolve(JSON.parse(strEvents));
            }else{
                resolve([]);
            }
        });
        
    })
}

// Handle incoming POST requests to /visitors/events/generate/
app.post('/visitors/events/generate/', (req, res) => {
    let count = 0
    let randInterval = setInterval(() =>{
        // Generate random event and insert into redis
        helper.getRandomEvent(trackingIds).then(event =>{
            // Get the event key
            let eventKey = helper.getEventKey(event.value);
            console.log(count + " - " + eventKey);
            // Check the the event key
            if(eventKey !== "NONE"){
                // Get and add event to memcache
                memcached.get(eventKey, function (err, data) {
                    let events = [];
                    // check data is empty
                    if(_.isEmpty(data)){
                        events.push(event);
                        memcached.set(eventKey, JSON.stringify(events), 600, (err)=>{
                            if(err){
                                console.log(err.message);
                            }
                        });
                    }else{
                        events = JSON.parse(data);
                        // Push event to  events array
                        events.push(event);
                        memcached.replace(eventKey, JSON.stringify(events), 600, (err)=>{
                            if(err){
                                console.log(err.message);
                            }
                        });
                    }
                });
                // Get the events by key
                client.get(eventKey, (err, strEvents) =>{
                    let events = [];
                    // Get existing events
                    if(!_.isEmpty(strEvents)){
                        events = JSON.parse(strEvents);
                    }
                    event.value.timestamp = new Date();
                    // Push event to  events array
                    events.push(event);
                    client.set(eventKey, JSON.stringify(events));   
                });
            }
        })
        // Stop interval, if count > 100
        if(count > 100){
            console.log("Interval Stopped");
            clearInterval(randInterval);
        }
        // Increment the count
        count++;
    }, 10);
    // Send the response
    res.status(200).json({
        code: "SUCESS",
        message: "Random events started generating."
    });
})

// Handle incoming GET requests to /memcache/events/
app.get('/memcache/events/', (req, res) => {
    let eventKey = req.query.type;
    // check empty
    if(eventKey === undefined){
        return res.status(404).json({
            code: "ERROR",
            message: "Type parameter required."
        });
    }
    // Check event key in array
    if(!["CLICK", "SIGNUP", "NAVIGATE", "CHAT"].includes(eventKey)){
        return res.status(400).json({
            code: "ERROR",
            message: "Invalid event type."
        });
    }
    // Get the events by keyvalue
    memcached.get(eventKey, (err, data) =>{
        // Check error
        if(err){
            return res.status(500).json({
                code: "ERROR",
                message: err.message
            });
        }
        let events = [];
        // Get existing events
        if(!_.isEmpty(data)){
            events = JSON.parse(data);
            // Filter the events
            helper.filterEvents(events).then(events => {
                // send response
                res.status(200).json({
                    code: "SUCCESS",
                    result: {
                        type: eventKey,
                        totalEventsCaptured: events.length,
                        eventsCapturedByTrackingIds: _.countBy(events, "trackingId")
                    }
                });
            }).catch(err =>{
                console.log(err);
                res.status(200).json({
                    code: "ERROR",
                    message: err.message
                });
            });
        }else{
            // Send response for empty event types
            res.status(200).json({
                code: "SUCCESS",
                result: {
                    type: eventKey,
                    totalEventsCaptured: events.length,
                    eventsCapturedByTrackingIds: {}
                }
            });
        }
    });
});

// Handle incoming GET requests to /memcache/events/trackingId/
app.get("/memcache/events/trackingId", (req, res) =>{
    let trackingId = req.query.trackingId;
    // check empty
    if(trackingId === undefined){
        return res.status(404).json({
            code: "ERROR",
            message: "Type parameter required."
        });
    }

    memcached.getMulti(['CLICK', 'SIGNUP', 'NAVIGATE', 'CHAT'], function (err, data) {
        // console.log(data);
        let events = [];
        if(err){
            return res.status(500).json({
                code: "ERROR",
                message: err.message
            });
        }else{
            // check click event
            if(!_.isEmpty(data["CLICK"])){
                events = JSON.parse(data["CLICK"]);
            }
            // check signup event
            if(!_.isEmpty(data["SIGNUP"])){
                events = _.merge(events, JSON.parse(data["SIGNUP"]));
            }
            // check navigate event
            if(!_.isEmpty(data["NAVIGATE"])){
                events = _.merge(events, JSON.parse(data["NAVIGATE"]));
            }
            // check chat event
            if(!_.isEmpty(data["CHAT"])){
                events = _.merge(events, JSON.parse(data["CHAT"]));
            }
            res.status(200).json({
                code: "SUCCESS",
                result: {
                    trackingId: trackingId,
                    totalEventsCaptured: events.filter(event =>{
                        return event.value !== undefined ? (event.value.trackingId == trackingId) : false;
                    }).length
                }
            });
        }
    });
});

// Error handler for routes
app.use((req, res, next) => {
    const error = new Error('Endpoint not found');
    error.status = 404;
    next(error);
});

// Error handler for app functionality
app.use((error, req, res, next) => {
    res.status(error.status || 500);
    res.json({
        error: {
            message: error.message
        }
    });
});

module.exports = app;
