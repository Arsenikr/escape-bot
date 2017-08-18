const Wit = require('node-wit').Wit;
const Config = require('../../config');
const Escaper = require('../../escaper');
const moment = require('moment');
const WIT_TOKEN = Config.WIT_TOKEN;

const wit = new Wit({
    accessToken: WIT_TOKEN
});

function getResponseFromWit(question, context) {
    wit.message(question, context).then(({entities}) => {
      return entities
    })
}

function extractEntities(entities, context) {
    return new Promise(
        function (resolve, reject) {
            console.log(entities);
            // let murmur_before = murmur.hash128(context.toString).hash_raw;

            let location = getValues(entities, 'room_location');
            let num_of_people = getValues(entities, 'group_size');
            let room_name = getValues(entities, 'room_name');
            let company = getValues(entities, 'room_company');
            let categories = getValues(entities, 'room_category');
            let availability = getValues(entities, 'room_availability');
            let datetime = getDatetime(entities);
            let room_info = getValues(entities, 'room_info');
            let small_talk = getValues(entities, 'small_talk');
            let price = getValues(entities, 'amount_of_money');

            console.log("wit received: " + location);
            console.log("wit received: " + num_of_people);

            if (location.length > 0) {
                delete context.lat;
                delete context.lon;
                context.location = location;
                context.is_changed = true
            }
            if (num_of_people.length > 0) {
                context.num_of_people = num_of_people;
                context.is_changed = true
            }

            if (datetime && datetime.length > 0) {
                context.availability = "פנוי";
                context.datetime = datetime[0];
                context.is_changed = true
            }

            if (availability && availability.length > 0) {
                context.availability = availability;
                context.is_changed = true
            }


            if (room_name.length > 0) {
                context.room_name = room_name;
                context.is_changed = true;
            }

            if (company.length > 0) {
                context.company_name = company;
                context.is_changed = true
            }

            if (categories.length > 0) {
                context = enrichFlags(context, categories)
            }

            if (room_info.length > 0) {
                context.room_info = room_info;
                context.is_changed = true
            }

            if (small_talk.length > 0) {
                context.small_talk = small_talk;
                // small talk does not change context
            }

            return resolve(context);
        })
}

function getValues(entities, entity) {
    let values = [];
    if(entities && entities[entity] &&
        Array.isArray(entities[entity]) &&
        entities[entity].length > 0) {

        for (let i = 0; i < entities[entity].length; i++) {

            if (entities[entity][i].confidence && entities[entity][i].confidence > 0.5) {
                let val = entities[entity][i].value;
                let fval = typeof val === 'object' ? val.value : val;

                values.push(fval)
            }
        }
    }
    return values;
}

function getDatetime(entities) {
    let values = [];
    if (entities && entities['datetime'] &&
        Array.isArray(entities['datetime']) &&
        entities['datetime'].length > 0) {

        for (let i = 0; i < entities['datetime'].length; i++) {

            if (entities['datetime'][i].confidence && entities['datetime'][i].confidence > 0.7) {
                if (entities['datetime'][i].from &&  entities['datetime'][i].to) {
                    let from_date = convertWeeHoursToToday(entities['datetime'][i].from.value,entities['datetime'][i].from.grain);
                    let to_date = convertWeeHoursToToday(entities['datetime'][i].to.value,entities['datetime'][i].to.grain);
                    values.push({"from":from_date, "to": to_date,"grain":entities['datetime'][i].from.grain })
                } else {
                    let from_date = convertWeeHoursToToday(entities['datetime'][i].value,entities['datetime'][i].grain);
                    values.push({"from": from_date,"grain":entities['datetime'][i].grain})
                }
            }
        }
        return values;
    }
}

function convertWeeHoursToToday(date,grain) {
    let date_moment = moment(date);
    let formatted_date = Escaper.formatDate(date_moment);
    let tomorrow_date = Escaper.formatDate(moment().add(1,'days'));

    if(grain === 'hour'){
        if(formatted_date === tomorrow_date && date_moment.get("hour") >= 0 && date_moment.get("hour") <= 6 ) {
            return date_moment.subtract(1,'days').format()
        } else {
            return date
        }
    } else {
        return date
    }
}


function enrichFlags(context, categories) {

    for (let i = 0; i < categories.length; i++) {

        if (categories[i].trim() === "הריון") {
            console.log("הריון");
            context.is_for_pregnant = true;
            context.is_changed = true
        }

        if (categories[i].trim() === "נגיש לנגים") {
            console.log("נכים");
            context.is_for_disabled = true;
            context.is_changed = true
        }

        if (categories[i].trim() === "מותאם לכבדי שמיעה") {
            console.log("שמיעה");
            context.is_for_hearing_impaired = true;
            context.is_changed = true
        }

        if (categories[i].trim() === "לילדים") {
            console.log("ילדים");
            context.is_for_children = true;
            context.is_changed = true
        }

        if (categories[i].trim() === "מבוגרים") {
            console.log("מבוגרים");
            context.is_for_children = false;
            context.is_changed = true
        }

        if (categories[i].trim() === "אשראי") {
            console.log("אשראי");
            context.is_credit_card_accepted = true;
            context.is_changed = true
        }

        if (categories[i].trim() === "לא מפחיד") {
            console.log("לא מפחיד");
            context.is_scary = false;
            context.is_changed = true

        } else if (categories[i].trim() === "מפחיד") {
            console.log("מפחיד");
            context.is_scary = true;
            context.is_changed = true
        }

        if (categories[i].trim() === "מתחילים") {
            console.log("מתחילים");
            context.is_beginner = true;
            context.is_changed = true
        }

        if (categories[i].trim() === "מנוסים") {
            console.log("מנוסים");
            context.is_beginner = false;
            context.is_changed = true

        }

        if (categories[i].trim() === "ליניארי") {
            console.log("ליניארי");
            context.is_linear = true;
            context.is_changed = true
        }

        if (categories[i].trim() === "מקבילי") {
            console.log("מקבילי");
            context.is_parallel = true;
            context.is_changed = true
        }

        if (categories[i].trim() === "קבוצה גדולה") {
            console.log("קבוצות גדולות");
            context.is_for_groups = true;
            context.is_changed = true
        }

        if (categories[i].trim() === "כפול") {
            console.log("כפול");
            context.is_double = true;
            context.is_changed = true
        }

        if (categories[i].trim() === "שחקן") {
            console.log("שחקן");
            context.is_actor = true;
            context.is_changed = true
        }
    }
    return context
}


module.exports = {
    getResponseFromWit: getResponseFromWit,
    extractEntities: extractEntities
};
