/**
 * http://usejsdoc.org/
 */
const Config = require('./config');
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

function getAvailableSlots(rooms,availability,datetime) {
    return new Promise(
        function (resolve) {
            let date = getTodayDate();
            let hour = '0:00';
            let grain = datetime.grain;

            if(datetime && datetime.from){

               let from_date = moment(datetime.from);
               let date = formatDate(from_date);

            } else {
                if(availability && availability === "פנוי היום" || availability === "פנוי" || availability === "פנוי הערב" || availability.includes("היום") || availability.includes("הערב")){
                    date = getTodayDate();
                } else if(availability && availability === "פנוי מחר" || availability.includes("מחר")){
                    date = formatDate(moment().add(1,'days'))
                } else {
                    date = getTodayDate();
                }
            }

            fetch('http://www.escaper.co.il/api/get_date?date=' + date + '&key=' + Config.ESCAPER_KEY)
                .then(function (res) {

                    return res.json();
                }).then(function (json) {
                    let available_rooms = [];
                    for(let i in rooms){
                        if(typeof rooms[i].escaper_id !== 'undefined' && json[rooms[i].escaper_id].slots.length > 0 ){
                            let filtered_slots = filterSlots(json[rooms[i].escaper_id].slots,hour,grain);
                            rooms[i].first_slot = filtered_slots[0];
                            rooms[i].slots = filtered_slots;
                            available_rooms.push(rooms[i])
                        }
                    }
                resolve(available_rooms)
            });
        });
}

function filterSlots(slots, hour,grain) {

    if(grain === "day"){
        return slots
    } else {
        let parsed_hour = moment(hour,"HH:mm");

        return slots.filter(function(slot){
            let parsed_slot = moment(slot,"HH:mm");
            let parsed_six_am = moment("6:00","HH:mm");

            if(parsed_hour.get("hour") >= 0 && parsed_hour.get("hour") <= 6){
                if( parsed_slot >= parsed_hour && parsed_slot < parsed_six_am ) return true; else return false;
            } else {
                if( parsed_slot > parsed_six_am && parsed_slot < parsed_hour) return false; else return true;
            }
        })
    }
}



function getTodayDate() {
    return formatDate(moment());
}

function formatDate(date) {
    return date.format('YYYY-MM-DD');
}

function formatHour(date) {
    return date.format('HH:mm');
}


module.exports = {
    getAvailableSlots: getAvailableSlots,
    getAvailableSlotsForToday: getAvailableSlotsForToday,
    getTodayDate: getTodayDate,
    formatDate: formatDate
};
