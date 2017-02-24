'use strict'

const Config = require('./config');
const emoji = require('node-emoji');
const Wit = require('node-wit').Wit;
const DB = require('./connectors/mongoose');
const FB = require('./connectors/facebook');


// LETS SAVE USER SESSIONS
const sessions = {};

function findOrCreateSession(fbid) {
    return new Promise(
        function (resolve, reject) {

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

            return resolve(sessionId);
        });
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

            if (context.room_list && context.room_list.length > 0) {
                displayResponse(recipientId, context)
            } else {
                generateErrorMsg(context).then(error_msg => {
                    FB.newSimpleMessage(recipientId, error_msg).then(res => {
                        FB.newSimpleMessage(recipientId, 'לא הצלחתי לענות על זה, אבל הנה דברים שאני כן יכול לענות עליהם!').then(ans => {
                            drawMenu(recipientId, context);
                        });
                    });
                });
            }
            sessions[sessionId].context = context;
            // DO NOT RETURN CONTEXT
            return resolve();
        });

    },


    findEscapeRoom({context, entities}) {
        return new Promise(function (resolve,reject) {
            let location = firstEntityValue(entities, 'location');
            let num_of_people = firstEntityValue(entities, 'math_expression');

            console.log("wit received: " + location);
            console.log("wit received: " + num_of_people);



            if(location) {
                context.location = location;
            }
            if(num_of_people){
                context.num_of_people = num_of_people;
            }

            return resolve(findEscapeRoomByContext(context))

        });
    }
};

const WIT_TOKEN = Config.WIT_TOKEN;

const wit = new Wit({
    accessToken: WIT_TOKEN,
    actions
});


function read(sender, message) {
    return new Promise(
        function (resolve, reject) {

            // Let's find the user
            findOrCreateSession(sender).then(sessionId => {

                // Let's forward the message to the Wit.ai bot engine
                // This will run all actions until there are no more actions left to do
                wit.runActions(
                    sessionId, // the user's current session
                    message, // the user's message
                    sessions[sessionId].context // the user's current session state
                ).then((context) => {
                    // delete context.location;
                    // delete context.room_list;
                    // Our bot did everything it has to do.
                    // Now it's waiting for further messages to proceed.
                    console.log('Waiting for next user messages');

                    // Updating the user's current session state
                    // sessions[sessionId].context = context;
                    return resolve()
                }).catch((err) => {
                    console.error('Oops! Got an error from Wit: ', err.stack || err);
                    FB.newSimpleMessage(sender, 'לא הצלחתי לענות על זה, אבל הנה דברים שאני כן יכול לענות עליהם!').then(ans => {
                        createGeneralMenu(sender).then(menu => {
                            FB.newStructuredMessage(sender, menu);
                        })
                    })
                })
            });
        });
}

function easterEggs(message) {
    return new Promise(
        function (resolve,reject) {

            if (message == "אוינק") {
                return resolve(emoji.emojify(':pig_nose: :pig_nose: :pig_nose:'))
            } else {
                DB.findEasterEgg(message).then(function (response) {
                    if (response) {
                        return resolve(response);
                    } else {
                        return resolve(undefined);
                    }
                }).catch(function(err) {
                   return reject(err);
                });
            }
        });
}

function findRoomByName(message) {
    return new Promise(
        function (resolve,reject) {

            DB.findRoomByName(message).then(function (response) {
                if (response) {
                    return resolve(createRoomsList(response));
                } else {
                    return resolve(undefined);
                }
            }).catch(function (err) {
                return reject(err);
            });
        });
}

function findRoomsByCompany(message) {
    return new Promise(
        function (resolve, reject) {

            DB.findRoomsByCompany(message).then(function (response) {
                if (response) {
                    return resolve(createRoomsList(response));
                } else {
                    return resolve(undefined);
                }
            }).catch(function (err) {
                return reject(err);
            });
        });
}

function findEscapeRoomByContext(context) {
        return new Promise(
            function (resolve, reject) {
                DB.findRoomInDb(context).then(response => {
                    context.room_list = createRoomsList(response);
                    return resolve(context);

                }).catch(function (err) {
                    return reject(err);
                });
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
                info_button = {
                    title: 'עוד מידע',
                    type: 'postback',
                    payload: "MORE_INFO_" +  response[i].room_name
                },
                buttons = [url_button,info_button],
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

function createMenuItem(title, payload) {
    let postback_button = {
            title: title,
            type: 'postback',
            payload: payload
        }, buttons = [postback_button],

        element = {
            title: title,
            buttons: buttons,
        };

    return element;
}

function createMenu(data){
    let list = [];
    if (data) {
        for(let key in data){
            list.push(createMenuItem(key,data[key]));
        }
    }
    return list
}

function createQuickReply(title,payload){
    return {
        content_type:"text",
        title: title,
        payload: payload
    }
}

function createQuickReplies(data){
    if(data) {

        let replies_list = [];
        for (let key in data) {
            replies_list.push(createQuickReply(key, data[key]))
        }

        return replies_list;
    } else return undefined;
}

function createGeneralMenu(recipient) {
    return new Promise(
        function (resolve, reject) {

            findOrCreateSession(recipient).then(sessionId => {
                let context = sessions[sessionId].context;
                let data = {};
                // data["חיפוש לפי שם חדר"] = "SEARCH_BY_ROOM_NAME";
                // data["חיפוש לפי חברה של חדרים"] = "SEARCH_BY_COMPANY";
                if (!context.location) {
                    data["חיפוש לפי מיקום"] = "SEARCH_BY_LOCATION";
                }
                if (!context.num_of_people || context.num_of_people < 2) {
                    data["חיפוש לפי גודל קבוצה"] = "SEARCH_BY_GROUP_SIZE";
                }
                data["חיפוש חדש"] = "NEW_SEARCH";
                return resolve(createMenu(data));
            });
        });
}


function generateErrorMsg(context) {
    return new Promise(
        function (resolve,reject) {

            if (context.location) {
                DB.findErrorMessage('location').then( function (response) {
                    if (response) {
                        let msg = response[0].A.replace('<>', context.location);
                        return resolve(msg);
                    } else {
                        return resolve('לא הבנתי את כוונתך, אנא נסה שוב');
                    }
                }).catch(function (err) {
                    return reject(err);
                });
            } else if (!context.location) {
                return resolve('התפזרו לי קצת הבוטנים, חסר לי מיקום בשביל לאתר את מה שביקשת');
            } else {
                return resolve('לא הבנתי את כוונתך, אנא נסה שוב');
            }
        });
}

function drawMenu(recipient,context) {
    return new Promise(
        function (resolve) {
            createGeneralMenu(recipient).then(menu => {
            FB.newStructuredMessage(recipient, menu);
            return resolve(menu)
            })
        });
}
function displayResponse(recipient, context) {
    let msg = "הנה רשימה של חדרים ";

    if (context.location) {
        msg += "ב" + context.location;
    } else msg += " בכל הארץ ";
    if (context.num_of_people && !(context.num_of_people === 1)) {
        msg += " ל" + context.num_of_people + " אנשים"
    }
    FB.newSimpleMessage(recipient, msg).then(r => {

        FB.newStructuredMessage(recipient, context.room_list).then(r => {
            FB.newSimpleMessage(recipient, "בחר האם לצמצם את החיפוש או להתחיל חיפוש חדש:").then(r => {
                createGeneralMenu(recipient).then(menu => {
                    FB.newStructuredMessage(recipient,menu);
                })
            })
        })
    })
}

function handleMoreInfo(recipient,room_name){
    return new Promise(
        function (resolve) {
            findOrCreateSession(recipient).then(sessionId => {

                let context = sessions[sessionId].context;
                context.room_name = room_name;
                let msg = "בקרוב אתן מידע מפורט על החדר " + room_name;
                FB.newSimpleMessage(recipient,msg);
                resolve(context)
            });



            });
}



module.exports = {
    sessions: sessions,
    findOrCreateSession: findOrCreateSession,
    read: read,
    easterEggs: easterEggs,
    findRoomByName: findRoomByName,
    findRoomsByCompany: findRoomsByCompany,
    findEscapeRoomByContext: findEscapeRoomByContext,
    createQuickReplies: createQuickReplies,
    createMenu: createMenu,
    createGeneralMenu: createGeneralMenu,
    drawMenu: drawMenu,
    displayResponse: displayResponse,
    handleMoreInfo: handleMoreInfo
};

