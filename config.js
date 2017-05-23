'use strict';

const NEW_WIT_TOKEN = '2BWX44CBYKUGO2EUZLEXK5WZQQVMN3HJ';
const PROD_WIT_TOKEN = 'J4NWMZFXGMB3NIUJV72BMO7XBZBPGSGY';

const WIT_TOKEN = process.env.WIT_TOKEN || NEW_WIT_TOKEN;
// const WIT_TOKEN = process.env.WIT_TOKEN || PROD_WIT_TOKEN;
if (!WIT_TOKEN) {
  throw new Error('Missing WIT_TOKEN. Go to https://wit.ai/docs/quickstart to get one.')
}


// let FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN || 'EAAWWKHfJWxwBAIN85prH443HmoiysM4rDypOZBAi2RKqzcJuiyTuFUkKHedXq8ANzw96KhlBZCxAdX3wyZCAnLxMQ8MettYqeJKzhx61HpknEssdp9nIPncNVVlOceJ8CjoMdivzpVHFtsw1ZBytjTtQxyOKTgOAnYSiR7kQdwZDZD';
let FB_PAGE_TOKEN = process.env.DEV_FB_PAGE_TOKEN || 'EAAXAgUvFkuIBAN9FVo8tYZBewf4UErvwEPmX57U98bTdAuFhi1UmQHmpr7jiWlSsVajNZBdsvUJQkZBSKZA6InqlLj5XrWaTTekSREtbq67LbZCFfPV1r9ExUvjAKQ8TZCrdNa9RZAFr9qeLgaE2NMqCWi3ZCoPcZAxyZBJeRA63mxsgZDZD';
if (!FB_PAGE_TOKEN) {
	throw new Error('Missing FB_PAGE_TOKEN. Go to https://developers.facebook.com/docs/pages/access-tokens to get one.')
}

let FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'my_voice_is_my_password_verify_me';

let MONGODB_URL = process.env.PROD_MONGODB || 'mongodb://escape-bot:escape-bot@ds131109.mlab.com:31109/escape-bot';

//mongodb://escape-bot:escape-bot@ds131109.mlab.com:31109/escape-bot

let ESCAPE_ROOMS_COLLECTION = "escape_rooms_new";

let ESCAPER_KEY  = "e31e83d42f664fcda915f513bd4a92b8";
let NUM_OF_ROOMS_TO_RETURN = 10;

let GET_STARTED_PAYLOAD = "USER_STARTED_CONVERSATION";

let MARK_SEEN = "mark_seen";
let TYPING_ON = "typing_on";
let TYPING_OFF = "typing_off";

let RR_FILTERED_ROOMS = ["mahboim-inca-treasure",
    "hide-n-seek",
    "secret-files",
    "murder-scene",
    "templars-code",
    "e-enchanted-room",
    "the-mummy",
    "harry-houdini",
    "the-godfather",
    "the-king-sword",
    "mysterion",
    "paranormal-activity",
    "goldasteel",
    "incrimination",
    "tickingbomb",
    "the-nights-watch",
    "the-mobile-room",
    "escape-fortres",
    "now-what",
    "earth-quake"];

module.exports = {
    WIT_TOKEN: WIT_TOKEN,
    FB_PAGE_TOKEN: FB_PAGE_TOKEN,
    FB_VERIFY_TOKEN: FB_VERIFY_TOKEN,
    MONGODB_URL: MONGODB_URL,
    ESCAPE_ROOMS_COLLECTION: ESCAPE_ROOMS_COLLECTION,
    NUM_OF_ROOMS_TO_RETURN: NUM_OF_ROOMS_TO_RETURN,
    GET_STARTED_PAYLOAD: GET_STARTED_PAYLOAD,
    MARK_SEEN: MARK_SEEN,
    TYPING_ON: TYPING_ON,
    TYPING_OFF: TYPING_OFF,
    ESCAPER_KEY: ESCAPER_KEY,
    RR_FILTERED_ROOMS: RR_FILTERED_ROOMS
};
