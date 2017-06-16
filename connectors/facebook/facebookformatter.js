/**
 * Created by Arseny on 19/05/2017.
 */
const GeoPoint = require('geopoint');
const FB = require('./facebookapi');

function createRoomsList(context,response) {
    let list = [];
 
    if (response) {
        for (let i = 0; i < response.length; i++) {
            let geo_distance = undefined;
            if(context.lat && context.lon){
                let point1 = new GeoPoint(response[i].latitude,response[i].longitude);
                let point2 = new GeoPoint(context.lat,context.lon);
                geo_distance = point1.distanceTo(point2, true);
                geo_distance = +geo_distance.toFixed(1);
            }

            let subtitle = "";
            if(typeof response[i].slots !== 'undefined' ){
                subtitle += response[i].slots.slice(0,3) + "\n"
            }

            if(geo_distance){
                subtitle += response[i].address + " - " + geo_distance + " ק״מ ממך" + "\n"
            } else {
                subtitle += response[i].address; //+ "\n" + " טל׳: " + response[i].phone;
            }


            let url_button = {
                    title: 'הזמנ/י',
                    type: 'web_url',
                    url: response[i].website || "",
                    messenger_extensions: false,
                    webview_height_ratio: 'tall'
                },
                info_button = {
                    title: 'למידע נוסף',
                    type: 'postback',
                    payload: "MORE_INFO_" + response[i].room_id
                },
                nav_button = {
                    title: 'נווט עם waze',
                    type: 'web_url',
                    url: response[i].waze_link
                },
                buttons = [info_button],
                default_action = {
                    type: 'web_url',
                    url: response[i].website || "",
                    messenger_extensions: false,
                    webview_height_ratio: 'tall'
                },

                element = {
                    title: response[i].room_name[0],
                    subtitle: subtitle,
                    buttons: buttons,
                    default_action: default_action

                };

            list.push(element);
            // });
        }
    }
    return list
}

function createMenuItem(title, payload, image_url) {
    let postback_button = {
            title: title,
            type: 'postback',
            payload: payload
        }, buttons = [postback_button],

        element = {
            title: title,
            buttons: buttons,
        };

    if (image_url) {
        element.image_url = image_url;
    }

    return element;
}

function createMapItem(address) {
    return {
        title: address,
        image_url: "https:\/\/maps.googleapis.com\/maps\/api\/staticmap?size=764x400&center=" + encodeURI(address) + "&zoom=16&language=he&markers=size:mid%7Ccolor:0xff0000%7Clabel:1%7C" + encodeURI(address),
        item_url: "https:\/\/www.google.com\/maps\/place\/" + address
    }
}

function createHashtagItem(hashtag) {
    return {
        title: "לביקורות על החדר בקבוצת האסקייפרים: " + hashtag,
        image_url: "https://s12.postimg.org/a73x9s2fx/roomescape.jpg",
        item_url: "https:\/\/www.facebook.com\/hashtag\/" + hashtag.substring(1)
    }
}

function createVideoItem() {
    return {
        title: "סרטון הדרכה קצר על הבוט: ",
        image_url: "https://s29.postimg.org/989go7hwn/16422306_212997062506914_6981554859388634041_o.jpg",
        item_url: "https:\/\/www.facebook.com\/escapebotil\/videos\/236731916800095\/"
    }
}


function createWazeItem(url) {
    return {
        title: "לינק לwaze:",
        image_url: "https://s14.postimg.org/ui4kd6j8h/Waze_logo.jpg",
        item_url: url
    }
}

function createMoovitItem(url) {
    return {
        title: "לינק להגעה בתח״צ:",
        image_url: "https://s18.postimg.org/fh07n5ny1/moovitnews.png",
        item_url: url
    }
}

function createPhoneButton(phone) {
    return {
        "type":"phone_number",
        "title":phone,
        "payload": "+972" + phone.substring(1)
    }
}


function createMenu(data, images) {
    let list = [];
    if (data) {
        for (let key in data) {
            list.push(createMenuItem(key, data[key], images[key]));
        }
    }
    return list
}

function createQuickReply(title, payload) {
    return {
        content_type: "text",
        title: title,
        payload: payload
    }
}


function createLocationQuickReply() {
    return {
        content_type: "location",
    }
}


function createQuickReplies(data,is_location) {
    return new Promise(
        function (resolve) {

            if (data) {

                let replies_list = [];
                if (is_location && is_location === true) {
                    replies_list.push(createLocationQuickReply())
                }

                for (let key in data) {
                    replies_list.push(createQuickReply(key, data[key]))
                }


                resolve(replies_list);
            } else resolve(undefined);
        });
}

function createGeneralMenu(context) {
    return new Promise(
        function (resolve, reject) {

            let data = {};
            let images = {};

            if (!context.location && !context.lat && !context.lon) {
                data["חיפוש לפי מיקום"] = "SEARCH_BY_LOCATION";
                images["חיפוש לפי מיקום"] = 'https://s21.postimg.org/iz4j6h3xz/globe_1290377_640.jpg';
            }
            if (!context.num_of_people || context.num_of_people < 2) {
                data["חיפוש לפי גודל קבוצה"] = "SEARCH_BY_GROUP_SIZE";
                images["חיפוש לפי גודל קבוצה"] = 'https://s23.postimg.org/9dm2s2i6z/people_467438_640.jpg';

            }
            if(!context.company_name) {
                data["חיפוש לפי חברה"] = "SEARCH_BY_COMPANY";
                images["חיפוש לפי חברה"] = "https://s12.postimg.org/caf2xxbtp/lock_1673604_640.jpg"
            }

            data["סינונים נוספים"] = "MORE_FILTERS";
            images["סינונים נוספים"] = "https://s22.postimg.org/3nxe2ovq9/labyrinth_2037903_640.jpg";


            data["חיפוש חדש"] = "NEW_SEARCH";
            images["חיפוש חדש"] = 'https://s8.postimg.org/hmfkndsit/glass_2025715_640.png';

            return resolve(createMenu(data, images));
        });
}




function drawMenu(recipient) {
    return new Promise(
        function (resolve) {
            setTimeout(function () {
                FB.newSenderAction(recipient, Config.TYPING_OFF).then(_ => {

                    createGeneralMenu(recipient).then(menu => {
                        FB.newStructuredMessage(recipient, menu);
                        return resolve(menu)
                    })
                }, 3000);
            });
        });
}

function showNewSearchQR(recipient) {
    return new Promise(
        function (resolve) {

            let data = {};
            data["חיפוש חדש"] = "NEW_SEARCH";
            createQuickReplies(data).then(qr => {
                FB.newSimpleMessage(recipient, "נסה שוב, או התחל חיפוש חדש", qr).then(r => {
                    resolve();
                });

            });
        });
}

function createLocationQR() {
    return new Promise(
        function (resolve) {

            let data = {};
            data["ב״ש"] = "LOCATION_QR1";
            data["דרום"] = "LOCATION_QR2";
            data["ראשון לציון"] = "LOCATION_QR3";
            data["ת״א"] = "LOCATION_QR4";
            data["מרכז"] = "LOCATION_QR5";
            data["חיפה"] = "LOCATION_QR6";
            data["צפון"] = "LOCATION_QR7";

            createQuickReplies(data,true).then(replies => {
                resolve(replies)
            });
        });
}

function createGroupSizeQR() {
    return new Promise(
        function (resolve) {

            let data = {};
            data["שמיניה"] = "GROUP_SIZE_Q8";
            data["שביעיה"] = "GROUP_SIZE_QR7";
            data["שישיה"] = "GROUP_SIZE_QR6";
            data["חמישיה"] = "GROUP_SIZE_QR5";
            data["רביעיה"] = "GROUP_SIZE_QR4";
            data["שלישיה"] = "GROUP_SIZE_QR3";
            data["זוג"] = "GROUP_SIZE_QR2";

            createQuickReplies(data).then(replies => {
                resolve(replies)
            });
        });
}

function createFiltersQR() {

    return new Promise(
        function (resolve) {

            let data = {};
            data["פנויים היום"] = "ROOM_FILTER_AVAILABLE_TODAY";
            data["מתאימים למתחילים"] = "ROOM_FILTER_BEGINNER";
            data["מתאימים למנוסים"] = "ROOM_FILTER_EXPERIENCED";
            data["לקבוצות גדולות"] = "ROOM_FILTER_GROUP";
            data["עם שחקן"] = "ROOM_FILTER_ACTOR";
            data["כפולים"] = "ROOM_FILTER_DOUBLE";
            data["מתאימים לילדים"] = "ROOM_FILTER_CHILDREN";
            data["מפחידים"] = "ROOM_FILTER_SCARY";
            data["מתאימים לנשים בהריון"] = "ROOM_FILTER_PREGNANT";
            data["מונגשים לנכים"] = "ROOM_FILTER_DISABLED";
            data["מותאמים לכבדי שמיעה"] = "ROOM_FILTER_HEARING";

            createQuickReplies(data).then(replies => {
                resolve(replies)
            });
        });

}

function createCompanyQR(companies) {
    return new Promise(
        function (resolve) {


                let data = {};

                if (companies && companies.length > 0) {
                    for (let key in companies) {
                        data[companies[key]] = "COMPANY_QR" + key;
                    }
                } else {
                    // show default companies
                    data["golden key"] = "COMPANY_QR1";
                    data["locked"] = "COMPANY_QR2";
                    data["rsq"] = "COMPANY_QR3";
                    data["portal y"] = "COMPANY_QR4";
                    data["inside out"] = "COMPANY_QR5";
                    data["escape city"] = "COMPANY_QR6";
                    data["questomania"] = "COMPANY_QR7";
                    data["escaperoom israel"] = "COMPANY_QR8";
                    data["brainit"] = "COMPANY_QR9";
                    data["out of the box"] = "COMPANY_QR10";
                    data["exit room"] = "COMPANY_QR11";
                }

                createQuickReplies(data).then(replies => {
                    resolve(replies)
                });
        });
}

module.exports = {
    createRoomsList:createRoomsList,
    createQuickReplies: createQuickReplies,
    createMenu: createMenu,
    createVideoItem: createVideoItem,
    createGeneralMenu: createGeneralMenu,
    drawMenu: drawMenu,
    showNewSearchQR:showNewSearchQR,
    createWazeItem:createWazeItem,
    createMoovitItem:createMoovitItem,
    createHashtagItem:createHashtagItem,
    createMapItem:createMapItem,
    createCompanyQR:createCompanyQR,
    createFiltersQR:createFiltersQR,
    createGroupSizeQR:createGroupSizeQR,
    createLocationQR:createLocationQR,
    createPhoneButton:createPhoneButton
};