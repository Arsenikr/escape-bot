'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()
const emoji = require('node-emoji')

var mongoose = require('mongoose');

var ESCAPE_ROOMS_COLLECTION = "escape_rooms";

mongoose.connect(process.env.PROD_MONGODB || 'mongodb://127.0.0.1:27017/escape_bot', function (error) {
    if (error) {
        console.log(error);
    }
});

var Schema = mongoose.Schema;
var EscapeRoomsSchema = new Schema({
	room_name: String,
	company_name: String,
    location: String,
    min_players: Number,
    max_players: Number
});

// Mongoose Model definition
var EscapeRoom = mongoose.model(ESCAPE_ROOMS_COLLECTION, EscapeRoomsSchema);



app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
    res.send('Hello world, I am a chat bot')
})

// for Facebook verification
app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
        res.send(req.query['hub.challenge'])
    }
    res.send('Error, wrong token')
})

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


app.post('/webhook/', function (req, res) {
    let messaging_events = req.body.entry[0].messaging
    for (let i = 0; i < messaging_events.length; i++) {
        let event = req.body.entry[0].messaging[i]
        let sender = event.sender.id
        if (event.message && event.message.text) {
            let text = event.message.text
            if (text == "אוינק") {
                sendTextMessage(sender, emoji.emojify(':pig_nose: :pig_nose: :pig_nose:')  )
            } else {
            	findInDb(text, function(response) {
                sendTextMessage(sender, "אני ממליץ על " + response  )
            })
            }
        }
    }
    res.sendStatus(200)
})

const token = process.env.FB_PAGE_ACCESS_TOKEN

function sendTextMessage(sender, text) {
    let messageData = { text:text }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:token},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}


function findInDb(location,callback) {

	EscapeRoom.find({"location": location},{'room_name': true},function(err, docs) {
        if (err) {
            handleError(res, err.message, "Failed to get rooms.");
        } else {
        	if(docs.length > 0){
        		var i = Math.floor(Math.random() * (docs.length -1)) 
        	return callback(docs[i].room_name)
        	} else return callback( "חדרים אבל לא מכיר את " + location)
        }
    })
}


app.post('/test/', function (req, res) {
    var message = req.body.message
	findInDb(message, function(response) {
		res.send("אני ממליץ על: " + response  )
    })
})
