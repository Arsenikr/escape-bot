'use strict';

const request = require('request');
const Config = require('../../config');

// SETUP A REQUEST TO FACEBOOK SERVER
const newRequest = request.defaults({
	uri: 'https://graph.facebook.com/v2.6/me/messages',
	method: 'POST',
	json: true,
	qs: {
		access_token: Config.FB_PAGE_TOKEN
	},
	headers: {
		'Content-Type': 'application/json'
	}
});


function getUserProfile(user_id) {
    return new Promise(
        function (resolve, reject) {
           

            request('https://graph.facebook.com/v2.6/' + user_id + '?fields=first_name,last_name,profile_pic,locale,timezone,gender&access_token=' + Config.FB_PAGE_TOKEN, function (err, resp, data) {
                if (err) {
                    reject(err || data.error && data.error.message)
                } else {
                    resolve(JSON.parse(data))
                }
            });
        });
}

// SETUP A MESSAGE FOR THE FACEBOOK REQUEST
function newSimpleMessage(recipientId, msg,quick_replies) {
    return new Promise(
        function (resolve, reject) {

            let opts = {
                form: {
                    recipient: {
                        id: recipientId
                    }
                }
            };

            let message = {
                text: msg
            };
            opts.form.message = message;
            if(quick_replies){
                opts.form.message.quick_replies = quick_replies
            }

            newRequest(opts, function (err, resp, data) {
                if (err) {
                    reject(err || data.error && data.error.message)
                } else {
                    resolve(data)
                }
            });

        });
}

    function newListMessage(recipientId, elements,slice) {

        return new Promise(
            function (resolve, reject) {

                let opts = {
                    form: {
                        recipient: {
                            id: recipientId
                        }
                    }
                };

                if (elements && elements.length > 0 && slice < elements.length) {
                    let sliced_elements = elements.slice(slice,slice+4);
                    let message = {
                        attachment: {
                            type: 'template',
                            payload: {
                                template_type: 'list',
                                top_element_style: 'compact',
                                elements: sliced_elements

                            }
                        }
                    };
                    if((slice+4) < elements.length){
                        message.attachment.payload.buttons = [
                            {
                                title: "הצג עוד חדרים",
                                "type": "postback",
                                "payload": "MORE_ROOMS_" + (slice+4)
                            }
                        ]
                    }
                    opts.form.message = message;

                    newRequest(opts, function (err, resp, data) {
                        if (err) {
                            reject(err || data.error && data.error.message)
                        } else {
                            resolve(data)
                        }
                    });

                }
            });
}

function newStructuredMessage(recipientId, elements) {

    return new Promise(
        function (resolve, reject) {

            let opts = {
                form: {
                    recipient: {
                        id: recipientId
                    }
                }
            };

            if (elements && elements.length > 0) {
                let message = {
                    attachment: {
                        type: 'template',
                        payload: {
                            template_type: 'generic',
                            image_aspect_ratio: 'horizontal',
                            elements: elements
                        }
                    }
                };
                opts.form.message = message;

                newRequest(opts, function (err, resp, data) {
                    if (err || data.error) {
                        reject(err || data.error && data.error.message)
                    } else {
                        resolve(data)
                    }
                });

            }


        });
}


function newButtonsMessage(recipientId,text, buttons) {

    return new Promise(
        function (resolve, reject) {

            let opts = {
                form: {
                    recipient: {
                        id: recipientId
                    }
                }
            };

            if (buttons && buttons.length > 0) {
                let message = {
                    attachment: {
                        type: 'template',
                        payload: {
                            template_type: 'button',
                            text: text,
                            buttons: buttons
                        }
                    }
                };
                opts.form.message = message;

                newRequest(opts, function (err, resp, data) {
                    if (err || data.error) {
                        reject(err || data.error && data.error.message)
                    } else {
                        resolve(data)
                    }
                });
            }
        });
}

function newVideoMessage(recipientId, url) {

    return new Promise(
        function (resolve, reject) {

            let opts = {
                form: {
                    recipient: {
                        id: recipientId
                    }
                }
            };

                let message = {
                    attachment: {
                        type: 'video',
                        payload: {
                            url: url
                        }
                    }
                };
                opts.form.message = message;

                newRequest(opts, function (err, resp, data) {
                    if (err) {
                        reject(err || data.error && data.error.message)
                    } else {
                        resolve(data)
                    }
                });



        });
}

function newSenderAction(recipientId, action) {
    return new Promise(
        function (resolve, reject) {

            let opts = {
                form: {
                    recipient: {
                        id: recipientId
                    }
                }
            };

            opts.form.sender_action = action;

            newRequest(opts, function (err, resp, data) {
                if (err) {
                    reject(err || data.error && data.error.message)
                } else {
                    resolve(data)
                }
            });

        });
}


// PARSE A FACEBOOK MESSAGE to get user, message body, or attachment
// https://developers.facebook.com/docs/messenger-platform/webhook-reference
 function getMessageEntry (body) {
	let val = body.object === 'page' &&
						body.entry &&
						Array.isArray(body.entry) &&
						body.entry.length > 0 &&
						body.entry[0] &&
						body.entry[0].messaging &&
						Array.isArray(body.entry[0].messaging) &&
						body.entry[0].messaging.length > 0 &&
						body.entry[0].messaging[0];
	return val || null
}

module.exports = {
    newRequest: newRequest,
    newSimpleMessage: newSimpleMessage,
    newStructuredMessage: newStructuredMessage,
    newButtonsMessage: newButtonsMessage,
    newListMessage: newListMessage,
    newVideoMessage: newVideoMessage,
    newSenderAction: newSenderAction,
    getMessageEntry: getMessageEntry,
    getUserProfile: getUserProfile
};