
const moment = require('moment');
var fs = require('fs');
const _ = require('lodash');

// Identify the event key
exports.getEventKey = (data)=>{
    let result = "NONE";
    let eventType = data.event;
    switch(eventType) {
        case 'click':
            result = "CLICK";
            break;
        case 'formsubmit':
            result = "SIGNUP";
            break;
        case 'navigate':
            result = "NAVIGATE";
            break;
        case 'chat':
            result = "CHAT";
            break;
        default:
            break;
    }
    return result;
};

// Filter event by time
exports.filterEvents = (events) => {
   return new Promise((resolve, reject) => {
        resolve(events.filter( event => {
            return moment().diff(event.value.timestamp, 'minutes') <= 5;
        }).map(event => {
            return event.value;
        }));
    })
}

// Get random event from mock
exports.getRandomEvent = (trackingIds) => {
    return new Promise((resolve, reject) => {
        fs.readFile('mock.json', 'utf-8', (err, data) =>{ 
            if(err){
                reject(err);
            }else{
                let event = JSON.parse(data)[randomInteger(0,3)];
                event.value.timestamp = new Date();
                event.value.trackingId = trackingIds[randomInteger(0,3)];
                resolve(event);
            }
        });
    })
}

// Generate random integer value
randomInteger = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
