/**
 * Created by Arseny on 19/05/2017.
 */

const Wit = require('node-wit').Wit;
const FB = require('../connectors/facebook/facebookapi');
const Bot = require('./bot');
const Config = require('../config');

let actions = {
    send(request, response) {
        const {sessionId, context, entities} = request;
        const {text, quickreplies} = response;
        return new Promise(function (resolve, reject) {
            const recipientId = Bot.sessions[sessionId].fbid;

            if (context.room_list && context.room_list.length > 0) {
                displayResponse(recipientId, context)
            } else {
                return reject();
            }
            Bot.sessions[sessionId].context = context;
            // DO NOT RETURN CONTEXT
            return resolve();
        });

    },


    findEscapeRoom({sessionId,context, entities}) {
        return new Promise(function (resolve, reject) {
            let location = firstEntityValue(entities, 'room_location');
            let num_of_people = firstEntityValue(entities, 'group_size');
            let room_name = firstEntityValue(entities, 'room_name');
            let company = firstEntityValue(entities, 'room_company');
            let category = firstEntityValue(entities, 'room_category');
            let availability = firstEntityValue(entities, 'room_availability');
            let datetime = firstEntityValue(entities, 'wit/datetime');
            let room_info = firstEntityValue(entities, 'room_info');
            let price = firstEntityValue(entities, 'wit/amount_of_money');

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
            if(availability) {
                context.availability = availability
            }

            if(room_name) {
                context.room_name = room_name
            }

            if(company) {
                context.company_name = company
            }

            if(category){
                //TODO generalize into multiple categories
               context = enrichFlags(context,category)
            }

            // Bot.sessions[sessionId].context = context;
            Bot.updateSession(sessionId,context);
            return resolve(Bot.findEscapeRoomByContext(context))
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
                            // createGeneralMenu(new_context).then(menu => {
                            //     FB.newStructuredMessage(sender, menu);
                            // })
                        })
                    }, 3000);
                })
            })
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

function enrichFlags(context, category) {

    if (category === "הריון") {
        console.log("הריון");
        context.is_for_pregnant = true;
    }

    if (category === "נגיש לנגים") {
        console.log("נכים");
        context.is_for_disabled = true;
    }

    if (category === "מותאם לכבדי שמיעה") {
        console.log("שמיעה");
        context.is_for_hearing_impaired = true;
    }

    if (category === "לילדים") {
        console.log("ילדים");
        context.is_for_children = true;
    }

    if (category === "מבוגרים") {
        console.log("מבוגרים");
        context.is_for_children = false;
    }

    if (category === "אשראי") {
        console.log("אשראי");
        context.is_credit_card_accepted = true;
    }

    if (category === "לא מפחיד") {
        console.log("לא מפחיד");
        context.is_scary = false;

    } else if (category === "מפחיד") {
        console.log("מפחיד");
        context.is_scary = true;
    }

    if (category === "מתחילים") {
        console.log("מתחילים");
        context.is_beginner = true;
    }
    if (category === "מנוסים") {
        console.log("מנוסים");
        context.is_beginner = false;
    }

    if (category === "ליניארי") {
        console.log("ליניארי");
        context.is_linear = true;
    }

    if (category === "מקבילי") {
        console.log("מקבילי");
        context.is_parallel = false;
    }

    if (category === "קבוצה גדולה") {
        console.log("קבוצות גדולות");
        context.is_for_groups = true;
    }

    if (category === "כפול") {
        console.log("כפול");
        context.is_double = true;
    }

    if (category === "שחקן"){
        console.log("שחקן");
        context.is_actor = true;
    }
    return context
}


module.exports = {
    read: read,
};