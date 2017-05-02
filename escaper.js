/**
 * http://usejsdoc.org/
 */
const Config = require('./config');
const DB = require('./connectors/mongoose');
const FB = require('./connectors/facebook');
const moment = require('moment');
const fetch = require('node-fetch');


function getAvailableSlotsForToday(escaper_id) {
    return new Promise(
        function (resolve) {

            let date = getTodayDate();
            fetch('http://www.escaper.co.il/api/get_date?date=' + date + '&key=' + Config.ESCAPER_KEY)
                .then(function (res) {

                    return res.json();
                }).then(function (json) {
                resolve(json[escaper_id].slots)
            });
        });
}

function getAvailableSlots(rooms,availability) {
    return new Promise(
        function (resolve) {
            let date = getTodayDate();
            if(availability === "פנוי היום" || availability === "פנוי" || availability === "פנוי הערב" || availability.includes("היום") || availability.includes("הערב")){
                date = getTodayDate();
            } else if(availability === "פנוי מחר" || availability.includes("מחר")){
                date = formatDate(moment().add(1,'days'))
            } else {
                date = getTodayDate();
            }

            fetch('http://www.escaper.co.il/api/get_date?date=' + date + '&key=' + Config.ESCAPER_KEY)
                .then(function (res) {

                    return res.json();
                }).then(function (json) {
                    let available_rooms = [];
                    for(let i in rooms){
                        if(typeof rooms[i].escaper_id !== 'undefined' && json[rooms[i].escaper_id].slots.length > 0 ){
                            rooms[i].first_slot = json[rooms[i].escaper_id].slots[0];
                            rooms[i].slots = json[rooms[i].escaper_id].slots;
                            available_rooms.push(rooms[i])
                        }
                    }
                resolve(available_rooms)
            });
        });
}


function getTodayDate() {
    return formatDate(moment());
}

function formatDate(date) {
    return date.format('YYYY-MM-DD');
}


module.exports = {
    getAvailableSlots: getAvailableSlots,
    getAvailableSlotsForToday: getAvailableSlotsForToday
};
