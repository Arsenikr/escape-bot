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
    max_players: Number
});

// Mongoose Model definition
var EscapeRoom = mongoose.model('escape_rooms', EscapeRoomsSchema);


function findRoomInDb(location,num_of_people,callback) {
    location_cleanup(location, function(cleaned_location) {

       nop_cleanup(num_of_people, function (cleaned_nop) {

        console.log(cleaned_nop);

    EscapeRoom.find({'$and': [ {"location": {'$regex': cleaned_location}},{"max_players": {'$gt': cleaned_nop}}]},{'room_name': true},function(err, docs) {
        if (err) {
            handleError(res, err.message, "Failed to get rooms.");
        } else {
            if(docs.length > 0){
                var i = Math.floor(Math.random() * (docs.length -1));
                console.log("found " + docs[i].room_name);
                return callback(docs[i].room_name)
            } else return callback(undefined)
        }
    })
        });


    });
}

function findRoomByName(room_name,callback) {
    console.log("trying to find " + room_name);

    EscapeRoom.find({"room_name": {'$regex': room_name}},{'room_name': true,'location': true},function(err, docs) {
            if(docs.length > 0){
                console.log("found " + docs[0].room_name);
                return callback(docs[0].room_name + " נמצא ב" + docs[0].location)
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

module.exports = {
    findRoomInDb: findRoomInDb,
    findRoomByName: findRoomByName
};
