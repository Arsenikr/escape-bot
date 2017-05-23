/**
 * Created by Arseny on 05/05/2017.
 */


const Config = require('./config');
const moment = require('moment');
const fetch = require('node-fetch');
const DB = require('./model/mongoose');


function updateDataFromRoomRun() {
    return new Promise(
        function (resolve) {


            fetch('http://www.room.run/api/he/items/search?country_code=IL&size=500')
                .then(function (res) {

                    return res.json();
                }).then(function (json) {
                    let roomrun_data = json.hits.hits;
                for (let key in roomrun_data) {
                    let roomrum_id = roomrun_data[key].id
                    DB.findRoomByRoomRunId(roomrum_id).then( room_data => {
                        if(room_data){
                            mergeWithRoomRunData(room_data,roomrun_data[key])
                        } else {
                            createNewRoomFromRoomRun(roomrun_data[key])
                        }
                    })
                }



                resolve()
            });
        });
}



module.exports = {
    getAvailableSlots: getAvailableSlots,
    getAvailableSlotsForToday: getAvailableSlotsForToday
};
