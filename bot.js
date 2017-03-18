'use strict'

const Config = require('./config');
const emoji = require('node-emoji');
const Wit = require('node-wit').Wit;
const DB = require('./connectors/mongoose');
const FB = require('./connectors/facebook');
const TinyURL = require('tinyurl');
const GeoPoint = require('geopoint');



// LETS SAVE USER SESSIONS
const sessions = {};

function findOrCreateSession(fbid) {
    return new Promise(
        function (resolve, reject) {

            let sessionId;

            // DOES USER SESSION ALREADY EXIST?
            Object.keys(sessions).forEach(k => {
                if (sessions[k].fbid === fbid
                ) {
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
                return reject();
            }
            sessions[sessionId].context = context;
            // DO NOT RETURN CONTEXT
            return resolve();
        });

    },


    findEscapeRoom({sessionId,context, entities}) {
        return new Promise(function (resolve, reject) {
            let location = firstEntityValue(entities, 'location');
            let num_of_people = firstEntityValue(entities, 'math_expression');
            let local_search_query = firstEntityValue(entities, 'local_search_query');

            if(local_search_query && location === null) location = local_search_query;

            console.log("wit received: " + location);
            console.log("wit received: " + num_of_people);


            if (location) {
                delete context.lat;
                delete context.lon;
                context.location = location;
            }
            if (num_of_people) {
                context.num_of_people = num_of_people;
            }

            sessions[sessionId].context = context;

            return resolve(findEscapeRoomByContext(context))

        });
    }
};

const WIT_TOKEN = Config.WIT_TOKEN;

const wit = new Wit({
    accessToken: WIT_TOKEN,
    actions
});


function read(sessionId,context,sender, message) {
    return new Promise(
        function (resolve, reject) {

            // Let's find the user

                // Let's forward the message to the Wit.ai bot engine
                // This will run all actions until there are no more actions left to do
                wit.runActions(
                    sessionId, // the user's current session
                    message, // the user's message
                    context // the user's current session state
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
                    if (err) {
                        console.error('Oops! Got an error from Wit: ', err.stack || err);
                    }
                    setTimeout(function () {
                        FB.newSenderAction(sender, Config.TYPING_OFF).then(_ => {
                            let new_context = sessions[sessionId].context;
                            displayErrorMessage(sender,new_context).then(ans => {
                                createGeneralMenu(new_context).then(menu => {
                                    FB.newStructuredMessage(sender, menu);
                                })
                            })
                        }, 3000);
                    })
                })
        });
}

function easterEggs(message) {
    return new Promise(
        function (resolve, reject) {

            if (message == "אוינק") {
                return resolve(emoji.emojify(':pig_nose: :pig_nose: :pig_nose:'))
            } else {
                DB.findEasterEgg(message).then(function (response) {
                    if (response) {
                        return resolve(response);
                    } else {
                        return resolve(undefined);
                    }
                }).catch(function (err) {
                    return reject(err);
                });
            }
        });
}


function enrichFlags(context,message) {
    return new Promise(
        function (resolve) {

            if(message.includes("הריון")){
                console.log("הריון");
                context.is_for_pregnant = true;
                // message.replace("הריון","");
            }
            if(message.includes("נכים") || message.includes("מוגבלויות") || message.includes("נגיש")){
                console.log("נכים");
                context.is_for_disabled = true;
                // message.replace("נכים","");
                // message.replace("מוגבלויות","");
                // message.replace("נגיש","");
            }

            if(message.includes("שמיעה") || message.includes("כבדי שמיעה")){
                console.log("שמיעה");
                context.is_for_hearing_impaired = true;
                // message.replace("כבדי שמיעה","");
                // message.replace("שמיעה","");
            }

            if(message.includes("ילדים") || message.includes("משפחה")){
                console.log("ילדים");
                context.is_for_children = true;
                // message.replace("ילדים","");
            }

            if(message.includes("מבוגרים")){
                console.log("מבוגרים");
                context.is_for_children = false;
                // message.replace("מבוגרים","");
            }

            if(message.includes("אשראי")){
                console.log("אשראי");
                context.is_credit_card_accepted = true;
                // message.replace("אשראי","");
            }

            if(message.includes("לא מפחיד")){
                console.log("לא מפחיד");
                context.is_scary = false;
                // message.replace("לא מפחיד","");
            }
            if(message.includes("מפחיד")){
                console.log("מפחיד");
                context.is_scary = true;
                // message.replace("מפחיד","");
            }
            if(message.includes("מתחילים")){
                console.log("מתחילים");
                context.is_beginner = true;
                // message.replace("מתחילים","");
            }
            if(message.includes("מנוסים")){
                console.log("מנוסים");
                context.is_beginner = false;
                // message.replace("מנוסים","");
            }

            if(message.includes("ליניארי") || message.includes("לינארי") ){
                console.log("ליניארי");
                context.is_linear = true;
                // message.replace("ליניארי","");
                // message.replace("לינארי","");
            }

            if(message.includes("מקבילי")){
                console.log("מקבילי");
                context.is_parallel = false;
                // message.replace("מקבילי","");
            }

            context.message = message;
            resolve(context)

        });
}


function findRoomByName(context,message) {
    return new Promise(
        function (resolve, reject) {

            DB.findRoomByName(context,message).then(function (response) {
                if (response) {
                    return resolve(createRoomsList(context,response,true));
                } else {
                    return resolve(undefined);
                }
            }).catch(function (err) {
                return reject(err);
            });
        });
}

function findRoomsByCompany(context,message) {
    return new Promise(
        function (resolve, reject) {

            DB.findRoomsByCompany(context,message).then(function (response) {
                if (response) {
                    return resolve(createRoomsList(context,response,true));
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
                if(response){
                    context.room_list = createRoomsList(context,response,true);
                } else {
                    context.room_list = undefined;
                }
                return resolve(context)
            }).catch(function (err) {
                return reject(err);
            });
        })
}

function createRoomsList(context,response) {
    let list = [];

    if (response) {
        for (let i = 0; i < response.length; i++) {
            let geo_distance = undefined;
            if(context.lat && context.lon){
                let point1 = new GeoPoint(response[i].latitude,response[i].longitude);
                let point2 = new GeoPoint(context.lat,context.lon);
                geo_distance = point1.distanceTo(point2, true);
                geo_distance = +geo_distance.toFixed(1);
            }

            let subtitle = "";
            if(geo_distance){
                subtitle += geo_distance + " ק״מ" + "\n"
            }
            subtitle += response[i].address + "\n" + " טל׳: " + response[i].phone;

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
                    payload: "MORE_INFO_" + response[i].room_id
                },
                nav_button = {
                    title: 'נווט עם waze',
                    type: 'web_url',
                    url: response[i].waze_link
                },
                buttons = [info_button],
               default_action = {
                    type: 'web_url',
                    url: response[i].website || "",
                    messenger_extensions: false,
                    webview_height_ratio: 'tall'
                },

                element = {
                    title: response[i].room_name[0],
                    subtitle: subtitle,
                    buttons: buttons,
                    default_action: default_action

                };

            list.push(element);
            // });
        }
    }
    return list
}

function createMenuItem(title, payload, image_url) {
    let postback_button = {
            title: title,
            type: 'postback',
            payload: payload
        }, buttons = [postback_button],

        element = {
            title: title,
            buttons: buttons,
        };

    if (image_url) {
        element.image_url = image_url;
    }

    return element;
}

function createMapItem(address) {
    return {
        title: "מפה:",
        image_url: "https:\/\/maps.googleapis.com\/maps\/api\/staticmap?size=764x400&center=" + encodeURI(address) + "&zoom=16&language=he&markers=size:mid%7Ccolor:0xff0000%7Clabel:1%7C" + encodeURI(address),
        item_url: "https:\/\/www.google.com\/maps\/place\/" + address
    }
}

function createHashtagItem(hashtag) {
    return {
        title: "לביקורות על החדר בקבוצת האסקייפרים: " + hashtag,
        image_url: "https://s12.postimg.org/a73x9s2fx/roomescape.jpg",
        item_url: "https:\/\/www.facebook.com\/hashtag\/" + hashtag.substring(1)
    }
}

function createVideoItem() {
    return {
        title: "סרטון הדרכה קצר על הבוט: ",
        image_url: "https://s29.postimg.org/989go7hwn/16422306_212997062506914_6981554859388634041_o.jpg",
        item_url: "https:\/\/www.facebook.com\/escaperoombot\/videos\/233950753744878\/"
    }
}


function createWazeItem(url) {
    return {
        title: "לינק לwaze:",
        image_url: "https://s14.postimg.org/ui4kd6j8h/Waze_logo.jpg",
        item_url: url
    }
}


function createMenu(data, images) {
    let list = [];
    if (data) {
        for (let key in data) {
            list.push(createMenuItem(key, data[key], images[key]));
        }
    }
    return list
}

function createQuickReply(title, payload) {
    return {
        content_type: "text",
        title: title,
        payload: payload
    }
}


function createLocationQuickReply() {
    return {
        content_type: "location",
    }
}


function createQuickReplies(data,is_location) {
    return new Promise(
        function (resolve) {

            if (data) {

                let replies_list = [];
                if (is_location && is_location === true) {
                    replies_list.push(createLocationQuickReply())
                }

                for (let key in data) {
                    replies_list.push(createQuickReply(key, data[key]))
                }


                resolve(replies_list);
            } else resolve(undefined);
        });
}

function createGeneralMenu(context) {
    return new Promise(
        function (resolve, reject) {

                let data = {};
                let images = {};

                if (!context.location && !context.lat && !context.lon) {
                    data["חיפוש לפי מיקום"] = "SEARCH_BY_LOCATION";
                    images["חיפוש לפי מיקום"] = 'https://s21.postimg.org/iz4j6h3xz/globe_1290377_640.jpg';
                }
                if (!context.num_of_people || context.num_of_people < 2) {
                    data["חיפוש לפי גודל קבוצה"] = "SEARCH_BY_GROUP_SIZE";
                    images["חיפוש לפי גודל קבוצה"] = 'https://s23.postimg.org/9dm2s2i6z/people_467438_640.jpg';

                }
                if(!context.company_name) {
                    data["חיפוש לפי חברה"] = "SEARCH_BY_COMPANY";
                    images["חיפוש לפי חברה"] = "https://s12.postimg.org/caf2xxbtp/lock_1673604_640.jpg"
                }

                data["סינונים נוספים"] = "MORE_FILTERS";
                images["סינונים נוספים"] = "https://s22.postimg.org/3nxe2ovq9/labyrinth_2037903_640.jpg";


            data["חיפוש חדש"] = "NEW_SEARCH";
                images["חיפוש חדש"] = 'https://s8.postimg.org/hmfkndsit/glass_2025715_640.png';

                return resolve(createMenu(data, images));
        });
}




function drawMenu(recipient) {
    return new Promise(
        function (resolve) {
            setTimeout(function () {
                FB.newSenderAction(recipient, Config.TYPING_OFF).then(_ => {

                    createGeneralMenu(recipient).then(menu => {
                        FB.newStructuredMessage(recipient, menu);
                        return resolve(menu)
                    })
                }, 3000);
            });
        });
}

function displayResponse(recipient, context) {
        setTimeout(function() {
        FB.newSenderAction(recipient,Config.TYPING_OFF).then(_ => {

            let msg = "הנה רשימה של חדרים";

            if (context.is_beginner) {
                let bool = Boolean(context.is_beginner);
                msg += ", ";
                if (!bool) {
                    msg += "מתאימים למנוסים";
                } else {
                    msg += "מתאימים למתחילים";
                }
            }

            if (context.is_for_children) {
                let bool = Boolean(context.is_for_children);
                msg += ", ";
                if (!bool) msg += " לא ";
                msg += "מתאימים לילדים";
            }

            if (context.is_scary) {
                let bool = Boolean(context.is_scary);
                msg += ", ";
                if (!bool) msg += " לא ";
                msg += "מפחידים";
            }

            if (context.is_double) {
                let bool = Boolean(context.is_double);
                msg += ", ";
                if (!bool) msg += " לא ";
                msg += "כפולים";
            }

            if (context.is_for_pregnant) {
                let bool = Boolean(context.is_for_pregnant);
                msg += ", ";
                if (!bool) msg += " לא ";
                msg += "מתאימים לנשים בהריון";
            }

            if (context.is_for_disabled) {
                let bool = Boolean(context.is_for_disabled);
                msg += ", ";
                if (!bool) msg += " לא ";
                msg += "מונגשים לנכים";
            }

            if (context.is_for_hearing_impaired) {
                let bool = Boolean(context.is_for_hearing_impaired);
                msg += ", ";
                if (!bool) msg += " לא ";
                msg += "מונגשים לכבדי שמיעה ";
            }

            if (context.is_credit_card_accepted) {
                let bool = Boolean(context.is_credit_card_accepted);
                msg += ", ";
                if (!bool) msg += " לא ";
                msg += "ניתן לשלם באשראי";
            }

            if (context.is_linear) {
                let bool = Boolean(context.is_linear);
                msg += ", ";
                if (!bool) msg += " לא ";
                msg += "ליניאריים";
            }


            if (context.is_parallel) {
                let bool = Boolean(context.is_parallel);
                msg += ", ";
                if (!bool) msg += " לא ";
                msg += "מקביליים";
            }

            if (context.company_name) {
                msg += " של חברת " + context.company_name;
            }
            if (context.location) {
                msg += " ב" + context.location;
            } else if (context.lat && context.lon) {
                msg += " סביב המיקום שלך"
            } else msg += " בכל הארץ ";
            if (context.num_of_people && !(context.num_of_people === 1)) {
                msg += " ל" + context.num_of_people + " אנשים"
            }
            msg = msg.replace(", "," ");
            FB.newSimpleMessage(recipient, msg).then(r => {
                    if(context.room_list && context.room_list.length == 1){
                        FB.newStructuredMessage(recipient, context.room_list).then(r => {
                            // setTimeout(function() {FB.newSimpleMessage(recipient, "בחר האם לצמצם את החיפוש או להתחיל חיפוש חדש:").then(r => {
                            //     createGeneralMenu(recipient).then(menu => {
                            //         FB.newStructuredMessage(recipient, menu);
                            //     })
                            // }) }, 3000);
                        })
                    } else {

                        FB.newListMessage(recipient, context.room_list,0).then(r => {
                            // setTimeout(function() {FB.newSimpleMessage(recipient, "בחר האם לצמצם את החיפוש או להתחיל חיפוש חדש:").then(r => {
                            //     createGeneralMenu(recipient).then(menu => {
                            //         FB.newStructuredMessage(recipient, menu);
                            //     })
                            // }) }, 3000);
                        })
                    }
                })
            }, 5000);
        });

}

function displayErrorMessage(recipient, context) {
    return new Promise(
        function (resolve) {

            setTimeout(function () {
            FB.newSenderAction(recipient, Config.TYPING_OFF).then(_ => {

                    let msg = "לא הצלחתי למצוא חדרים ";

                    if (context.company_name) {
                        msg += "של חברת " + context.company_name + " ";
                    }
                    if (context.location) {
                        msg += "ב" + context.location;
                    } else msg += " בכל הארץ ";
                    if (context.num_of_people && !(context.num_of_people === 1)) {
                        msg += " ל" + context.num_of_people + " אנשים"
                    }
                    msg += " נסה שוב או התחל חיפוש חדש";
                    FB.newSimpleMessage(recipient, msg).then(r => {
                        return resolve(context)
                    })
                }, 5000)
            });
        });
}

function average(arr) {
    let sum = 0;
    for (let key in arr) {
        sum += arr[key];
    }
    return Math.round(sum / arr.length);
}

function calculateAveragePrice(room, isWeekend) {
    if (!isWeekend) {
        let prices = [];
        if (room.price_1) prices.push(room.price_1);
        if (room.price_2) prices.push(room.price_2);
        if (room.price_3) prices.push(room.price_3);
        if (room.price_4) prices.push(room.price_4);
        if (room.price_5) prices.push(room.price_5);
        if (room.price_6) prices.push(room.price_6);
        if (room.price_7) prices.push(room.price_7);
        if (room.price_8) prices.push(room.price_8);
        if (room.price_9) prices.push(room.price_9);
        return average(prices)
    } else {
        let prices = [];
        if (room.weekend_price_1) prices.push(room.weekend_price_1);
        if (room.weekend_price_2) prices.push(room.weekend_price_2);
        if (room.weekend_price_3) prices.push(room.weekend_price_3);
        if (room.weekend_price_4) prices.push(room.weekend_price_4);
        if (room.weekend_price_5) prices.push(room.weekend_price_5);
        if (room.weekend_price_6) prices.push(room.weekend_price_6);
        if (room.weekend_price_7) prices.push(room.weekend_price_7);
        if (room.weekend_price_8) prices.push(room.weekend_price_8);
        if (room.weekend_price_9) prices.push(room.weekend_price_9);
        return average(prices)
    }

}

function handleMoreInfo(context, recipient, room_id) {
    return new Promise(
        function (resolve) {
            setTimeout(function () {
                FB.newSenderAction(recipient, Config.TYPING_OFF).then(_ => {

                    context.room_id = room_id;
                    DB.findRoomById(room_id).then(room => {
                        // let elements = [];
                        // let mapItem = createMapItem(room.address);
                        // elements.push(mapItem);
                        //
                        // FB.newStructuredMessage(recipient, elements).then(r => {
                        let elements = [];

                        let hashtagItem = createHashtagItem(room.hashtag);
                        elements.push(hashtagItem);

                        FB.newStructuredMessage(recipient, elements).then(r => {
                            setTimeout(function () {

                                let msg_list = [];
                                if (room.number_of_same_rooms) {
                                    msg_list.push("זהו חדר כפול")
                                }

                                if (context.num_of_people > 1 && context.num_of_people < 10) {
                                    msg_list.push("לקבוצה של " + context.num_of_people + ": ");
                                    msg_list.push("מחיר לשחקן באמצע שבוע: " + room['price_' + context.num_of_people] + " שקלים");
                                    msg_list.push("מחיר לשחקן בסוף שבוע: " + room['weekend_price_' + context.num_of_people] + " שקלים")
                                } else {
                                    msg_list.push("מחיר ממוצע לשחקן באמצע שבוע: " + calculateAveragePrice(room, false) + " שקלים");
                                    msg_list.push("מחיר ממוצע לשחקן בסוף שבוע: " + calculateAveragePrice(room, true) + " שקלים")
                                }

                                let merged_msg = "";
                                for (let key in msg_list) {
                                    merged_msg += msg_list[key] + "\n";
                                }


                                FB.newSimpleMessage(recipient, merged_msg).then(r =>{
                                    let data = {};
                                    data["אני רוצה לדעת עוד..."] = "MORE_INFO2_" + room_id;
                                    createQuickReplies(data).then(qr => {
                                        FB.newSimpleMessage(recipient, "רוצה לדעת עוד?", qr).then(r => {
                                            resolve(context);
                                        });

                                    })
                                });
                            }, 3000)
                        });

                    });
                }, 3000)
            });
        });
}

function handleMoreInfo2(context, recipient, room_id) {
    return new Promise(
        function (resolve) {
            context.room_id = room_id;
            setTimeout(function () {
                FB.newSenderAction(recipient, Config.TYPING_OFF).then(_ => {

                    DB.findRoomById(room_id).then(room => {
                        let elements = [];
                        let mapItem = createWazeItem(room.waze_link);
                        elements.push(mapItem);

                        FB.newStructuredMessage(recipient, elements).then(r => {

                                let msg_list = [];
                                if (room.soldier_discount || room.soldier_discount_weekend || room.student_discount || room.student_discount_weekend || room.children_discount || room.children_discount_weekend) {
                                    msg_list.push("הנחות:");

                                    let soldier_discount = undefined;
                                    if (room.soldier_discount) {
                                        soldier_discount = "לחיילים " + room.soldier_discount + "% באמצע שבוע";
                                    }

                                    if (room.soldier_discount_weekend) {
                                        soldier_discount += ", ו " + room.soldier_discount_weekend + "% בסוף שבוע"
                                    }
                                    if (soldier_discount) {
                                        msg_list.push(soldier_discount);
                                    }

                                    let student_discount = undefined;
                                    if (room.student_discount) {
                                        student_discount = "לסטודנטים " + room.student_discount + "% באמצע שבוע";
                                    }

                                    if (room.student_discount_weekend) {
                                        student_discount += ", ו " + room.student_discount_weekend + "% בסוף שבוע"
                                    }
                                    if (student_discount) {
                                        msg_list.push(student_discount);
                                    }

                                    let children_discount = undefined;
                                    if (room.children_discount) {
                                        children_discount = "לילדים " + room.children_discount + "% באמצע שבוע";
                                    }

                                    if (room.children_discount_weekend) {
                                        children_discount += ", ו " + room.children_discount_weekend + "% בסוף שבוע"
                                    }
                                    if (children_discount) {
                                        msg_list.push(children_discount);
                                    }
                                }

                                if (room.is_beginner) {
                                    let bool = Boolean(room.is_beginner);
                                    let msg = "";
                                    if (!bool) msg += " לא ";
                                    msg += "מתאים למתחילים";
                                    msg_list.push(msg);
                                }

                                if (room.is_for_children) {
                                    let bool = Boolean(room.is_for_children);
                                    let msg = "";
                                    if (!bool) msg += " לא ";
                                    msg += "מתאים לילדים";
                                    msg_list.push(msg);
                                }

                                if (room.is_scary) {
                                    let bool = Boolean(room.is_scary);
                                    let msg = "";
                                    if (!bool) msg += " לא ";
                                    msg += "מפחיד";
                                    msg_list.push(msg);
                                }

                                if (room.is_for_pregnant) {
                                    let bool = Boolean(room.is_for_pregnant);
                                    let msg = "";
                                    if (!bool) msg += " לא ";
                                    msg += "מתאים לנשים בהריון";
                                    msg_list.push(msg);
                                }

                                if (room.is_for_disabled) {
                                    let bool = Boolean(room.is_for_disabled);
                                    let msg = "";
                                    if (!bool) msg += " לא ";
                                    msg += "מונגש לנכים";
                                    msg_list.push(msg);
                                }

                                if (room.is_for_hearing_impaired) {
                                    let bool = Boolean(room.is_for_hearing_impaired);
                                    let msg = "";
                                    if (!bool) msg += " לא ";
                                    msg += "מונגש לכבדי שמיעה ";
                                    msg_list.push(msg);
                                }

                                if (room.is_credit_card_accepted) {
                                    let bool = Boolean(room.is_credit_card_accepted);
                                    let msg = "";
                                    if (!bool) msg += " לא ";
                                    msg += "ניתן לשלם באשראי";
                                    msg_list.push(msg);
                                }
                                let merged_msg = "";
                                for (let key in msg_list) {
                                    merged_msg += msg_list[key] + "\n";
                                }
                                FB.newSimpleMessage(recipient, merged_msg).then( r => {
                                    resolve(context);
                                });
                        });

                    });
                }, 3000)
            });
        });
}


function generateWazeLink(lat,lon) {
    return new Promise(
        function (resolve) {
            TinyURL.shorten('waze://?ll=' + lat + ',' + lon + '&navigate=yes', function (wazelink) {
                console.log(wazelink);
                resolve(wazelink);
            })
        })
}


module.exports = {
    sessions: sessions,
    findOrCreateSession: findOrCreateSession,
    read: read,
    easterEggs: easterEggs,
    enrichFlags: enrichFlags,
    findRoomByName: findRoomByName,
    findRoomsByCompany: findRoomsByCompany,
    findEscapeRoomByContext: findEscapeRoomByContext,
    createQuickReplies: createQuickReplies,
    createMenu: createMenu,
    createVideoItem: createVideoItem,
    createGeneralMenu: createGeneralMenu,
    drawMenu: drawMenu,
    displayResponse: displayResponse,
    handleMoreInfo: handleMoreInfo,
    handleMoreInfo2: handleMoreInfo2,
    generateWazeLink: generateWazeLink,
    displayErrorMessage: displayErrorMessage
};

