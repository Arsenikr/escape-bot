'use strict';

const Config = require('../config');
const mongoose = require('mongoose');
const NodeCache = require( 'node-cache' );

mongoose.Promise = global.Promise;

mongoose.connect(Config.MONGODB_URL, function (error) {
    if (error) {
        console.log(error);
    }
});

const Schema = mongoose.Schema;
const EscapeRoomsSchema = new Schema({
    room_id: Number,
    room_name: String,
    company_name: String,
    location: String,
    min_players: Number,
    max_players: Number,
    website: String,
    phone: String,
    phone_2: String,
    address: String,
    latitude: Number,
    longitude: Number,
    number_of_same_rooms: Number,
    soldier_discount: Number,
    soldier_discount_weekend: Number,
    student_discount: Number,
    student_discount_weekend: Number,
    children_discount: Number ,
    children_discount_weekend: Number,
    is_gift_card: Number,
    escape_card: Number,
    birthday_discount: Number,
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

function findRoomInDb(context) {
    return new Promise(
        function (resolve, reject) {

            let cloc_promise = location_cleanup(context.location);
            let cnop_promise = nop_cleanup(context.num_of_people);

            Promise.all([cloc_promise, cnop_promise]).then(values => {
                let cleaned_location = values[0];
                let cleaned_nop = values[1];
                context.location = cleaned_location;
                context.num_of_people = cleaned_nop;
                console.log(cleaned_nop);
                let loc_query = {};
                if(cleaned_location) loc_query = {'$or': [{"location": {'$regex': cleaned_location}}, {"region": {'$regex': cleaned_location}}, {"region_2": {'$regex': cleaned_location}}]};
                let nop_query = {};
                if(cleaned_nop > 1) nop_query = {'$and': [{"max_players": {'$gte': cleaned_nop}},{"min_players": {'$lte': cleaned_nop}}]};
                EscapeRoom.find({'$and': [loc_query, nop_query ]}, {
                    'room_id': true,
                    'room_name': true,
                    'company_name': true,
                    'website': true,
                    'phone': true,
                    'phone_2': true,
                    'address': true,
                    'latitude': true,
                    'longitude': true
                }).then(function (docs) {
                    if (docs && docs.length > 0) {

                        chooseNDocs(docs).then(result =>
                        resolve(result))
                    } else {
                        resolve(undefined)
                    }
                })
            }).catch(function (err) {
                if (err) {
                    reject(err);
                }
            });
        });
}


function findRoomByName(room_name) {
    return new Promise(
        function (resolve, reject) {

            console.log("trying to find by name: " + room_name);

            EscapeRoom.find({"room_name": {'$regex': room_name, '$options': 'i'}}, {
                'room_id': true,
                'room_name': true,
                'company_name': true,
                'website': true,
                'phone': true,
                'phone2': true,
                'address': true,
                'latitude': true,
                'longitude': true
            }).then(function (docs) {
                if (docs && docs.length > 0) {
                    chooseNDocs(docs).then(result =>
                        resolve(result))
                } else resolve(undefined)

            }).catch( function (err) {
                if(err){
                    reject(err);
                }
            })
        });
}

function findRoomsByCompany(company_name) {
    return new Promise(
        function (resolve, reject) {

            console.log("trying to find by company: " + company_name);

            EscapeRoom.find({"company_name": new RegExp('^' + company_name, 'i')}, {
                'room_id': true,
                'room_name': true,
                'company_name': true,
                'website': true,
                'phone': true,
                'phone2': true,
                'address': true,
                'latitude': true,
                'longitude': true
            }).then(function (docs) {
                if (docs && docs.length > 0) {
                    console.log("found " + docs.length + "rooms");
                    chooseNDocs(docs).then(result =>
                        resolve(result))
                } else return resolve(undefined)

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
            if(location) {
                if (location.charAt(0) === 'ב')
                    return resolve(location.substr(1));
                else return resolve(location)
            } else {
                return resolve(undefined)
            }
        });

}

function nop_cleanup(number_of_people) {
    return new Promise(
        function (resolve) {

            if (number_of_people) {
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

module.exports = {
    findRoomInDb: findRoomInDb,
    findRoomByName: findRoomByName,
    location_cleanup: location_cleanup,
    findRoomsByCompany: findRoomsByCompany,
    findEasterEgg: findEasterEgg,
    findRoomById: findRoomById,
    findErrorMessage: findErrorMessage

};
