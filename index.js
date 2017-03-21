'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();
const Config = require('./config');
const FB = require('./connectors/facebook');
const Bot = require('./bot');
const emoji = require('node-emoji');
const DB = require('./connectors/mongoose');

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


function handleFBMessage(sessionId, context, entry) {
    let recipient = entry.sender.id;
    let message = entry.message.text;

    Bot.easterEggs(message).then(function (reply) {
        if (reply) {
            FB.newSimpleMessage(recipient, reply)
        } else {
            if (!isNaN(message)) {
                context.num_of_people = Number(message);
                Bot.findEscapeRoomByContext(context).then(function (new_context) {
                    if (new_context && new_context.room_list && new_context.room_list.length > 0) {
                        Bot.displayResponse(recipient, new_context);
                    }
                });
            }
            else {
                Bot.enrichFlags(context, message).then(enriched_context => {
                    Bot.findRoomByName(enriched_context.message).then(function (reply) {
                        if (reply && reply.length > 0) {
                            FB.newStructuredMessage(recipient, reply)
                        } else {
                            Bot.findRoomsByCompany(enriched_context, enriched_context.message).then(function (reply) {
                                if (reply && reply.length > 0) {
                                    enriched_context.company_name = message;
                                    enriched_context.room_list = reply;
                                    Bot.displayResponse(recipient, enriched_context);
                                } else {
                                    if (entry.message.text && entry.message.text.startsWith("חדר בריחה ")) {
                                        let maybe_room_name = entry.message.text.substring("חדר בריחה ".length);
                                        Bot.findRoomByName(maybe_room_name).then(function (reply) {
                                            if (reply && reply.length > 0) {
                                                FB.newStructuredMessage(recipient, reply)
                                            } else {
                                                Bot.read(sessionId, enriched_context, recipient, enriched_context.message)
                                           }
                                        });
                                    }
                                    else {
                                        Bot.read(sessionId, enriched_context, recipient, enriched_context.message)
                                    }
                                }
                            });
                        }
                    });
                });
            }
        }
    }).catch(err => {
        console.log(err);
        FB.newSimpleMessage(entry.sender.id, 'לא הצלחתי לענות על זה, אבל הנה דברים שאני כן יכול לענות עליהם!').then(ans => {
            Bot.drawMenu(context, entry);
        });
    });
}

function sendStartMessages(context, entry, profile) {
    setTimeout(function () {
        let recipient = entry.sender.id;
        FB.newSenderAction(recipient, Config.TYPING_OFF).then(_ => {

            let fname = profile.first_name || "בוטן";
            FB.newSimpleMessage(recipient, "שלום " + fname + "! אני בוט שיודע לתת מידע על חדרי בריחה בישראל").then(resp => {
                let message = "";
                if (profile.gender && profile.gender === "female") {
                    message = "את יכולה לשאול אותי מידע על חדרים, ולחפש חדרים על פי קריטריונים שונים"
                } else {
                    message = "אתה יכול לשאול אותי מידע על חדרים, ולחפש חדרים על פי קריטריונים שונים"
                }
                FB.newSimpleMessage(recipient, message).then(resp => {
                    setTimeout(function () {

                        let elements = [];

                        let videoItem = Bot.createVideoItem();
                        elements.push(videoItem);

                        FB.newStructuredMessage(recipient, elements).then(r => {

                            FB.newSimpleMessage(recipient, "בואו נתחיל!").then(r => {

                                Bot.drawMenu(recipient, context).then(res => {
                                    // Bot.sessions[sessionid].context.is_started = true;
                                })
                            });
                        });
                    }, 3000);
                });
            }, 3000);
        });
    });
}

function createLocationQR() {
    return new Promise(
        function (resolve) {

            let data = {};
            data["ב״שׁ"] = "LOCATION_QR1";
            data["דרום"] = "LOCATION_QR2";
            data["ראשון לציון"] = "LOCATION_QR3";
            data["ת״א"] = "LOCATION_QR4";
            data["מרכז"] = "LOCATION_QR5";
            data["חיפה"] = "LOCATION_QR6";
            data["צפון"] = "LOCATION_QR7";

            Bot.createQuickReplies(data,true).then(replies => {
                resolve(replies)
            });
        });
}

function createGroupSizeQR() {
    return new Promise(
        function (resolve) {

            let data = {};
            data["שמיניה"] = "GROUP_SIZE_QR1";
            data["שביעיה"] = "GROUP_SIZE_QR2";
            data["שישיה"] = "GROUP_SIZE_QR3";
            data["חמישיה"] = "GROUP_SIZE_QR4";
            data["רביעיה"] = "GROUP_SIZE_QR5";
            data["שלישיה"] = "GROUP_SIZE_QR6";
            data["זוג"] = "GROUP_SIZE_QR7";

            Bot.createQuickReplies(data).then(replies => {
                resolve(replies)
            });
        });
}

function createFiltersQR() {

    return new Promise(
        function (resolve) {

            let data = {};
            data["מתאימים למתחילים"] = "ROOM_FILTER_BEGINNER";
            data["מתאימים למנוסים"] = "ROOM_FILTER_EXPERIENCED";
            data["לקבוצות גדולות"] = "ROOM_FILTER_GROUP";
            data["לקבוצות גדולות"] = "ROOM_FILTER_GROUP";
            data["כפולים"] = "ROOM_FILTER_DOUBLE";
            data["מתאימים לילדים"] = "ROOM_FILTER_CHILDREN";
            data["מפחידים"] = "ROOM_FILTER_SCARY";
            data["מתאימים לנשים בהריון"] = "ROOM_FILTER_PREGNANT";
            data["מונגשים לנכים"] = "ROOM_FILTER_DISABLED";
            data["מותאמים לכבדי שמיעה"] = "ROOM_FILTER_HEARING";
            data["ליניאריים"] = "ROOM_FILTER_LINEAR";
            data["מקביליים"] = "ROOM_FILTER_PARALLEL";

            Bot.createQuickReplies(data).then(replies => {
                resolve(replies)
            });
        });

}

function createCompanyQR(context) {
    return new Promise(
        function (resolve) {

            DB.findCompaniesByContext(context).then(companies => {
                let data = {};

                if (companies && companies.length > 0) {
                    for (let key in companies) {
                        data[companies[key]] = "COMPANY_QR" + key;
                    }
                } else {
                    // show default companies
                    data["golden key"] = "COMPANY_QR1";
                    data["locked"] = "COMPANY_QR2";
                    data["rsq"] = "COMPANY_QR3";
                    data["portal y"] = "COMPANY_QR4";
                    data["inside out"] = "COMPANY_QR5";
                    data["escape city"] = "COMPANY_QR6";
                    data["questomania"] = "COMPANY_QR7";
                    data["escaperoom israel"] = "COMPANY_QR8";
                    data["brainit"] = "COMPANY_QR9";
                    data["out of the box"] = "COMPANY_QR10";
                    data["exit room"] = "COMPANY_QR11";
                }

                Bot.createQuickReplies(data).then(replies => {
                    resolve(replies)
                });
            });
        });
}


function askForLocation(recipient) {
    FB.newSimpleMessage(recipient, "אנא הכנס מיקום מבוקש:").then(result => {
        createLocationQR().then(quick_answers => {
            FB.newSimpleMessage(recipient, "או בחר מיקום מהרשימה:", quick_answers)
        });
    })
}

function askForGroupSize(recipient) {
    FB.newSimpleMessage(recipient, "אנא הכנס מספר אנשים:").then(result => {
        createGroupSizeQR().then(quick_answers => {
            FB.newSimpleMessage(recipient, "או בחר הרכב קבוצה מהרשימה:", quick_answers)
        });
    })
}

function askForCompany(recipient, context) {
    FB.newSimpleMessage(recipient, "אנא הכנס שם של חברת חדרי בריחה:").then(result => {
        createCompanyQR(context).then(quick_answers => {
            FB.newSimpleMessage(recipient, "או בחר חברה מהרשימה:", quick_answers)
        });
    })
}

function askForMoreFilters(recipient, context) {
    createFiltersQR(context).then(quick_answers => {
        FB.newSimpleMessage(recipient, "מצא חדרים:", quick_answers)
    })
}


function resetSession(context, recipient) {
    delete context.location;
    delete context.num_of_people;
    delete context.room_list;
    delete context.room_id;
    delete context.company_name;
    delete context.lat;
    delete context.lon;
    delete context.is_for_pregnant;
    delete context.is_for_disabled;
    delete context.is_for_hearing_impaired;
    delete context.is_for_children;
    delete context.is_credit_card_accepted;
    delete context.is_scary;
    delete context.is_beginner;
    delete context.is_linear;
    delete context.is_parallel;
    delete context.is_double;
    delete context.is_for_groups;


    Bot.createGeneralMenu(context).then(menu => {
        FB.newStructuredMessage(recipient, menu)
    })
}


app.post('/webhook', function (req, res) {
    let entry = FB.getMessageEntry(req.body);
    res.sendStatus(200);
    let recipient = entry.sender.id;
    FB.newSenderAction(recipient, Config.MARK_SEEN).then(_ => {
        FB.newSenderAction(recipient, Config.TYPING_ON).then(_ => {
            Bot.findOrCreateSession(recipient).then(sessionId => {

                let context = Bot.sessions[sessionId].context;
                if (entry && entry.postback) {
                    if (context.is_started === undefined && entry.postback.payload === Config.GET_STARTED_PAYLOAD) {

                        FB.getUserProfile(recipient).then(profile => {
                            sendStartMessages(context, entry, profile);
                        });
                        // if it is a location callback:
                    } else if (entry.postback.payload === "SEARCH_BY_LOCATION") {
                        context.state = "LOCATION";
                        askForLocation(recipient);
                    } else if (entry.postback.payload === "SEARCH_BY_GROUP_SIZE") {
                        context.state = "GROUP_SIZE";
                        askForGroupSize(recipient);
                    } else if (entry.postback.payload === "SEARCH_BY_COMPANY") {
                        context.state = "SEARCH_BY_COMPANY";
                        askForCompany(recipient, context);
                    } else if (entry.postback.payload === "MORE_FILTERS") {
                        context.state = "MORE_FILTERS";
                        askForMoreFilters(recipient, context);
                    } else if (entry.postback.payload.startsWith('MORE_INFO_')) {
                        FB.newSenderAction(recipient, Config.MARK_SEEN).then(_ => {
                            FB.newSenderAction(recipient, Config.TYPING_ON).then(_ => {

                                let room_name = entry.postback.payload.substring('MORE_INFO_'.length);
                                Bot.handleMoreInfo(context, recipient, room_name)
                            });
                        });
                    } else if (entry.postback.payload.startsWith('MORE_ROOMS_')) {
                        setTimeout(function () {
                            FB.newSenderAction(recipient, Config.TYPING_OFF).then(_ => {
                                let slice_index = entry.postback.payload.substring('MORE_ROOMS_'.length);
                                if (context.room_list) {
                                    if (context.room_list.length - slice_index === 1) {
                                        FB.newStructuredMessage(recipient, context.room_list.slice(slice_index))
                                    } else {
                                        FB.newListMessage(recipient, context.room_list, Number(slice_index))
                                    }
                                }
                            }, 5000)
                        });
                    } else if (entry.postback.payload === 'MORE_SEARCH_OPTIONS') {
                        setTimeout(function () {
                            FB.newSimpleMessage(recipient, "בחר האם לצמצם את החיפוש:").then(r => {
                                Bot.createGeneralMenu(context).then(menu => {
                                    FB.newStructuredMessage(recipient, menu);
                                });
                            })
                        }, 3000);

                    } else if (entry.postback.payload === 'NEW_SEARCH' || entry.postback.payload === 'START_NEW_SEARCH') {
                        setTimeout(function () {
                            FB.newSimpleMessage(recipient, "חיפוש חדש:").then(r => {
                                delete context.state;
                                resetSession(context, recipient);
                            })
                        }, 3000);
                    } else if (entry.postback.payload === 'HELP') {
                        setTimeout(function () {
                            let elements = [];

                            let videoItem = Bot.createVideoItem();
                            elements.push(videoItem);

                            FB.newStructuredMessage(recipient, elements).then(r => {

                            });
                        }, 3000);
                    }
                    } else if (entry && entry.message && entry.message.quick_reply) {
                    if (entry.message.quick_reply.payload.startsWith("LOCATION_QR")) {
                        console.log("adding location: " + entry.message.text);
                        context.location = entry.message.text;
                        delete context.lat;
                        delete context.lon;

                        Bot.findEscapeRoomByContext(context).then(context => {
                            context.state = "";
                            if(context && context.room_list && context.room_list.length > 0){
                                Bot.displayResponse(recipient, context);
                            }

                        }).catch(err => {
                            Bot.displayErrorMessage(recipient, context).then(r => {
                                askForLocation(recipient);
                            });
                        });
                    } else if (entry.message.quick_reply.payload.startsWith("GROUP_SIZE_QR")) {
                        console.log("adding group size: " + entry.message.text);
                        context.num_of_people = entry.message.text;
                        Bot.findEscapeRoomByContext(context).then(context => {
                            context.state = "";
                            if(context && context.room_list && context.room_list.length > 0){
                                Bot.displayResponse(recipient, context);
                            }
                        }).catch(err => {
                            Bot.displayErrorMessage(recipient, context).then(r => {
                                askForGroupSize(recipient);
                            })
                        });
                    } else if (entry.message.quick_reply.payload.startsWith("COMPANY_QR")) {
                        console.log("adding company: " + entry.message.text);
                        context.company_name = entry.message.text;
                        Bot.findEscapeRoomByContext(context).then(context => {
                            context.state = "";
                            if(context && context.room_list && context.room_list.length > 0){
                                Bot.displayResponse(recipient, context);
                            }
                        }).catch(err => {
                            Bot.displayErrorMessage(recipient, context).then(r => {
                                askForCompany(recipient);
                            })
                        });
                    } else if (entry.message.quick_reply.payload.startsWith("MORE_INFO2_")) {
                        FB.newSenderAction(recipient, Config.MARK_SEEN).then(_ => {
                            FB.newSenderAction(recipient, Config.TYPING_ON).then(_ => {

                                let room_name = entry.message.quick_reply.payload.substring("MORE_INFO2_".length);
                                Bot.handleMoreInfo2(context, recipient, room_name)
                            });
                        });
                    } else if (entry.message.quick_reply.payload.startsWith("ROOM_FILTER_")) {
                        FB.newSenderAction(recipient, Config.MARK_SEEN).then(_ => {
                            FB.newSenderAction(recipient, Config.TYPING_ON).then(_ => {
                                let filter = entry.message.quick_reply.payload.substring("ROOM_FILTER_".length);

                                if (filter === "PARALLEL") {
                                    context.is_parallel = true;
                                } else if (filter === "LINEAR") {
                                    context.is_linear = true;
                                } else if (filter === "HEARING") {
                                    context.is_for_hearing_impaired = true;
                                } else if (filter === "DISABLED") {
                                    context.is_for_disabled = true;
                                } else if (filter === "PREGNANT") {
                                    context.is_for_pregnant = true;
                                } else if (filter === "SCARY") {
                                    context.is_scary = true;
                                } else if (filter === "CHILDREN") {
                                    context.is_for_children = true;
                                } else if (filter === "BEGINNER") {
                                    context.is_beginner = true;
                                } else if (filter === "EXPERIENCED") {
                                    context.is_beginner = false;
                                } else if (filter === "DOUBLE") {
                                    context.is_double = true;
                                } else if (filter === "GROUP"){
                                   context.is_for_groups = true;
                                }

                                Bot.findEscapeRoomByContext(context).then(context => {
                                    context.state = "";
                                    if(context.room_list && context.room_list.length > 0){
                                        Bot.displayResponse(recipient, context);
                                    } else {
                                        Bot.displayErrorMessage(recipient, context).then(r => {
                                            Bot.drawMenu(context, entry);
                                        });
                                    }

                                }).catch(err => {
                                    Bot.displayErrorMessage(recipient, context).then(r => {
                                        Bot.drawMenu(context, entry);
                                    });
                                });
                            });
                        });
                    }
                } else if (entry && entry.message) {
                    if(entry.message.text && entry.message.text === "חיפוש חדש") {
                        setTimeout(function () {
                            FB.newSimpleMessage(recipient, "חיפוש חדש:").then(r => {
                                delete context.state;
                                resetSession(context, recipient);
                            })
                        }, 3000);

                    } else if (entry.message.attachments) {
                        if (entry.message.attachments[0] && entry.message.attachments[0].payload && entry.message.attachments[0].payload.coordinates) {
                            let lat = entry.message.attachments[0].payload.coordinates.lat;
                            let lon = entry.message.attachments[0].payload.coordinates.long;
                            console.log("received user location: " + lat + "," + lon);
                            context.lat = lat;
                            context.lon = lon;
                            delete context.location;
                            Bot.findEscapeRoomByContext(context).then(context => {
                                context.state = "";
                                if(context.room_list && context.room_list.length > 0){
                                    Bot.displayResponse(recipient, context);
                                } else {
                                    Bot.displayErrorMessage(recipient, context).then(r => {
                                        Bot.drawMenu(context, entry);
                                    });
                                }
                            }).catch(err => {
                                Bot.displayErrorMessage(recipient, context).then(r => {
                                    askForLocation(recipient);
                                });
                            });
                        } else {
                            // NOT SMART ENOUGH FOR ATTACHMENTS YET
                            FB.newSimpleMessage(recipient, "זה מעניין!")
                        }
                    } else {
                        handleFBMessage(sessionId, context, entry);
                    }

                }


            });
        });
    });
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


