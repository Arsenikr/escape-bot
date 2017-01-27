'use strict'

var Config = require('../config')
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


function findRoomInDb(location,callback) {
    location_cleanup(location, function(cleaned_location) {

    EscapeRoom.find({"location": {'$regex': cleaned_location}},{'room_name': true},function(err, docs) {
        if (err) {
            handleError(res, err.message, "Failed to get rooms.");
        } else {
            if(docs.length > 0){
                var i = Math.floor(Math.random() * (docs.length -1));
                return callback(docs[i].room_name)
            } else return callback( "חדרים אבל לא מכיר את " + location)
        }
    })


    });
}

function location_cleanup(location,callback) {
    if(location.charAt(0) === 'ב' )
        return callback(location.substr(1));
    else return callback(location)
}


module.exports = {
    findRoomInDb: findRoomInDb,
}
