'use strict';

const Config = require('../config');
const emoji = require('node-emoji');
const DB = require('../model/mongoose');
const TinyURL = require('tinyurl');
const Escaper = require('../escaper');
const moment = require('moment');
const WitLogic = require('./witlogic');
const FB = require('../connectors/facebook/facebookapi');
const Formatter = require('../connectors/facebook/facebookformatter');

// LETS SAVE USER SESSIONS
const sessions = {};

function findOrCreateSession(source,fbid) {
    return new Promise(
        function (resolve, reject) {

            let sessionId;

            // DOES USER SESSION ALREADY EXIST?
            Object.keys(sessions).forEach(k => {
                if (sessions[k].source === source && sessions[k].fbid === fbid
                ) {
                    // YUP
                    sessionId = k
                }
            });

            // No session so we will create one
            if (!sessionId) {
                sessionId = new Date().toISOString();
                sessions[sessionId] = {
                    source: source,
                    fbid: fbid,
                    context: {
                        _fbid_: fbid
                    }
                }
            }

            return resolve(sessionId);
        });
}

function updateSession(sessionId,context) {
    sessions[sessionId].context = context
}

function mainFlow(source,recipient,entry) {
    FB.newSenderAction(recipient, Config.MARK_SEEN).then(_ => {
        FB.newSenderAction(recipient, Config.TYPING_ON).then(_ => {
            findOrCreateSession(source,recipient).then(sessionId => {

                let context = sessions[sessionId].context;
                if (entry && entry.postback) {
                    if (typeof context.is_started === 'undefined' && entry.postback === Config.GET_STARTED_PAYLOAD) {

                        FB.getUserProfile(recipient).then(profile => {
                            sendStartMessages(context, entry, profile);
                        });
                        // if it is a location callback:
                    } else if (entry.postback === "SEARCH_BY_LOCATION") {
                        context.state = "LOCATION";
                        askForLocation(recipient);
                    } else if (entry.postback === "SEARCH_BY_GROUP_SIZE") {
                        context.state = "GROUP_SIZE";
                        askForGroupSize(recipient);
                    } else if (entry.postback === "SEARCH_BY_COMPANY") {
                        context.state = "SEARCH_BY_COMPANY";
                        askForCompany(recipient, context);
                    } else if (entry.postback === "MORE_FILTERS") {
                        context.state = "MORE_FILTERS";
                        askForMoreFilters(recipient, context);
                    } else if (entry.postback.startsWith('MORE_INFO_')) {
                        FB.newSenderAction(recipient, Config.MARK_SEEN).then(_ => {
                            FB.newSenderAction(recipient, Config.TYPING_ON).then(_ => {

                                let room_name = entry.postback.substring('MORE_INFO_'.length);
                                context.room_name = room_name;
                                handleMoreInfo(context, recipient, room_name)
                            });
                        });
                    } else if (entry.postback.startsWith('MORE_ROOMS_')) {
                        setTimeout(function () {
                            FB.newSenderAction(recipient, Config.TYPING_OFF).then(_ => {
                                let slice_index = entry.postback.substring('MORE_ROOMS_'.length);
                                if (context.room_list) {
                                    if (context.room_list.length - slice_index === 1) {
                                        FB.newStructuredMessage(recipient, context.room_list.slice(slice_index))
                                    } else {
                                        FB.newListMessage(recipient, context.room_list, Number(slice_index))
                                    }
                                }
                            }, 5000)
                        });
                    } else if (entry.postback === 'MORE_SEARCH_OPTIONS') {
                        setTimeout(function () {
                            FB.newSimpleMessage(recipient, "בחר האם לצמצם את החיפוש:").then(r => {
                                Formatter.createGeneralMenu(context).then(menu => {
                                    FB.newStructuredMessage(recipient, menu);
                                });
                            })
                        }, 3000);

                    } else if (entry.postback === 'NEW_SEARCH' || entry.postback.payload === 'START_NEW_SEARCH') {
                        setTimeout(function () {
                            FB.newSimpleMessage(recipient, "חיפוש חדש:").then(r => {
                                delete context.state;
                                resetSession(context, recipient);
                            })
                        }, 3000);
                    } else if (entry.postback === 'HELP') {
                        setTimeout(function () {
                            let elements = [];

                            let videoItem = createVideoItem();
                            elements.push(videoItem);

                            FB.newStructuredMessage(recipient, elements).then(r => {

                            });
                        }, 3000);
                    } else if (entry.postback === 'DUDA_FOR_ROOM') {
                        setTimeout(function () {
                            context.availability = "פנוי היום";
                            askForDuda(recipient,context)
                        }, 3000);
                    }

                } else if (entry && entry.qr) {
                    if (entry.qr.startsWith("NEW_SEARCH")) {
                        setTimeout(function () {
                            FB.newSimpleMessage(recipient, "חיפוש חדש:").then(r => {
                                delete context.state;
                                resetSession(context, recipient);
                            })
                        }, 3000);
                    } else if (entry.qr.startsWith("LOCATION_QR")) {
                        console.log("adding location: " + entry.message.text);
                        context.location = entry.message.text;
                        delete context.lat;
                        delete context.lon;

                        findEscapeRoomByContext(context).then(context => {
                            context.state = "";
                            if(context && context.room_list && context.room_list.length > 0){
                                displayResponse(recipient, context);
                            }

                        }).catch(err => {
                            console.log((err));
                            displayErrorMessage(recipient, context).then(r => {
                                askForLocation(recipient);
                            });
                        });
                    } else if (entry.qr.startsWith("GROUP_SIZE_QR")) {
                        console.log("adding group size: " + entry.message.text);
                        context.num_of_people = entry.message.text;
                        findEscapeRoomByContext(context).then(context => {
                            context.state = "";
                            if(context && context.room_list && context.room_list.length > 0){
                                displayResponse(recipient, context);
                            }
                        }).catch(err => {
                            displayErrorMessage(recipient, context).then(r => {
                                askForGroupSize(recipient);
                            })
                        });
                    } else if (entry.qr.startsWith("COMPANY_QR")) {
                        console.log("adding company: " + entry.message.text);
                        context.company_name = entry.message.text;
                        findEscapeRoomByContext(context).then(context => {
                            context.state = "";
                            if(context && context.room_list && context.room_list.length > 0){
                                displayResponse(recipient, context);
                            }
                        }).catch(err => {
                            displayErrorMessage(recipient, context).then(r => {
                                askForCompany(recipient);
                            })
                        });
                    } else if (entry.qr.startsWith("MORE_INFO2_")) {
                        FB.newSenderAction(recipient, Config.MARK_SEEN).then(_ => {
                            FB.newSenderAction(recipient, Config.TYPING_ON).then(_ => {

                                let room_name = entry.qr.substring("MORE_INFO2_".length);
                                handleMoreInfo2(context, recipient, room_name)
                            });
                        });
                    } else if (entry.qr.startsWith("ROOM_FILTER_")) {
                        FB.newSenderAction(recipient, Config.MARK_SEEN).then(_ => {
                            FB.newSenderAction(recipient, Config.TYPING_ON).then(_ => {
                                let filter = entry.qr.substring("ROOM_FILTER_".length);

                                if (filter === "PARALLEL") {
                                    context.is_parallel = true;
                                } else if (filter === "LINEAR") {
                                    context.is_linear = true;
                                } else if (filter === "ACTOR") {
                                    context.is_actor = true;
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
                                } else if (filter === "AVAILABLE_TODAY"){
                                    context.availability = "פנוי היום";
                                }

                                findEscapeRoomByContext(context).then(context => {
                                    context.state = "";
                                    if(context.room_list && context.room_list.length > 0){
                                        displayResponse(recipient, context);
                                    } else {
                                        displayErrorMessage(recipient, context).then(r => {
                                            Formatter.drawMenu(context, entry);
                                        });
                                    }

                                }).catch(err => {
                                    displayErrorMessage(recipient, context).then(r => {
                                        Formatter.drawMenu(context, entry);
                                    });
                                });
                            });
                        });
                    }
                } else if (entry && entry.msg) {
                    context.message = entry.msg;
                    if(entry.msg === "חיפוש חדש") {
                        setTimeout(function () {
                            FB.newSimpleMessage(recipient, "חיפוש חדש:").then(r => {
                                delete context.state;
                                resetSession(context, recipient);
                            })
                        }, 3000);

                    } else if(entry.msg.includes("דודא")) {
                        context.availability = "פנוי היום";
                        askForDuda(recipient,context)
                    } else if (entry.attachments.size > 0) {
                        if (entry.attachments[0] && entry.attachments[0].coordinates) {
                            let lat = entry.attachments[0].coordinates.lat;
                            let lon = entry.attachments[0].coordinates.long;
                            console.log("received user location: " + lat + "," + lon);
                            context.lat = lat;
                            context.lon = lon;
                            delete context.location;
                            findEscapeRoomByContext(context).then(context => {
                                context.state = "";
                                if(context.room_list && context.room_list.length > 0){
                                    displayResponse(recipient, context);
                                } else {
                                    displayErrorMessage(recipient, context).then(r => {
                                        Formatter.drawMenu(context, entry);
                                    });
                                }
                            }).catch(err => {
                                console.log(error);
                                displayErrorMessage(recipient, context).then(r => {
                                    askForLocation(recipient);
                                });
                            });
                        } else {
                            // NOT SMART ENOUGH FOR ATTACHMENTS YET
                            FB.newSimpleMessage(recipient, "זה מעניין!")
                        }
                    } else {
                        let message = entry.msg;

                        easterEggs(message).then(function (reply) {
                            if (reply) {
                                FB.newSimpleMessage(recipient, reply)
                            } else {
                                if (!isNaN(message)) {
                                    context.num_of_people = Number(message);
                                    findEscapeRoomByContext(context).then(function (new_context) {
                                        if (new_context && new_context.room_list && new_context.room_list.length > 0) {
                                            displayResponse(recipient, new_context);
                                        }
                                    });
                                }
                                else {
                                    findRoomByName(context.message).then(function (reply) {
                                        if (reply && reply.length > 0) {
                                            FB.newStructuredMessage(recipient, reply)
                                        } else {
                                            findRoomsByCompany(context, context.message).then(function (reply) {
                                                if (reply && reply.length > 0) {
                                                    context.company_name = message;
                                                    context.room_list = reply;
                                                    displayResponse(recipient, context);
                                                } else {
                                                    WitLogic.read(sessionId, context, recipient, context.message)
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        }).catch(err => {
                            console.log(err);
                            FB.newSimpleMessage(entry.sender.id, 'לא הצלחתי לענות על זה, אבל הנה דברים שאני כן יכול לענות עליהם!').then(ans => {
                                Formatter.drawMenu(context, entry);
                            });
                        });                    }
                }
            });
        });
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



function findRoomByName(context,message) {
    return new Promise(
        function (resolve, reject) {

            DB.findRoomByName(context,message).then(function (response) {
                if (response) {
                    return resolve(Formatter.createRoomsList(context,response,true));
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
                    return resolve(Formatter.createRoomsList(context,response,true));
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
                if (response) {
                    if (context.availability) {
                        Escaper.getAvailableSlots(response,context.availability).then(filtered_response => {
                            let sorted_rooms = filtered_response.sort( function (a,b) {
                                let aa = moment(a.first_slot,"HH:mm");
                                if(a.first_slot <= "06:00") {
                                    aa.add(1,'days');
                                }
                                let bb = moment(b.first_slot,"HH:mm");
                                if(b.first_slot <= "06:00") {
                                    bb.add(1,'days');
                                }


                                if(aa <= bb){
                                   return -1;
                               } else if (aa > bb){
                                   return 1;
                               }
                            });
                            context.room_list = Formatter.createRoomsList(context, sorted_rooms, true);
                            return resolve(context);
                        })
                    } else {
                        context.room_list = Formatter.createRoomsList(context, response, true);
                        return resolve(context);
                    }

                } else {
                    context.room_list = undefined;
                    return resolve(context);
                }
            }).catch(function (err) {
                return reject(err);
            });
        })
}






function extractResponseFromContext(context) {
    let msg = "";
    if ( typeof context.availability !== 'undefined' ) {
        msg += ", ";
        msg += "פנויים";

        if(context.availability === "פנוי היום" || context.availability === "פנוי" || context.availability === "פנוי הערב" || context.availability.includes("היום") || context.availability.includes("הערב")){
            msg += " להיום";

        } else if(context.availability === "פנוי מחר" || context.availability.includes("מחר")){
            msg += " למחר";
        }
    }

        if ( typeof context.is_beginner !== 'undefined' ) {
        let bool = Boolean(context.is_beginner);
        msg += ", ";
        if (!bool) {
            msg += "מתאימים למנוסים";
        } else {
            msg += "מתאימים למתחילים";
        }
    }

    if (typeof context.is_for_children !== 'undefined') {
        let bool = Boolean(context.is_for_children);
        msg += ", ";
        if (!bool) msg += " לא ";
        msg += "מתאימים לילדים";
    }

    if (typeof context.is_scary !== 'undefined') {
        let bool = Boolean(context.is_scary);
        msg += ", ";
        if (!bool) msg += " לא ";
        msg += "מפחידים";
    }

    if (typeof context.is_double !== 'undefined') {
        let bool = Boolean(context.is_double);
        msg += ", ";
        if (!bool) msg += " לא ";
        msg += "כפולים";
    }
    if (typeof context.is_for_groups !== 'undefined') {
        let bool = Boolean(context.is_for_groups);
        msg += ", ";
        if (!bool) msg += " לא ";
        msg += "מתאימים לקבוצות גדולות";
    }

    if (typeof context.is_for_pregnant !== 'undefined') {
        let bool = Boolean(context.is_for_pregnant);
        msg += ", ";
        if (!bool) msg += " לא ";
        msg += "מתאימים לנשים בהריון";
    }

    if (typeof context.is_for_disabled !== 'undefined') {
        let bool = Boolean(context.is_for_disabled);
        msg += ", ";
        if (!bool) msg += " לא ";
        msg += "מונגשים לנכים";
    }

    if (typeof context.is_for_hearing_impaired !== 'undefined') {
        let bool = Boolean(context.is_for_hearing_impaired);
        msg += ", ";
        if (!bool) msg += " לא ";
        msg += "מונגשים לכבדי שמיעה ";
    }

    if (typeof context.is_credit_card_accepted !== 'undefined') {
        let bool = Boolean(context.is_credit_card_accepted);
        msg += ", ";
        if (!bool) msg += " לא ";
        msg += "ניתן לשלם באשראי";
    }

    if (typeof context.is_linear !== 'undefined') {
        let bool = Boolean(context.is_linear);
        msg += ", ";
        if (!bool) msg += " לא ";
        msg += "ליניאריים";
    }

    if (typeof context.is_actor !== 'undefined') {
        let bool = Boolean(context.is_actor);
        msg += ", ";
        if (!bool) msg += " לא ";
        msg += "עם שחקן";
    }


    if (typeof context.is_parallel !== 'undefined') {
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
    if (!context.is_for_groups && context.num_of_people && !(context.num_of_people === 1)) {
        msg += " ל" + context.num_of_people + " אנשים"
    }

    if ( typeof context.availability !== 'undefined' ) {
        msg += "\n" + "המידע על החדרים הפנויים באדיבות www.escaper.co.il"
    }

        msg = msg.replace(", ", " ");

    return msg;
}

function displayResponse(recipient, context) {
    setTimeout(function() {
        FB.newSenderAction(recipient,Config.TYPING_OFF).then(_ => {

            let msg = "הנה רשימה של חדרים";
            msg += extractResponseFromContext(context);
            msg += "\n" + "סה״כ " + context.room_list.length + " חדרים";
            msg += "\n" + "למידע על החדר לחצו ׳למידע נוסף׳";
            msg += "\n" + "לתוצאות נוספות אנא לחצו על ׳הצג עוד חדרים׳";
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
                    let msg = "לא הצלחתי למצוא חדרים" +
                        "";
                    msg += extractResponseFromContext(context);
                    FB.newSimpleMessage(recipient, msg).then(r => {
                        Formatter.showNewSearchQR(recipient).then(r => {
                            return resolve(context)
                        })
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
                        let hashtagItem = Formatter.createHashtagItem(room.hashtag);
                        elements.push(hashtagItem);

                        FB.newStructuredMessage(recipient, elements).then(r => {
                            setTimeout(function () {

                                let msg_list = [];
                                let msg = "זהו חדר ";
                                if (room.is_double === 1) {
                                    msg += "כפול "
                                }

                                msg += "שיכול להכיל עד ";

                                if (room.is_double === 1) {
                                    msg += room.max_players * 2 + " איש."
                                } else {
                                    msg += room.max_players + " איש."
                                }

                                msg_list.push(msg);

                                if (typeof context.is_for_groups === 'undefined' && context.num_of_people > 1 && context.num_of_people < 10 && room['price_' + context.num_of_people] && room['weekend_price_' + context.num_of_people]) {
                                    msg_list.push("לקבוצה של " + context.num_of_people + ": ");
                                    msg_list.push("מחיר לשחקן באמצע שבוע: " + room['price_' + context.num_of_people] + " שקלים");
                                    msg_list.push("מחיר לשחקן בסוף שבוע: " + room['weekend_price_' + context.num_of_people] + " שקלים")
                                } else {
                                    let weekday_avg = calculateAveragePrice(room, false);
                                    let weekend_avg = calculateAveragePrice(room, true);
                                    if (!isNaN(weekday_avg)) {
                                        msg_list.push("מחיר ממוצע לשחקן באמצע שבוע: " + calculateAveragePrice(room, false) + " שקלים");
                                    }

                                    if (!isNaN(weekend_avg)) {
                                        msg_list.push("מחיר ממוצע לשחקן בסוף שבוע: " + calculateAveragePrice(room, true) + " שקלים")
                                    }
                                }

                                let merged_msg = "";
                                for (let key in msg_list) {
                                    merged_msg += msg_list[key] + "\n";
                                }


                                FB.newSimpleMessage(recipient, merged_msg).then(r => {
                                    let msg_list = [];
                                    if(typeof room.escaper_id !== 'undefined'){
                                        Escaper.getAvailableSlotsForToday(room.escaper_id).then(slots => {
                                            if(slots.length > 0) {
                                                msg_list.push("שעות פנויות להיום: ");
                                                msg_list.push("");
                                                for (let i in slots) {
                                                    msg_list.push("" + slots[i])
                                                }
                                                msg_list.push("");
                                                msg_list.push("להזמנות: " + room.website)
                                            } else{
                                                msg_list.push("אין שעות פנויות להיום!");
                                            }
                                            msg_list.push("");
                                            msg_list.push("המידע באדיבות www.escaper.co.il");
                                            let merged_msg = "";
                                            for (let key in msg_list) {
                                                merged_msg += msg_list[key] + "\n";
                                            }


                                            FB.newSimpleMessage(recipient, merged_msg).then(r => {
                                                let data = {};
                                                data["אני רוצה לדעת עוד..."] = "MORE_INFO2_" + room_id;
                                                Formatter.createQuickReplies(data).then(qr => {
                                                    FB.newSimpleMessage(recipient, "רוצה לדעת עוד?", qr).then(r => {
                                                        resolve(context);
                                                    });

                                                })
                                            })

                                        });
                                    } else {
                                        let data = {};
                                        data["אני רוצה לדעת עוד..."] = "MORE_INFO2_" + room_id;
                                        Formatter.createQuickReplies(data).then(qr => {
                                            FB.newSimpleMessage(recipient, "רוצה לדעת עוד?", qr).then(r => {
                                                resolve(context);
                                            });

                                        });
                                    }


                                }, 3000)
                            });

                        });
                    }, 3000)
                });
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
                        let mapItem = Formatter.createWazeItem(room.waze_link);
                        elements.push(mapItem);

                        FB.newStructuredMessage(recipient, elements).then(r => {
                            let elements = [];
                            let mapItem = Formatter.createMoovitItem(room.moovit_link);
                            elements.push(mapItem);

                            FB.newStructuredMessage(recipient, elements).then(r => {



                                let msg_list = [];
                                msg_list.push("טלפון: " + room.phone);
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

                                if (room.is_actor) {
                                    let bool = Boolean(room.is_actor);
                                    let msg = "";
                                    if (!bool) msg += " לא ";
                                    msg += "עם שחקן";
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
                    });
                }, 3000)
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

                        let videoItem = Formatter.createVideoItem();
                        elements.push(videoItem);

                        FB.newStructuredMessage(recipient, elements).then(r => {
                            let message = "ט.ל.ח - במידה ונפלה טעות במידע אנא עדכנו אותנו ונתקן" + "\n";
                            message += "מייל לפניות: escapebotil@gmail.com";
                            FB.newSimpleMessage(recipient, message).then(resp => {

                                FB.newSimpleMessage(recipient, "בואו נתחיל!").then(r => {

                                    Formatter.drawMenu(recipient, context).then(res => {
                                        // Bot.sessions[sessionid].context.is_started = true;
                                    })
                                });
                            });
                        });
                    }, 3000);
                });
            }, 3000);
        });
    });
}




function askForLocation(recipient) {
    FB.newSimpleMessage(recipient, "אנא הכנס מיקום מבוקש:").then(result => {
        Formatter.createLocationQR().then(quick_answers => {
            FB.newSimpleMessage(recipient, "או בחר מיקום מהרשימה:", quick_answers)
        });
    })
}

function askForGroupSize(recipient) {
    FB.newSimpleMessage(recipient, "אנא הכנס מספר אנשים:").then(result => {
        Formatter.createGroupSizeQR().then(quick_answers => {
            FB.newSimpleMessage(recipient, "או בחר הרכב קבוצה מהרשימה:", quick_answers)
        });
    })
}

function askForCompany(recipient, context) {
    FB.newSimpleMessage(recipient, "אנא הכנס שם של חברת חדרי בריחה:").then(result => {
        DB.findCompaniesByContext(context).then(companies => {
            Formatter.createCompanyQR(companies).then(quick_answers => {
                FB.newSimpleMessage(recipient, "או בחר חברה מהרשימה:", quick_answers)
            });
        });
    })
}

function askForMoreFilters(recipient, context) {
    Formatter.createFiltersQR(context).then(quick_answers => {
        FB.newSimpleMessage(recipient, "מצא חדרים:", quick_answers)
    })
}

function askForDuda(recipient) {
    Formatter.createQuickReplies({},true).then(quick_answers => {
        FB.newSimpleMessage(recipient, "מה המיקום שלך?", quick_answers)
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
    delete context.availability;


    Formatter.createGeneralMenu(context).then(menu => {
        FB.newStructuredMessage(recipient, menu)
    })
}


// function extractRoomName(message) {
//     return new Promise(
//         function (resolve) {
//             if (message.startsWith("חדר בריחה ")) {
//                 resolve(message.substring("חדר בריחה ".length));
//             } else if (message.startsWith("איך החדר ")) {
//                 resolve(message.substring("איך החדר ".length));
//
//             } else if (message.startsWith("איך חדר הבריחה ")) {
//                 resolve(message.substring("איך חדר הבריחה ".length));
//
//             } else if (message.startsWith("איך ")) {
//                 resolve(message.substring("איך ".length));
//
//             } else if (message.startsWith("מידע על חדר ")) {
//                 resolve(message.substring("מידע על חדר ".length));
//
//             } else if (message.startsWith("מידע על החדר ")) {
//                 resolve(message.substring("מידע על החדר ".length));
//             } else if (message.startsWith("מידע על ")) {
//                 resolve(message.substring("מידע על ".length));
//             } else if (message.startsWith("איפה נמצא ")) {
//                 resolve(message.substring("איפה נמצא ".length));
//             } else if (message.startsWith("איפה נמצא החדר ")) {
//                 resolve(message.substring("איפה נמצא החדר ".length));
//             } else {
//                 resolve(undefined);
//             }
//         });
// }


function generateWazeLink(lat,lon) {
    return new Promise(
        function (resolve) {
            TinyURL.shorten('waze://?ll=' + lat + ',' + lon + '&navigate=yes', function (wazelink) {
                console.log(wazelink);
                resolve(wazelink);
            })
        })
}

function generateMoovitLink(lat,lon,address) {
    return new Promise(
        function (resolve) {
            TinyURL.shorten('moovit://directions?dest_lat=' + lat + '&dest_lon=' + lon + '&dest_name=' + address + '&partner_id=escapebot', function (moovitlink) {
                console.log(moovitlink);
                resolve(moovitlink);
            })
        })
}



module.exports = {
    sessions: sessions,
    updateSession: updateSession,
    findOrCreateSession: findOrCreateSession,
    easterEggs: easterEggs,
    findRoomByName: findRoomByName,
    findRoomsByCompany: findRoomsByCompany,
    findEscapeRoomByContext: findEscapeRoomByContext,
    displayResponse: displayResponse,
    handleMoreInfo: handleMoreInfo,
    handleMoreInfo2: handleMoreInfo2,
    generateWazeLink: generateWazeLink,
    generateMoovitLink: generateMoovitLink,
    displayErrorMessage: displayErrorMessage,
    mainFlow:mainFlow
};

