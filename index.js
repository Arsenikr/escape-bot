'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()
var Config = require('./config')
var FB = require('./connectors/facebook')
var Bot = require('./bot')





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

//to send messages to facebook
app.post('/webhook', function (req, res) {
  var entry = FB.getMessageEntry(req.body)
  // IS THE ENTRY A VALID MESSAGE?
  if (entry && entry.message) {
    if (entry.message.attachments) {
      // NOT SMART ENOUGH FOR ATTACHMENTS YET
      FB.newMessage(entry.sender.id, "זה מעניין!")
    } else {

    	if (entry.message.text == "אוינק") {
            FB.newMessage(sender, emoji.emojify(':pig_nose: :pig_nose: :pig_nose:')  )
      } else {
      Bot.read(entry.sender.id, entry.message.text, function (sender, reply) {
        FB.newMessage(sender, "אני ממליץ על " + reply)
      })
      }
    }
  }

  res.sendStatus(200)
})

app.post('/test/', function (req, res) {
	var message = req.body.message
    console.log(message)
	Bot.read("moshe", message, function (sender, reply) {
		res.send("אני ממליץ על: " + response  )
      })
})
