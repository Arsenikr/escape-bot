'use strict';

const Config = require('../config');
const mongoose = require('mongoose');
const NodeCache = require( 'node-cache' );
const shuffle = require('shuffle-array');

mongoose.Promise = global.Promise;

mongoose.connect(Config.MONGODB_URL, function (error) {
    if (error) {
        console.log(error);
    }
});

const Schema = mongoose.Schema;
const EscapeRoomsSchema = new Schema({
    room_id: Number,
    room_name_splitted: String,
    room_name: Array,
    company_name_splitted: String,
    company_name: Array,
    location: String,
    hashtag: String,
    min_players: Number,
    max_players: Number,
    website: String,
    phone: String,
    phone_2: String,
    address: String,
    latitude: Number,
    longitude: Number,
    coordinates: {
        type: {
            type: String,
            enum: 'Point',
            default: 'Point'
        },
        coordinates: {
            type: [Number]
        }
    },
    waze_link: String,
    moovit_link: String,
    region_splitted: String,
    region: Array,
    is_double: Number,
    soldier_discount: Number,
    soldier_discount_weekend: Number,
    student_discount: Number,
    student_discount_weekend: Number,
    children_discount: Number ,
    children_discount_weekend: Number,
    is_gift_card: Number,
    escape_card: Number,
    birthday_discount: Number,
    is_actor: Number,
    is_linear: Number,
    is_parallel: Number,
    is_beginner: Number,
    is_for_children: Number,
    is_for_religious: Number,
    is_scary: Number,
    is_for_disabled: Number,
    is_for_hearing_impaired: Number,
    is_for_pregnant: Number,
    is_credit_card_accepted: Number,
    price_1: Number,
    price_2: Number,
    price_3: Number,
    price_4: Number,
    price_5: Number,
    price_6: Number,
    price_7: Number,
    price_8: Number,
    price_9: Number,
    weekend_price_1: Number,
    weekend_price_2: Number,
    weekend_price_3: Number,
    weekend_price_4: Number,
    weekend_price_5: Number,
    weekend_price_6: Number,
    weekend_price_7: Number,
    weekend_price_8: Number,
    weekend_price_9: Number
});

// Mongoose Model definition
const EscapeRoom = mongoose.model('escape_rooms', EscapeRoomsSchema,'escape_rooms_new');

const EasterEggSchema = new Schema({
   Q: String,
   A: String
});

const EasterEggs = mongoose.model('easter_eggs', EasterEggSchema,'easter_eggs');

const ErrorMessageSchema = new Schema({
    Q: String,
    A: String
});

const ErrorMessages = mongoose.model('error_messages', ErrorMessageSchema,'error_messages');

const EasterEggCache = new NodeCache({ stdTTL: 86400});

// const SessionSchema = new Schema({
//     _id: Schema.Types.ObjectId,
//     fbid: Number,
//     context: Schema.Types.Mixed
// });
//
// const Session = mongoose.model('sessions', SessionSchema,'sessions');
//
// function getSession(sessionId) {
//     return new Promise(
//         function (resolve, reject) {
//             Session.find({'sessionId': sessionId}
//                 , {
//                     'context': true
//                 }).then(docs => {
//                     if(docs && docs[0]){
//                         resolve(docs[0])
//                     } else {
//                         reject(sessionId)
//                     }
//             });
//         });
// }
//
// function createSession(sessionId,fbid) {
//     return new Promise(
//         function (resolve, reject) {
//
//             let context = JSON.stringify(
//                 {
//                     _fbid_: fbid
//                 });
//             let session = new Session({_id: sessionId,fbid: fbid, context: context});
//
//
//             session.save().then(saved_session => {
//                 resolve(saved_session);
//             })
//         });
// }

function chooseNDocs(docs,num_of_docs_to_choose) {
    return new Promise(
        function (resolve) {
            let num_to_choose = num_of_docs_to_choose || Config.NUM_OF_ROOMS_TO_RETURN;

            let indicesArr = getRandomDocIndices(num_to_choose, docs.length);
            let ans = [];
            if (docs.length === 1) {
                ans.push(docs[0]);
            } else {
                //TODO facebook list limit is 10, implement pagination
                for (let i = 0; i < indicesArr.length; i++) {
                    ans.push(docs[indicesArr[i] - 1]);
                }
            }
            return resolve(ans);
        });
}

function generateQueryFromContext(context) {
    let loc_query = {};
    if (context.location) {
        loc_query = {'$or': [{"location": {'$regex': '^' + context.location + '$'}}, {"region": {'$regex': '^' + context.location + '$'}}]};
    } else if (context.lat && context.lon) {
        loc_query = {"coordinates": {'$near': {'$geometry': {type: 'Point', coordinates: [context.lat, context.lon]}, '$maxDistance': 500000}}}
    }
    let nop_query = {};
    if (context.num_of_people > 1) {
        let single_nop_query  = {'$and': [{"min_players": {'$lte': context.num_of_people}},{"max_players": {'$gte': context.num_of_people}}]};
        let double_nop_query  = {'$and': [{'is_double': 1},{"min_players": {'$lte': context.num_of_people}},{"max_players": {'$gte': Number(context.num_of_people/2)}}]};
        nop_query = {'$or': [single_nop_query,double_nop_query]};
    }

    let double_query = {};
    if(context.is_double) double_query = {'is_double': 1};

    let company_query = {};
    if (context.company_name) company_query = {"company_name": {'$regex': context.company_name.toLowerCase()}};

    let pregnant_query = {};
    if (typeof context.is_for_pregnant !== 'undefined') pregnant_query = {"is_for_pregnant": Number(context.is_for_pregnant)};

    let disabled_query = {};
    if (typeof context.is_for_disabled !== 'undefined') disabled_query = {"is_for_disabled": Number(context.is_for_disabled)};

    let kids_query = {};
    if (typeof context.is_for_children !== 'undefined') kids_query = {"is_for_children": Number(context.is_for_children)};

    let credit_query = {};
    if (typeof context.is_credit_card_accepted !== 'undefined') credit_query = {"is_credit_card_accepted": Number(context.is_credit_card_accepted)};

    let scary_query = {};
    if (typeof context.is_scary !== 'undefined') scary_query = {"is_scary": Number(context.is_scary)};

    let beginner_query = {};
    if (typeof context.is_beginner !== 'undefined') beginner_query = {"is_beginner": Number(context.is_beginner)};

    let hearing_query = {};
    if (typeof context.is_for_hearing_impaired !== 'undefined') hearing_query = {"is_for_hearing_impaired": Number(context.is_for_hearing_impaired)};

    let linear_query = {};
    if (typeof context.is_linear !== 'undefined') linear_query = {"is_linear": Number(context.is_linear)};

    let actor_query = {};
    if (typeof context.is_actor !== 'undefined') actor_query = {"is_actor": Number(context.is_actor)};

    let parallel_query = {};
    if (typeof context.is_parallel !== 'undefined') parallel_query = {"is_parallel": Number(context.is_parallel)};

    let query = {'$and': [loc_query, nop_query, company_query, pregnant_query, double_query, disabled_query, kids_query, credit_query, scary_query, beginner_query, hearing_query,actor_query, linear_query, parallel_query]};
    return query;
}

function findRoomInDb(context) {
    return new Promise(
        function (resolve, reject) {
            if(context.location && context.location.startsWith("\"")) context.location = context.location.replace("\"","");
            let cloc_promise = location_cleanup(context.location);
            let cnop_promise = nop_cleanup(context.num_of_people);

            Promise.all([cloc_promise, cnop_promise]).then(values => {
                let cleaned_location = values[0];
                let cleaned_nop = values[1];
                if(context.is_for_groups) cleaned_nop = 8;
                context.location = cleaned_location;
                context.num_of_people = cleaned_nop;
                console.log(cleaned_nop);
                let query = generateQueryFromContext(context);
                EscapeRoom.find(query
                    , {
                        'room_id': true,
                        'room_name': true,
                        'company_name': true,
                        'website': true,
                        'phone': true,
                        'phone_2': true,
                        'address': true,
                        'latitude': true,
                        'longitude': true,
                        'waze_link': true,
                        'moovit_link': true,
                        'hashtag': true,
                        'is_for_pregnant': true,
                        'is_double': true,
                        'is_for_disabled': true,
                        'is_for_children': true,
                        'is_credit_card_accepted': true,
                        'is_scary': true,
                        'is_beginner': true,
                        'is_for_hearing_impaired': true,
                        'is_actor': true,
                        'is_linear': true,
                        'is_parallel': true
                    }).then(function (docs) {
                    if (docs && docs.length > 0) {
                        if (context.lat && context.lon) {
                            resolve(docs.slice(0, 20))
                        } else {
                            // chooseNDocs(docs).then(result =>
                            if (context.lat && context.lon){
                                resolve(docs);
                            } else {
                                resolve(shuffle(docs));
                            }
                            // )
                            // }
                        }
                    } else {
                        resolve(undefined)
                    }


                }).catch(function (err) {
                    if (err) {
                        reject(err);
                    }
                });
            });
        });
}


function findRoomByName(room_name) {
    return new Promise(
        function (resolve, reject) {

            console.log("trying to find by name: " + room_name);

            EscapeRoom.find({"room_name": room_name.toLowerCase()}, {
                'room_id': true,
                'room_name': true,
                'company_name': true,
                'website': true,
                'phone': true,
                'phone2': true,
                'address': true,
                'latitude': true,
                'longitude': true,
                'waze_link': true,
                'moovit_link': true,
                'hashtag': true,
                'is_double': true,
                'is_for_pregnant': true,
                'is_for_disabled': true,
                'is_for_children': true,
                'is_credit_card_accepted': true,
                'is_scary': true,
                'is_beginner': true,
                'is_for_hearing_impaired': true,
                'is_actor': true,
                'is_linear': true,
                'is_parallel': true
            }).then(function (docs) {
                if (docs && docs.length > 0) {
                    // chooseNDocs(docs).then(result =>
                    resolve(shuffle(docs));
                    // )
                    // }
                } else resolve(undefined)

            }).catch( function (err) {
                if(err){
                    reject(err);
                }
            })
        });
}


function findAllRooms() {
    return new Promise(
        function (resolve, reject) {


            EscapeRoom.find({}, {
                'room_id': true,
                'latitude': true,
                'longitude': true
            }).then(function (docs) {
                if (docs && docs.length > 0) {
                        resolve(docs)
                } else resolve(undefined)

            }).catch( function (err) {
                if(err){
                    reject(err);
                }
            })
        });
}

function findRoomsByCompany(context,company_name) {
    return new Promise(
        function (resolve, reject) {

            console.log("trying to find by company: " + company_name);
            let old_company = context.company_name;
            context.company_name = company_name;

            if(context.is_for_groups) context.num_of_people = 8;
            let query = generateQueryFromContext(context);
            EscapeRoom.find(query, {
                'room_id': true,
                'room_name': true,
                'company_name': true,
                'website': true,
                'phone': true,
                'phone2': true,
                'address': true,
                'latitude': true,
                'longitude': true,
                'waze_link': true,
                'moovit_link': true,
                'hashtag': true,
                'is_double': true,
                'is_for_pregnant': true,
                'is_for_disabled': true,
                'is_for_children': true,
                'is_credit_card_accepted': true,
                'is_scary': true,
                'is_beginner': true,
                'is_for_hearing_impaired': true,
                'is_actor': true,
                'is_linear': true,
                'is_parallel': true
            }).then(function (docs) {
                if (docs && docs.length > 0) {
                    console.log("found " + docs.length + "rooms");
                    // chooseNDocs(docs).then(result =>
                    resolve(shuffle(docs));
                    // )
                    // }
                } else {
                    context.company_name = old_company;
                    return resolve(undefined)
                }

            }).catch(function (err) {
                return reject(err);
            });
        });
}


    function findRoomById(room_id) {
        return new Promise(
            function (resolve, reject) {

                console.log("trying to find by id: " + room_id);
                EscapeRoom.find({"room_id": parseInt(room_id)}).then(function (docs) {
                    if (docs && docs[0]) {
                        resolve(docs[0])
                    } else {
                        let msg = 'could not find a room with id: ' + room_id;
                        console.log(msg);
                        return reject(msg)
                    }
                }).catch(function (err) {
                    return reject(err);
                });
            });

    }

function findCompaniesByContext(context) {
    return new Promise(
        function (resolve, reject) {
            let old_company = context.company_name;
            delete context.company_name;
            if(context.is_for_groups) context.num_of_people = 8;
            let query = generateQueryFromContext(context);
            context.company_name = old_company;
            EscapeRoom.find(query).distinct('company_name.0').then(function(names) {
                if (names) {
                    resolve(chooseNDocs(names,11))
                } else {
                    let msg = 'could not find company names from the context';
                    console.log(msg);
                    return reject(undefined)
                }
            }).catch(function (err) {
                return reject(undefined);
            });
        });

}


function populateEasterEggsCache() {
    return new Promise(
        function (resolve, reject) {
            EasterEggs.find({}, {'Q': true, 'A': true}).then(function (docs) {
                console.log("polulating cache (again)");
                if (docs && docs.length > 0) {
                    for (let i = 0; i < docs.length; i++) {
                        EasterEggCache.set(docs[i].Q, docs[i].A);
                    }
                    let mykeys = EasterEggCache.keys();
                    return resolve(mykeys)
                }
            }).catch( function (err) {
                return reject(err);
            });
        });
}

function findEasterEggInCache(keys,message) {
    return new Promise(
        function (resolve) {

            for (let i = 0; i < keys.length; i++) {
                if (message.indexOf(keys[i]) !== -1) {
                    return resolve(keys[i]);
                }
            }
            return resolve(undefined);
        });
}


function findEasterEgg(message) {
    return new Promise(
        function (resolve, reject) {

            console.log("trying to find easter egg: " + message);

            if (EasterEggCache.keys.length == 0) {
                let mykeys = EasterEggCache.keys;
                if (mykeys.length > 0) {
                    findEasterEggInCache(mykeys, message).then(function (ans) {
                        if (ans) {
                            EasterEggCache.get(ans, function (err, msg) {
                                if (!err) {
                                    return resolve(msg);
                                }
                            });
                        } else {
                            return resolve(undefined);
                        }
                    });
                } else {
                    populateEasterEggsCache().then(function (mykeys) {
                        findEasterEggInCache(mykeys, message).then(function (ans) {
                            if (ans) {
                                EasterEggCache.get(ans, function (err, msg) {
                                    if (!err) {
                                        return resolve(msg);
                                    }
                                });
                            } else {
                                return resolve(undefined);
                            }
                        });
                    });
                }
            }
        });
}

function findErrorMessage(message_type) {
    return new Promise(
        function (resolve, reject) {

            console.log("trying to find error message of the type: " + message_type);
            ErrorMessages.find({"Q": new RegExp('^' + message_type, 'i')}, {'A': true}).then(function (docs) {
                if (docs.length > 0) {
                    chooseNDocs(docs,1).then(result =>
                        resolve(result))
                } else return resolve(undefined)
            }).catch( function (err) {
                return reject(err);
            });
        });
}

function location_cleanup(location) {
    return new Promise(
        function (resolve) {
            if(location && location !== "קבוצות גדולות") {
                if(location.startsWith("בקיבוץ ") || location.startsWith("קיבוץ  ") || location.startsWith("במושב ") || location.startsWith("מושב ") || location.startsWith("בעיר ")) {
                    location = location.replace("בקיבוץ ", "");
                    location = location.replace("קיבוץ ", "");
                    location = location.replace("במושב ", "");
                    location = location.replace("מושב ", "");
                    location = location.replace("בעיר ", "");
                    location = location.replace("באיזור ", "");
                    location = location.replace("איזור ", "");
                    location = location.replace("אזור ", "");
                    location = location.replace("באיזור ", "");
                    location = location.replace(" הארץ", "");

                    return resolve(location)
                } else if (location.charAt(0) === 'ב') {
                        return resolve(location.substr(1));

                    } else return resolve(location)
            } else {
                return resolve(undefined)
            }
        });

}

function nop_cleanup(number_of_people) {
    return new Promise(
        function (resolve) {
            if (number_of_people) {
                if (isNaN(number_of_people) && number_of_people.charAt(0) === 'ל') number_of_people = number_of_people.substr(1); else number_of_people

                if(!isNaN(number_of_people)){
                    return resolve(number_of_people);
                } else {
                    switch (true) {
                        case number_of_people.indexOf("שני") > -1:
                        case number_of_people.indexOf("שתי") > -1:
                        case number_of_people.indexOf("זוג") > -1:
                        case number_of_people.indexOf("זוגות") > -1:
                            return resolve(2);
                            break;

                        case number_of_people.indexOf("שלוש") > -1:
                        case number_of_people.indexOf("שלישיה") > -1:
                            return resolve(3);
                            break;

                        case number_of_people.indexOf("ארבע") > -1:
                        case number_of_people.indexOf("רביעיה") > -1:
                        case number_of_people.indexOf("רביעייה") > -1:
                            return resolve(4);
                            break;

                        case number_of_people.indexOf("חמש") > -1:
                        case number_of_people.indexOf("חמישה") > -1:
                        case number_of_people.indexOf("חמישיה") > -1:
                        case number_of_people.indexOf("חמישייה") > -1:
                            return resolve(5);
                            break;

                        case number_of_people.indexOf("שש") > -1:
                        case number_of_people.indexOf("שישה") > -1:
                        case number_of_people.indexOf("שישיה") > -1:
                        case number_of_people.indexOf("שישייה") > -1:
                            return resolve(6);
                            break;

                        case number_of_people.indexOf("שבע") > -1:
                        case number_of_people.indexOf("שביעיה") > -1:
                        case number_of_people.indexOf("שביעייה") > -1:
                            return resolve(7);
                            break;

                        case number_of_people.indexOf("שמונה") > -1:
                        case number_of_people.indexOf("שמיניה") > -1:
                        case number_of_people.indexOf("שמינייה") > -1:
                            return resolve(8);
                            break;

                        case number_of_people.indexOf("תשע") > -1:
                        case number_of_people.indexOf("תשיעיה") > -1:
                        case number_of_people.indexOf("תשיעייה") > -1:
                            return resolve(9);
                            break;

                        case number_of_people.indexOf("עשר") > -1:
                        case number_of_people.indexOf("עשיריה") > -1:
                        case number_of_people.indexOf("עשירייה") > -1:
                            return resolve(10);
                            break;

                        default:
                            return resolve(1);
                            break;

                    }
                }
            } else {
                return resolve(1);
            }

        });

}


function getRandomDocIndices(num_of_rooms, total) {
    let arr = [];
    while(arr.length < Math.min(total,num_of_rooms)){
        let randomnumber = Math.ceil(Math.random()*total);
        if(arr.indexOf(randomnumber) > -1) continue;
        arr[arr.length] = randomnumber;
    }
    return arr;

}

function postProcess() {
    return new Promise(
        function (resolve, reject) {

            EscapeRoom.find().then(function (docs) {
                let re = "|";

                for (let key in docs) {
                    console.log(docs[key].room_name_splitted);
                    let room_name_splitted = docs[key].room_name_splitted.split(re);
                    for(let k in room_name_splitted){
                        room_name_splitted[k] = room_name_splitted[k].trim();
                    }
                    docs[key].room_name = room_name_splitted;

                    let company_name_splitted = docs[key].company_name_splitted.split(re);
                    for(let k in company_name_splitted){
                        company_name_splitted[k] = company_name_splitted[k].trim();
                    }

                    docs[key].company_name = company_name_splitted;

                    if(docs[key].region_splitted) {
                        let region_splitted = docs[key].region_splitted.split(re);
                        for (let k in region_splitted) {
                            region_splitted[k] = region_splitted[k].trim();
                        }

                        docs[key].region = region_splitted;
                    }

                    if(docs[key].latitude && docs[key].longitude) {
                        let coords = [docs[key].latitude, docs[key].longitude];
                        docs[key].coordinates.coordinates = coords;
                    }
                    docs[key].save(function (err, updatedRoom) {
                        if (err){
                            console.log(docs[key].room_name_splitted + ": " + err);
                        }
                        console.log(updatedRoom.room_name[0] + " is updated")
                    });

                }
                resolve()
            }).catch(function (err) {
                return reject(err);
            });
        });

}


module.exports = {
    findRoomInDb: findRoomInDb,
    findRoomByName: findRoomByName,
    findRoomsByCompany: findRoomsByCompany,
    findEasterEgg: findEasterEgg,
    findRoomById: findRoomById,
    findCompaniesByContext: findCompaniesByContext,
    findErrorMessage: findErrorMessage,
    findAllRooms: findAllRooms,
    postProcess: postProcess

};
