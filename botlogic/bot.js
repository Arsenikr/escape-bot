'use strict';

const Config = require('../config');
const emoji = require('node-emoji');
const DB = require('../model/mongoose');
const TinyURL = require('tinyurl');
const Escaper = require('../escaper');
const moment = require('moment');
const FB = require('../connectors/facebook/facebookapi');
const Wit = require('../connectors/wit/wit');
const Formatter = require('../connectors/facebook/facebookformatter');
const fetch = require('node-fetch');
const utf8 = require('utf8');
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

function handlePostback(recipient, entry, context) {
    if (typeof context.is_started === 'undefined' && entry.postback === Config.GET_STARTED_PAYLOAD) {

        FB.getUserProfile(recipient).then(profile => {
            sendStartMessages(context, recipient, profile);
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

                let room_id = entry.postback.substring('MORE_INFO_'.length);
                handleMoreInfo(context, recipient, room_id)
            });
        });
    } else if (entry.postback.startsWith("MORE_INFO2_")) {
        FB.newSenderAction(recipient, Config.MARK_SEEN).then(_ => {
            FB.newSenderAction(recipient, Config.TYPING_ON).then(_ => {

                let room_name = entry.postback.substring("MORE_INFO2_".length);
                handleMoreInfo2(context, recipient, room_name)
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

    } else if (entry.postback === 'NEW_SEARCH' || entry.postback === 'START_NEW_SEARCH' || entry.postback.payload === 'START_NEW_SEARCH') {
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
            delete context.datetime;
            context.is_duda = true;
            askForDuda(recipient, context)
        }, 3000);
    } else if (entry.postback.startsWith("ROOM_FILTER_")) {
        FB.newSenderAction(recipient, Config.MARK_SEEN).then(_ => {
            FB.newSenderAction(recipient, Config.TYPING_ON).then(_ => {
                let filter = entry.postback.substring("ROOM_FILTER_".length);

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
                } else if (filter === "GROUP") {
                    context.is_for_groups = true;
                } else if (filter === "AVAILABLE_TODAY") {
                    context.availability = "פנוי היום";
                }

                findEscapeRoomByContext(context).then(context => {
                    context.state = "";
                    if (context.room_list && context.room_list.length > 0) {
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
    } else if (entry.postback.startsWith("GROUP_SIZE_QR")) {
        let group_size = entry.postback.substring("GROUP_SIZE_QR".length);
        console.log("adding group size: " + group_size);
        context.num_of_people = group_size;
        findEscapeRoomByContext(context).then(context => {
            context.state = "";
            if (context && context.room_list && context.room_list.length > 0) {
                displayResponse(recipient, context);
            }
        }).catch(err => {
            displayErrorMessage(recipient, context).then(r => {
                askForGroupSize(recipient);
            })
        });
    } else if (entry.postback.startsWith("COMPANY_QR")) {
        console.log("adding company: " + entry.msg);
        context.company_name = [entry.msg];
        findEscapeRoomByContext(context).then(context => {
            context.state = "";
            if (context && context.room_list && context.room_list.length > 0) {
                displayResponse(recipient, context);
            }
        }).catch(err => {
            displayErrorMessage(recipient, context).then(r => {
                askForCompany(recipient);
            })
        });
    } else if (entry.postback.startsWith("LOCATION_QR")) {
        console.log("adding location: " + entry.msg);
        context.location = [entry.msg];
        delete context.lat;
        delete context.lon;

        findEscapeRoomByContext(context).then(context => {
            context.state = "";
            if (context && context.room_list && context.room_list.length > 0) {
                displayResponse(recipient, context);
            }

        }).catch(err => {
            console.log((err));
            displayErrorMessage(recipient, context).then(r => {
                askForLocation(recipient);
            });
        });
    }
}

function handleQR(recipient, entry, context) {
    if (entry.qr.startsWith("NEW_SEARCH")) {
        setTimeout(function () {
            FB.newSimpleMessage(recipient, "חיפוש חדש:").then(r => {
                delete context.state;
                resetSession(context, recipient);
            })
        }, 3000);
    }
}
function handleAttachments(recipient, entry, context) {
    if (entry.attachments[0] && entry.attachments[0].coordinates) {
        let lat = entry.attachments[0].coordinates.lat;
        let lon = entry.attachments[0].coordinates.long;
        console.log("received user location: " + lat + "," + lon);
        context.lat = lat;
        context.lon = lon;
        delete context.location;
        findEscapeRoomByContext(context).then(context => {
            context.state = "";
            if (context.room_list && context.room_list.length > 0) {
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
}
function handleFreeMsgFlow(recipient, sessionId, entry, context) {
    let message = entry.msg;
    let entities = entry.wit_entities;
    context.is_changed = false;
    Wit.extractEntities(entities, context).then(context =>
        handleMsgFlow(sessionId, context)
    )
}
function mainFlow(source,recipient,entry) {
    FB.newSenderAction(recipient, Config.MARK_SEEN).then(_ => {
        FB.newSenderAction(recipient, Config.TYPING_ON).then(_ => {
            findOrCreateSession(source,recipient).then(sessionId => {

                let context = sessions[sessionId].context;
                if (entry && entry.postback) {
                    handlePostback(recipient, entry, context);
                } else if (entry && entry.qr) {
                    handleQR(recipient, entry, context);
                }
                else if(entry && entry.attachments && entry.attachments.length > 0){

                    handleAttachments(recipient, entry, context);

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
                        delete context.datetime;
                        askForDuda(recipient,context)
                    } else {
                        handleFreeMsgFlow(recipient, sessionId, entry, context);                    }
                }
            });

        });
    });

}


function handleSmallTalk(context) {
    return new Promise(
        function (resolve, reject) {
            if(context && context.small_talk && context.small_talk.length > 0) {
                let response = "";
                // for (let i = 0; i < context.small_talk.length; i++) {

                    if (context.small_talk[0] === "אוינק") {
                        response += emoji.emojify(':pig_nose: :pig_nose: :pig_nose:');
                        response += "\n";
                        return resolve(response);
                    } else {
                        DB.findEasterEgg(context.small_talk[0]).then(function (resp) {
                            if (resp) {
                                response += resp;
                                response += "\n";
                                return resolve(response);
                            }
                        }).catch(function (err) {
                            return reject(err);
                        });
                    }
                // }
            } else {
                return resolve(undefined)
            }
        })
}



function findRoomByName(context,message) {
    return new Promise(
        function (resolve, reject) {

            DB.findRoomByName(message).then(function (response) {
                if (response) {
                    context.room_id = response[0].room_id;
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
                    if (context.availability || context.datetime) {
                        Escaper.getAvailableSlots(response,context.availability,context.datetime).then(filtered_response => {
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
    if ( typeof context.availability !== 'undefined' || typeof context.datetime !== 'undefined' ) {
        msg += ", ";
        msg += "פנויים";

        if(context.availability === "פנוי היום" || context.availability === "פנוי הערב" || context.availability.includes("היום") || context.availability.includes("הערב")){
            msg += " להיום";

        } else if(context.availability && context.availability === "פנוי מחר" || context.availability.includes("מחר")){
            msg += " למחר";
        }

        if(context.datetime && context.datetime.from){
            let day = moment(context.datetime.from);

            day.locale("he");

            if(context.datetime.grain === "day" && day.hour() === 0){
                if(day.format("YYYY-MM-DD") === Escaper.getTodayDate()){
                    msg += " להיום";
                } else if(day.format("YYYY-MM-DD") === moment().add(1,'days').format("YYYY-MM-DD")){
                    msg += " למחר";
                } else {
                    let formatted_day = day.format("dddd");
                    msg += " ב";
                    msg += formatted_day
                }
            }  else {
                let formatted_day = day.calendar();
                if(formatted_day && !formatted_day.includes("היום") && !formatted_day.includes("מחר")){
                    msg += " ב";
                } else {
                    msg += " "
                }
                msg += formatted_day
            }
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
    if (context.location && context.location.length > 0) {
        let locations = " ב";
        if(context.lat && context.lon){
            locations = " סביב "
        }

        for (let i = 0; i < context.location.length; i++) {
            locations += context.location[i] + " או ";
        }

            msg += locations.substring(0,locations.length -4)
    } else if (context.lat && context.lon) {
        msg += " סביב המיקום שלך"
    } else msg += " בכל הארץ ";
    if (!context.is_for_groups && context.num_of_people && context.num_of_people.length > 0) {

        let min_num_of_people = Math.min(...context.num_of_people);
        let max_num_of_people = Math.max(...context.num_of_people);
        if(min_num_of_people > 1 && max_num_of_people > 1) {
            msg += " ל";

            if (min_num_of_people === max_num_of_people) {
                msg += min_num_of_people
            } else {
                msg += min_num_of_people + " עד " + max_num_of_people
            }
            msg += " אנשים"
        }
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
                        })
                    } else {

                        FB.newListMessage(recipient, context.room_list,0).then(r => {
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

function merge_msg_list(msg_list) {
    let merged_msg = "";
    for (let key in msg_list) {
        merged_msg += msg_list[key] + "\n";
    }
    return merged_msg;
}
function formatPriceInfo(context, room) {
    let msg_list = [];
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
    return msg_list;
}
function formatAvailableSlots(room, slots) {
    let msg_list = [];

    if (slots.length > 0) {
        msg_list.push("שעות פנויות להיום: ");
        msg_list.push("");
        for (let i in slots) {
            msg_list.push("" + slots[i])
        }
        msg_list.push("");
        msg_list.push("להזמנות: " + room.website)
    } else {
        msg_list.push("אין שעות פנויות להיום!");
    }
    msg_list.push("");
    msg_list.push("המידע באדיבות www.escaper.co.il");
    return msg_list;

}

function formatDiscounts(room) {
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
    return msg_list;
}
function formatRoomFilters(room) {
    let msg_list = [];
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

    return msg_list;
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
                                msg_list.push(formatPriceInfo(context, room));

                                let merged_msg = merge_msg_list(msg_list);

                                FB.newSimpleMessage(recipient, merged_msg).then(r => {
                                    if(typeof room.escaper_id !== 'undefined'){
                                        Escaper.getAvailableSlotsForToday(room.escaper_id).then(slots => {

                                            let merged_msg = merge_msg_list(formatAvailableSlots(room, slots));


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
                                if(room.phone){
                                    let buttons = [];
                                    buttons.push(Formatter.createPhoneButton(room.phone));
                                    if(room.phone_2){
                                        buttons.push(Formatter.createPhoneButton(room.phone_2));
                                    }
                                    FB.newButtonsMessage(recipient, "מספרי טלפון:", buttons).then(r => {
                                        let msg_list = [];
                                        msg_list.push(formatDiscounts(room, msg_list));
                                        let merged_msg = merge_msg_list(formatRoomFilters(room));
                                        FB.newSimpleMessage(recipient, merged_msg).then( r => {
                                            resolve(context);
                                        });
                                    });
                                } else {
                                    let msg_list = [];
                                    msg_list.push(formatDiscounts(room, msg_list));
                                    let merged_msg = merge_msg_list(formatRoomFilters(room));
                                    FB.newSimpleMessage(recipient, merged_msg).then( r => {
                                        resolve(context);
                                    });
                                }
                        });

                    });
                    });
                }, 3000)
            });
        });
}

function sendStartMessages(context,recipient, profile) {
    setTimeout(function () {
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
                                        // sessions[sessionid].context.is_started = true;
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
    delete context.room_name;
    delete context.room_id;
    delete context.room_info;
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
    delete context.is_duda;
    delete context.is_changed;


    Formatter.createGeneralMenu(context).then(menu => {
        FB.newStructuredMessage(recipient, menu)
    })
}


function handleRoomInfo(recipient,context) {
    return new Promise(
        function (resolve) {
            let room_id = context.room_id;
            let room_info = context.room_info;

            DB.findRoomById(room_id).then (room => {

                let msg_list = [];

                msg_list.push("שם החדר: " + room.room_name[0]);

                let merged_msg = merge_msg_list(msg_list);
                FB.newSimpleMessage(recipient, merged_msg).then( r => {
                    for (let i in room_info) {
                        if (room_info[i] === "כתובת") {
                            let elements = [];
                            let mapItem = Formatter.createMapItem(room.address);
                            elements.push(mapItem);
                            FB.newStructuredMessage(recipient, elements)
                        }
                        if (room_info[i] === "טלפון") {
                            let buttons = [];
                            buttons.push(Formatter.createPhoneButton(room.phone));
                            buttons.push(Formatter.createPhoneButton(room.phone_2));
                            FB.newButtonsMessage(recipient, "טלפונים:", buttons)
                        }
                        if (room_info[i] === "הנחה") {
                            let msg_list = [];
                            msg_list.push(formatDiscounts(room));
                            let merged_msg = merge_msg_list(msg_list);
                            FB.newSimpleMessage(recipient, merged_msg)
                        }
                        if (room_info[i] === "ביקורת") {
                            let elements = [];
                            let hashtagItem = Formatter.createHashtagItem(room.hashtag);
                            elements.push(hashtagItem);
                            FB.newStructuredMessage(recipient, elements)
                        }
                        if (room_info[i] === "מחיר") {
                            let msg_list = [];
                            msg_list.push(formatPriceInfo(context,room));
                            let merged_msg = merge_msg_list(msg_list);
                            FB.newSimpleMessage(recipient, merged_msg).then(r => r)
                        }
                    }
                    delete context.room_info;
                    resolve(context)
                });
            })
        });


        }


function findRoomsByContext(context, recipient, reject, sessionId,is_small_talk) {
    findEscapeRoomByContext(context).then(context => {
        if (context && context.is_changed) {
            if (context.room_list && context.room_list.length > 0) {
                if (context.room_list && context.room_list.length > 0) {
                    displayResponse(recipient, context)
                } else {
                    return reject();
                }
            } else {
                if (context.location && context.location.length > 0) {
                    convertLocationToGeo(context.location[0]).then(coords => {
                        if (coords && coords.lat && coords.lng) {
                            // delete context.location;
                            context.lat = coords.lat;
                            context.lon = coords.lng;
                            sessions[sessionId].context = context;
                        }
                        findEscapeRoomByContext(context).then(context => {
                            if (context && context.room_list && context.room_list.length > 0) {
                                if (context.room_list && context.room_list.length > 0) {
                                    displayResponse(recipient, context)
                                } else {
                                    return reject();
                                }
                            }
                        })
                    })
                }
            }
        } else if(!is_small_talk) {
            FB.newSimpleMessage(recipient, "לא הבנתי את כוונתך בוטן יקר...")
        }
    }).catch((err) => {
        if (err) {
            console.error('Oops! Got an error from Wit: ', err.stack || err);
        }
        setTimeout(function () {
            FB.newSenderAction(sender, Config.TYPING_OFF).then(_ => {
                let new_context = sessions[sessionId].context;
                displayErrorMessage(sender, new_context).then(ans => {
                    // createGeneralMenu(new_context).then(menu => {
                    //     FB.newStructuredMessage(sender, menu);
                    // })
                })
            }, 3000);
        })
    })
}

function handleMsgFlow(sessionId, context) {
    return new Promise(
        function (resolve, reject) {

            sessions[sessionId].context = context;
            let recipient = sessions[sessionId].fbid;
            if (context.room_info) {
                if (context.room_id) {
                    handleRoomInfo(recipient, context)
                } else {
                    FB.newSimpleMessage(recipient, "ספר לי על איזה חדר אתה רוצה לקבל מידע על " + context.room_info.toString())
                }
            } else {
                handleSmallTalk(context).then(resp => {
                    if(resp) {
                        FB.newSimpleMessage(recipient, resp).then( rrr => {
                            delete context.small_talk;
                            findRoomsByContext(context, recipient, reject, sessionId, true);
                        })
                    } else {
                        findRoomsByContext(context, recipient, reject, sessionId,false);
                    }
                })
            }
        })


}

function handleMessage(sessionId,question,context) {
    Wit.getResponseFromWit(question, context).then(entities => {
            context = Wit.extractEntities(entities, context);
            handleMsgFlow(sessionId, context)
    })
}


function convertLocationToGeo(location) {
    return new Promise(
        function (resolve) {
            let url = utf8.encode('http://maps.googleapis.com/maps/api/geocode/json?address=' + location);
            fetch(url)
                .then(function (res) {

                    return res.json();
                }).then(function (json) {
                    if(json.results && json.results[0] && json.results[0].geometry && json.results[0].geometry.location){
                        resolve(json.results[0].geometry.location)
                    } else {
                        resolve(undefined)
                    }
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
    findRoomByName: findRoomByName,
    findRoomsByCompany: findRoomsByCompany,
    findEscapeRoomByContext: findEscapeRoomByContext,
    displayResponse: displayResponse,
    handleMoreInfo: handleMoreInfo,
    handleMoreInfo2: handleMoreInfo2,
    generateWazeLink: generateWazeLink,
    generateMoovitLink: generateMoovitLink,
    displayErrorMessage: displayErrorMessage,
    mainFlow:mainFlow,
    handleMessage: handleMessage
};

