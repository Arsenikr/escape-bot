'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();
const Config = require('./config');
const FB = require('./connectors/facebook');
const Bot = require('./bot');
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



function handleFBMessage(entry) {
    let recipient = entry.sender.id;
    let message = entry.message.text;
    Bot.findOrCreateSession(recipient).then(sessionid => {

        let session_context = Bot.sessions[sessionid];

        Bot.easterEggs(message).then(function (reply) {
            if (reply) {
                FB.newSimpleMessage(recipient, reply)
            } else {
                Bot.findRoomByName(message).then(function (reply) {
                    if (reply && reply.length > 0) {
                        FB.newStructuredMessage(recipient, reply)
                    } else {
                        Bot.findRoomsByCompany(message).then(function (reply) {
                            if (reply && reply.length > 0) {
                                FB.newStructuredMessage(recipient, reply)
                            } else {
                                Bot.read(recipient, message)
                            }
                        });
                    }
                });
            }
        }).catch(err => {
            console.log(err);
            FB.newSimpleMessage(entry.sender.id, 'לא הצלחתי לענות על זה, אבל הנה דברים שאני כן יכול לענות עליהם!').then(ans => {
                Bot.drawMenu(session_context, entry);
            });
        });
    });
}

function sendStartMessages(entry,profile) {
    Bot.findOrCreateSession(entry.sender.id).then( sessionid => {

    let fname =  profile.first_name  || "בוטן";
    let recipient = entry.sender.id;
    let context = Bot.sessions[sessionid].context;
    FB.newSimpleMessage(recipient, "שלום " + fname + "! אני בוט שיודע לתת מידע על חדרי בריחה בישראל" ).then(resp => {
        let message = "";
        if(profile.gender && profile.gender === "female"){
            message =  "את יכולה לשאול אותי מידע על חדרים, ולחפש חדרים על פי קריטריונים שונים"
        } else{
            message = "אתה יכול לשאול אותי מידע על חדרים, ולחפש חדרים על פי קריטריונים שונים"
        }
        FB.newSimpleMessage(recipient, message).then(resp => {
            FB.newSimpleMessage(recipient,"בואו נתחיל!").then(r => {
                Bot.drawMenu(recipient, context).then(res => {
                    // Bot.sessions[sessionid].context.is_started = true;
                })
            });
        })

    })
    });
}

function createLocationQR() {
    let data = {};
    data["ב״שׁ"] = "LOCATION_QR1";
    data["דרום"] = "LOCATION_QR2";
    data["ראשון לציון"] = "LOCATION_QR3";
    data["ת״א"] = "LOCATION_QR4";
    data["מרכז"] = "LOCATION_QR5";
    data["חיפה"] = "LOCATION_QR6";
    data["צפון"] = "LOCATION_QR7";

    return Bot.createQuickReplies(data);
}

function createGroupSizeQR() {
    let data = {};
    data["שמיניה"] = "GROUP_SIZE_QR1";
    data["שביעיה"] = "GROUP_SIZE_QR2";
    data["שישיה"] = "GROUP_SIZE_QR3";
    data["חמישיה"] = "GROUP_SIZE_QR4";
    data["רביעיה"] = "GROUP_SIZE_QR5";
    data["שלישיה"] = "GROUP_SIZE_QR6";
    data["זוג"] = "GROUP_SIZE_QR7";

     return Bot.createQuickReplies(data);
}


function askForLocation(recipient) {
    FB.newSimpleMessage(recipient, "אנא הכנס מיקום מבוקש:").then(result => {
        let quick_answers = createLocationQR();
        FB.newSimpleMessage(recipient, "או בחר מיקום מהרשימה:", quick_answers)
    })
}

function askForGroupSize(recipient) {
    FB.newSimpleMessage(recipient, "אנא הכנס מספר אנשים:").then(result => {
        let quick_answers = createGroupSizeQR();
        FB.newSimpleMessage(recipient, "או בחר הרכב קבוצה מהרשימה:", quick_answers)
    })
}

function resetSession(recipient) {
    Bot.findOrCreateSession(recipient).then(sessionid => {

        let context = Bot.sessions[sessionid].context;
        delete context.location;
        delete context.num_of_people;
        delete context.room_list;
        delete context.room_id;
        Bot.createGeneralMenu(recipient).then(menu => {
            FB.newStructuredMessage(recipient, menu)
        })
    });
}



app.post('/webhook', function (req, res) {
    let entry = FB.getMessageEntry(req.body);
    res.sendStatus(200);
    let recipient = entry.sender.id;
    Bot.findOrCreateSession(recipient).then(sessionId => {

        let context = Bot.sessions[sessionId].context;
        if (entry && entry.postback) {
            if (context.is_started === undefined && entry.postback.payload === Config.GET_STARTED_PAYLOAD) {

                FB.getUserProfile(recipient).then(profile => {
                    sendStartMessages(entry, profile);
                });
                // if it is a location callback:
            } else if (entry.postback.payload === "SEARCH_BY_LOCATION") {
                context.state = "LOCATION";
                askForLocation(recipient);
            } else if (entry.postback.payload === "SEARCH_BY_GROUP_SIZE") {
                context.state = "GROUP_SIZE";
                askForGroupSize(recipient);
            } else if (entry.postback.payload === "NEW_SEARCH") {
                delete context.state;
                resetSession(recipient);
            } else if( entry.postback.payload.startsWith('MORE_INFO_')){
                let room_name = entry.postback.payload.substring('MORE_INFO_'.length);
                Bot.handleMoreInfo(recipient,room_name)
            }
        } else if (entry && entry.message && entry.message.quick_reply) {
            if (entry.message.quick_reply.payload.startsWith("LOCATION_QR")) {
                console.log("adding location: " + entry.message.text);
                context.location = entry.message.text;
                Bot.findEscapeRoomByContext(context).then(context => {
                    context.state = "";
                    Bot.displayResponse(recipient, context);

                }).catch(err => {
                    FB.newSimpleMessage(recipient, "לא הצלחתי למצוא חדרים במיקום המבוקש").then(r => {
                        askForLocation(recipient);
                    });
                });
            } else if (entry.message.quick_reply.payload.startsWith("GROUP_SIZE_QR")) {
                console.log("adding group size: " + entry.message.text);
                context.num_of_people = entry.message.text;
                Bot.findEscapeRoomByContext(context).then(context => {
                    context.state = "";
                   Bot.displayResponse(recipient, context);
                }).catch(err => {
                    let msg =  "לא הצלחתי למצוא חדרים ";
                    if(context.location) msg += "ב " + context.location;
                    msg += " לכמות האנשים המבוקשת";
                    FB.newSimpleMessage(recipient,msg).then(r => {
                      askForGroupSize(recipient);
                    })
                });
            }
        } else if (entry && entry.message) {
            if (entry.message.attachments) {
                // NOT SMART ENOUGH FOR ATTACHMENTS YET
                FB.newSimpleMessage(recipient, "זה מעניין!")
            } else {
                handleFBMessage(entry);
            }

        }


    });
});
