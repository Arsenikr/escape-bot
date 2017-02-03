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


function chooseNRooms(docs) {
    var indicesArr = getRandomRoomIndices(Config.NUM_OF_ROOMS_TO_RETURN, docs.length);
    var ans = [];
    //TODO facebook list limit is 10, implement pagination
    for (var i = 0; i < indicesArr.length; i++) {
        console.log("found " + docs[indicesArr[i] - 1].room_name);
        ans.push(docs[indicesArr[i] - 1]);
    }
    return ans;
}

function findRoomInDb(location,num_of_people,callback) {
    location_cleanup(location, function(cleaned_location) {

       nop_cleanup(num_of_people, function (cleaned_nop) {

        console.log(cleaned_nop);

    EscapeRoom.find({'$and': [ { '$or': [{"location": {'$regex': cleaned_location}},{"region": {'$regex': cleaned_location}},{"region_2": {'$regex': cleaned_location}}]},{"max_players": {'$gt': cleaned_nop}}]},{'room_name': true,'company_name': true,'website': true,'phone': true,'phone_2':true,'address': true},function(err, docs) {
        if (err) {
            handleError(res, err.message, "Failed to get rooms.");
        } else {
            if(docs.length > 0){
                return callback(chooseNRooms(docs))
            } else return callback(undefined)
        }
    })
        });


    });
}

function findRoomByName(room_name,callback) {
    console.log("trying to find by name: " + room_name);

    EscapeRoom.find({"room_name": {'$regex': room_name,'$options': 'i'}},{'room_name': true,'company_name': true,'website': true,'phone': true,'phone2':true,'address': true},function(err, docs) {
            if(docs.length > 0){
                return callback(chooseNRooms(docs))
            } else return callback(undefined)

    })
}

function findRoomsByCompany(company_name,callback) {
    console.log("trying to find by company: " + company_name);

    EscapeRoom.find({"company_name": new RegExp('^' + company_name, 'i')},{'room_name': true,'company_name': true,'website': true,'phone': true,'phone2':true,'address': true},function(err, docs) {
        if(docs.length > 0){
            console.log("found " + docs.length + "rooms");
            return callback(chooseNRooms(docs))
        } else return callback(undefined)

    })
}

function location_cleanup(location,callback) {
    if(location.charAt(0) === 'ב' )
        return callback(location.substr(1));
    else return callback(location)
}

function nop_cleanup(number_of_people, callback) {
    if(number_of_people) {
        if (number_of_people.indexOf("שני") > -1 || number_of_people.indexOf("שתי") > -1 || number_of_people.substr(1) === '2') {
            return callback(2);
        }
        else if (number_of_people.indexOf("שלוש") > -1 || number_of_people.substr(1) === '3') {
            return callback(3);
        }
        else if (number_of_people.indexOf("ארבע") > -1 || number_of_people.substr(1) === '4') {
            return callback(4);
        }
        else if (number_of_people.indexOf("חמש") > -1 || number_of_people.indexOf("חמישה") > -1 || number_of_people.substr(1) === '5') {
            return callback(5);

        }
        else if (number_of_people.indexOf("שש") > -1 || number_of_people.indexOf("שישה") > -1 || number_of_people.substr(1) === '6') {
            return callback(6);

        }
        else if (number_of_people.indexOf("שבע") > -1 || number_of_people.substr(1) === '7') {
            return callback(7);

        }
        else if (number_of_people.indexOf("שמונה") > -1 || number_of_people.substr(1) === '8') {
            return callback(8);

        }
        else if (number_of_people.indexOf("תשע") > -1 || number_of_people.substr(1) === '9') {
            return callback(9);

        }
        else if (number_of_people.indexOf("עשר") > -1 || number_of_people.substr(1) === '10') {
            return callback(10);

        }

        else {
            return callback(1);
        }
    } else {
        return callback(1);
    }

}

function getRandomRoomIndices(num_of_rooms,total) {
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
    findRoomsByCompany: findRoomsByCompany
};
