'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();
const Config = require('./config');
const FB = require('./connectors/facebook/facebookapi');
const Bot = require('./botlogic/bot');
const emoji = require('node-emoji');

app.set('port', (process.env.PORT || 5000));

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));

// Process application/json
app.use(bodyParser.json());

// Index route
app.get('/', function (req, res) {
    res.send('שלום עולם אני אסקייפ בוט המומחה לחדרי בריחה')
});

// for Facebook verification
app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === Config.FB_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge'])
    }
    res.send('Error, wrong token')
});

// Spin up the server

// Initialize the app.
const server = app.listen(process.env.PORT || 8080, function () {
    let port = server.address().port;
    console.log("App now running on port", port);
});

// Generic error handler used by all endpoints.
function handleError(res, reason, message, code) {
    console.log("ERROR: " + reason);
    res.status(code || 500).json({"error": message});
}
app.post('/webhook', function (req, res) {
    let entry = FB.getMessageEntry(req.body);
    res.sendStatus(200);
    if(entry && entry.sender){
        let recipient = entry.sender.id;

        let postback = undefined;
        if(entry.postback) postback = entry.postback.payload;

        let qr = undefined;
        if(entry.message && entry.message.quick_reply) postback = entry.message.quick_reply.payload;

        let msg = undefined;
        if(entry.message) msg = entry.message.text;


        let attachments = [];
        if(entry.message && entry.message.attachments)
            for (let value of entry.message.attachments) {
                attachments.push(value.payload);
            }

        let inputobj = {
            msg: msg,
            attachments: attachments,
            postback: postback,
            qr: qr
        };
        Bot.mainFlow("facebook",recipient,inputobj)
    } else {
        console.log("failed to get recipient id from entry " + req.body)
    }
});


app.get('/generatewaze', function (req, res) {
    let lat = req.query['lat'];
    let lon = req.query['lon'];

    if (lat && lon) {
        Bot.generateMoovitLink(lat, lon).then(links => {
            res.send(links)
        })
    }
});

app.get('/generatemoovit', function (req, res) {
    let lat = req.query['lat'];
    let lon = req.query['lon'];
    let address = req.query['address'];

    if (lat && lon) {
        Bot.generateMoovitLink(lat, lon,address).then(links => {
            res.send(links)
        })
    }
});


