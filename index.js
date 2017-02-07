'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()
var Config = require('./config')
var FB = require('./connectors/facebook')
var Bot = require('./bot')
const emoji = require('node-emoji')


app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
    res.send('שלום עולם אני אסקייפ בוט המומחה לחדרי בריחה')
})

// for Facebook verification
app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === Config.FB_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge'])
    }
    res.send('Error, wrong token')
});

// Spin up the server

// Initialize the app.
var server = app.listen(process.env.PORT || 8080, function () {
    var port = server.address().port;
    console.log("App now running on port", port);
});

// Generic error handler used by all endpoints.
function handleError(res, reason, message, code) {
    console.log("ERROR: " + reason);
    res.status(code || 500).json({"error": message});
}

//to send messages to facebook
app.post('/webhook', function (req, res) {
    var entry = FB.getMessageEntry(req.body);
    // IS THE ENTRY A VALID MESSAGE?
    if (entry && entry.message) {
        if (entry.message.attachments) {
            // NOT SMART ENOUGH FOR ATTACHMENTS YET
            FB.newMessage(entry.sender.id, "זה מעניין!")
        } else {

            Bot.easterEggs(entry.message.text, function (reply) {
                if (reply) {
                    FB.newMessage(entry.sender.id, reply)
                } else {
                    Bot.findRoomByName(entry.message.text, function (reply) {
                        if (reply && reply.length > 0) {
                            FB.newMessage(entry.sender.id, "",reply)
                        } else {
                            Bot.findRoomsByCompany(entry.message.text, function (reply) {
                                if (reply && reply.length > 0) {
                                    FB.newMessage(entry.sender.id, "",reply)
                                } else {

                                    Bot.read(entry.sender.id, entry.message.text, function (sender, reply) {
                                        if (reply) {
                                            // FB.newMessage(entry.sender.id, "אני ממליץ על " + reply)
                                        } else {
                                            handleNotUnderstand(entry.message.text)
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    }

    res.sendStatus(200)
});

function handleNotUnderstand(message) {

    FB.newMessage(entry.sender.id, 'אני לא יודע מה זה ' + message + ", נסה שוב")
}

app.post('/test/', function (req, res) {
    var message = req.body.message;
    console.log(message);

    Bot.easterEggs(message, function (reply) {
        if (reply) {
            res.send(reply)
        } else {
            Bot.findRoomByName(message, function (reply) {
                if (reply) {
                    res.send(reply)
                } else {
                    Bot.read("moshe", message, function (sender, reply) {
                        res.send("אני ממליץ על: " + reply[0].room_name)
                    })
                }
            })

        }

    });
});
