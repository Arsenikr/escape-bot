'use strict';

var Config = require('../config');
var mongoose = require('mongoose');

mongoose.Promise = global.Promise;

mongoose.connect(Config.MONGODB_URL, function (error) {
    if (error) {
        console.log(error);
    }
});

var Schema = mongoose.Schema;
var EscapeRoomsSchema = new Schema({
    room_name: String,
    company_name: String,
    location: String,
    min_players: Number,
    max_players: Number,
    website: String,
    phone: String,
    phone_2: String,
    address: String
});

// Mongoose Model definition
var EscapeRoom = mongoose.model('escape_rooms', EscapeRoomsSchema,'escape_rooms_new');

var EasterEggSchema = new Schema({
   Q: String,
   A: String
});

var EasterEggs = mongoose.model('easter_eggs', EasterEggSchema,'easter_eggs');

var ErrorMessageSchema = new Schema({
    Q: String,
    A: String
});

var ErrorMessages = mongoose.model('error_messages', ErrorMessageSchema,'error_messages');

function chooseNDocs(docs,num_of_docs_to_choose) {
    var num_to_choose = num_of_docs_to_choose || Config.NUM_OF_ROOMS_TO_RETURN;
    var indicesArr = getRandomDocIndices(num_to_choose, docs.length);
    var ans = [];
    if(docs.length === 1){
        ans.push(docs[0]);
    } else {
        //TODO facebook list limit is 10, implement pagination
        for (var i = 0; i < indicesArr.length; i++) {
            console.log("found " + docs[indicesArr[i] - 1].room_name);
            ans.push(docs[indicesArr[i] - 1]);
        }
    }
    return ans;
}

function findRoomInDb(location, num_of_people) {
    return new Promise(
        function (resolve, reject) {

            var cleaned_location = location_cleanup(location);
            var cleaned_nop = nop_cleanup(num_of_people);

            console.log(cleaned_nop);

            EscapeRoom.find({'$and': [{'$or': [{"location": {'$regex': cleaned_location}}, {"region": {'$regex': cleaned_location}}, {"region_2": {'$regex': cleaned_location}}]}, {"max_players": {'$gt': cleaned_nop}}]}, {
                'room_name': true,
                'company_name': true,
                'website': true,
                'phone': true,
                'phone_2': true,
                'address': true
            }, function (err, docs) {
                if (err) {
                    reject(err.message, "Failed to get rooms.");
                } else {
                    if (docs && docs.length > 0) {
                        resolve(chooseNDocs(docs))
                    } resolve(undefined)
                }
            })
        });
}


function findRoomByName(room_name) {
    return new Promise(
        function (resolve, reject) {

            console.log("trying to find by name: " + room_name);

            EscapeRoom.find({"room_name": {'$regex': room_name, '$options': 'i'}}, {
                'room_name': true,
                'company_name': true,
                'website': true,
                'phone': true,
                'phone2': true,
                'address': true
            }, function (err, docs) {
                if(err){
                    reject(err);
                } else if (docs && docs.length > 0) {
                    resolve(chooseNDocs(docs))
                } else resolve(undefined)

            })
        });
}

function findRoomsByCompany(company_name,callback) {
    console.log("trying to find by company: " + company_name);

    EscapeRoom.find({"company_name": new RegExp('^' + company_name, 'i')},{'room_name': true,'company_name': true,'website': true,'phone': true,'phone2':true,'address': true},function(err, docs) {
        if(docs && docs.length > 0){
            console.log("found " + docs.length + "rooms");
            return callback(chooseNDocs(docs))
        } else return callback(undefined)

    })
}

function findEasterEgg(message, callback) {
    console.log("trying to find easter egg: " + message);

    EasterEggs.find({"Q": {'$regex': message}}, {'A': true}, function (err, docs) {

        if (docs && docs.length > 0) {
            var cc = chooseNDocs(docs, 1);
            return callback(cc);
        }  else return callback(undefined)
    });
}

function findErrorMessage(message_type,callback) {
    console.log("trying to find error message of the type: " + message_type);
    ErrorMessages.find({"Q": new RegExp('^' + message_type, 'i')}, {'A': true}, function (err, docs) {
        if (docs.length > 0) {
            return callback(chooseNDocs(docs, 1))
        }  else return callback(undefined)
    });
}

function location_cleanup(location) {
            if (location.charAt(0) === 'ב')
                return location.substr(1);
            else return location;
}

function nop_cleanup(number_of_people) {
            if (number_of_people) {
                if (number_of_people.indexOf("שני") > -1 || number_of_people.indexOf("שתי") > -1 || number_of_people.substr(1) === '2') {
                    return 2;
                }
                else if (number_of_people.indexOf("שלוש") > -1 || number_of_people.substr(1) === '3') {
                    return 3;
                }
                else if (number_of_people.indexOf("ארבע") > -1 || number_of_people.substr(1) === '4') {
                    return 4;
                }
                else if (number_of_people.indexOf("חמש") > -1 || number_of_people.indexOf("חמישה") > -1 || number_of_people.substr(1) === '5') {
                    return 5;

                }
                else if (number_of_people.indexOf("שש") > -1 || number_of_people.indexOf("שישה") > -1 || number_of_people.substr(1) === '6') {
                    return 6;

                }
                else if (number_of_people.indexOf("שבע") > -1 || number_of_people.substr(1) === '7') {
                    return 7;

                }
                else if (number_of_people.indexOf("שמונה") > -1 || number_of_people.substr(1) === '8') {
                    return 8;

                }
                else if (number_of_people.indexOf("תשע") > -1 || number_of_people.substr(1) === '9') {
                    return 9;

                }
                else if (number_of_people.indexOf("עשר") > -1 || number_of_people.substr(1) === '10') {
                    return 10;

                }

                else {
                    return 1;
                }
            } else {
                return 1;
            }
}

function getRandomDocIndices(num_of_rooms, total) {
    var arr = [];
    while(arr.length < Math.min(total,num_of_rooms)){
        var randomnumber = Math.ceil(Math.random()*total);
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
    findErrorMessage: findErrorMessage

};
