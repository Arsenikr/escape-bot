'use strict'

var Config = require('./config')
var emoji = require('node-emoji')
var Wit = require('node-wit').Wit;
var DB = require('./connectors/mongoose')
var FB = require('./connectors/facebook')




// LETS SAVE USER SESSIONS
var sessions = {}

var findOrCreateSession = function (fbid) {
  var sessionId

  // DOES USER SESSION ALREADY EXIST?
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // YUP
      sessionId = k
    }
  })

  // No session so we will create one
  if (!sessionId) {
    sessionId = new Date().toISOString()
    sessions[sessionId] = {
      fbid: fbid,
      context: {
        _fbid_: fbid
      }
    }
  }

  return sessionId
}

var firstEntityValue = function (entities, entity) {
    var val = entities && entities[entity] &&
        Array.isArray(entities[entity]) &&
        entities[entity].length > 0 &&
        entities[entity][0].value

    if (!val) {
        return null
    }
    return typeof val === 'object' ? val.value : val
}


var actions = {
    send(request, response) {
        const {sessionId, context, entities} = request;
        const {text, quickreplies} = response;
        return new Promise(function(resolve, reject) {
            const recipientId = sessions[sessionId].fbid;

            console.log('WIT WANTS TO TALK TO:', recipientId)
            console.log('WIT HAS SOMETHING TO SAY:', text)
            console.log('WIT HAS A CONTEXT:', sessions[sessionId].context)

            FB.newMessage(recipientId, text)


            return resolve();
        });
    },


    findEscapeRoom({context, entities}) {
        return new Promise(function(resolve, reject) {
            var location = firstEntityValue(entities, 'location');

            if (location) {
                console.log("wit received: " + location)

                DB.findRoomInDb(location, function(response) {
                        context.room_name = response || 'אין לי מושג'
                    return resolve(context);

                })
            }
        });
    },
};

const WIT_TOKEN = Config.WIT_TOKEN;

const wit = new Wit({
    accessToken: WIT_TOKEN,
    actions
});


var read = function (sender, message, reply) {
	if (message === 'hello') {
		// Let's reply back hello
		message = 'Hello yourself! I am a chat bot. You can say "show me pics of corgis"'
		reply(sender, message)
	} else {
		// Let's find the user
		var sessionId = findOrCreateSession(sender)
		// Let's forward the message to the Wit.ai bot engine
		// This will run all actions until there are no more actions left to do
			wit.runActions(
              sessionId, // the user's current session
              message, // the user's message
              sessions[sessionId].context // the user's current session state
            ).then((context) => {
              // Our bot did everything it has to do.
              // Now it's waiting for further messages to proceed.
              console.log('Waiting for next user messages');

              // Based on the session state, you might want to reset the session.
              // This depends heavily on the business logic of your bot.
              // Example:
              // if (context['done']) {
              //   delete sessions[sessionId];
              // }

              // Updating the user's current session state
              sessions[sessionId].context = context;
            })
            .catch((err) => {
              console.error('Oops! Got an error from Wit: ', err.stack || err);
            })
	}
}




module.exports = {
	findOrCreateSession: findOrCreateSession,
	read: read,
}
