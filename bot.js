'use strict'

const Config = require('./config');
const emoji = require('node-emoji');
const Wit = require('node-wit').Wit;
const DB = require('./connectors/mongoose');
const FB = require('./connectors/facebook');


// LETS SAVE USER SESSIONS
const sessions = {};

function findOrCreateSession(fbid) {
    let sessionId;

    // DOES USER SESSION ALREADY EXIST?
    Object.keys(sessions).forEach(k => {
        if (sessions[k].fbid === fbid
    )
    {
        // YUP
        sessionId = k
    }
});

    // No session so we will create one
    if (!sessionId) {
        sessionId = new Date().toISOString();
        sessions[sessionId] = {
            fbid: fbid,
            context: {
                _fbid_: fbid
            }
        }
    }

    return sessionId
}

function firstEntityValue(entities, entity) {
    console.log(entities);
    let val = entities && entities[entity] &&
        Array.isArray(entities[entity]) &&
        entities[entity].length > 0 &&
        entities[entity][0].value;

    if (!val) {
        return null
    }
    return typeof val === 'object' ? val.value : val
}


let actions = {
    send(request, response) {
        const {sessionId, context, entities} = request;
        const {text, quickreplies} = response;
        return new Promise(function (resolve, reject) {
            const recipientId = sessions[sessionId].fbid;

            if(context.room_list && context.room_list.length > 0) {
                FB.newMessage(recipientId,"", context.room_list);
            } else {

                generateErrorMsg(context, function (error_msg) {
                    FB.newMessage(recipientId, error_msg);
                });
            }

            return resolve();
            });

    },


    findEscapeRoom({context, entities}) {
        return new Promise(function (resolve, reject) {
            let location = firstEntityValue(entities, 'location');
            if(location) {
                DB.location_cleanup(location, function (cleaned_location) {
                    context.location = cleaned_location;

                    let num_of_people = firstEntityValue(entities, 'math_expression');
                    if (cleaned_location) {
                        console.log("wit received: " + location);
                        console.log("wit received: " + num_of_people);

                        DB.findRoomInDb(location, num_of_people, function (response) {
                            context.room_list = createRoomsList(response);
                            return resolve(context);

                        })
                    }
                });
            } else {
                return resolve(context)
            }
        });
    }
};

const WIT_TOKEN = Config.WIT_TOKEN;

const wit = new Wit({
    accessToken: WIT_TOKEN,
    actions
});


function read(sender, message) {
    // Let's find the user
    let sessionId = findOrCreateSession(sender);
    // Let's forward the message to the Wit.ai bot engine
    // This will run all actions until there are no more actions left to do
    wit.runActions(
        sessionId, // the user's current session
        message, // the user's message
        sessions[sessionId].context // the user's current session state
    ).then((context) => {
        delete context.location;
        delete context.room_list;
        // Our bot did everything it has to do.
        // Now it's waiting for further messages to proceed.
        console.log('Waiting for next user messages');

    // Updating the user's current session state
    sessions[sessionId].context = context;
})
    .
    catch((err) => {
        console.error('Oops! Got an error from Wit: ', err.stack || err);
    let context = sessions[sessionId].context;
    generateErrorMsg(context, function (error_msg) {
        let recepient_id = sessions[sessionId].fbid;
        FB.newMessage(recepient_id, error_msg);
    });
})
}

function easterEggs(message, callback) {
    if (message == "אוינק") {
        return callback(emoji.emojify(':pig_nose: :pig_nose: :pig_nose:'))
    } else {
        DB.findEasterEgg(message, function (response) {
           if(response){
               return callback(response);
           } else{
            return callback(undefined);
           }
        });
    }
}

function findRoomByName(message, callback) {
    DB.findRoomByName(message, function (response) {
    if(response) {
        return callback(createRoomsList(response));
    } else {
        return callback(undefined);
    }
    });
}

function findRoomsByCompany(message,callback) {
    DB.findRoomsByCompany(message,function (response) {
        if(response) {
            return callback(createRoomsList(response));
        } else {
            return callback(undefined);
        }
    });
}

function createRoomsList(response) {
    let list = [];
    if (response) {
        for (let i = 0; i < response.length; i++) {
            let url_button = {
                    title: 'הזמנ/י',
                    type: 'web_url',
                    url: response[i].website || "",
                    messenger_extensions: false,
                    webview_height_ratio: 'tall'
                },
                buttons = [url_button],
                default_action = {
                    type: 'web_url',
                    url: response[i].website || "",
                    messenger_extensions: false,
                    webview_height_ratio: 'tall'
                },

                element = {
                    title: response[i].room_name,
                    subtitle: response[i].address + "\n" + " טל׳: " + response[i].phone,
                    buttons: buttons,
                    default_action: default_action

                };

            list.push(element)
        }
    }
    return list
}

function generateErrorMsg(context, callback) {
    if(context.location) {
        DB.findErrorMessage('location', function (response) {
            if (response) {
                let msg = response[0].A.replace('<>', context.location);
                return callback(msg);
            } else {
                return callback('לא הבנתי את כוונתך, אנא נסה שוב');
            }
        });
    } else if(!context.location){
        return callback('התפזרו לי קצת הבוטנים, חסר לי מיקום בשביל לאתר את מה שביקשת');
    } else {
        return callback('לא הבנתי את כוונתך, אנא נסה שוב');
    }
}


module.exports = {
    findOrCreateSession: findOrCreateSession,
    read: read,
    easterEggs: easterEggs,
    findRoomByName: findRoomByName,
    findRoomsByCompany: findRoomsByCompany
};
