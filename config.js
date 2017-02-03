'use strict';

const WIT_TOKEN = process.env.WIT_TOKEN || 'J4NWMZFXGMB3NIUJV72BMO7XBZBPGSGY'
if (!WIT_TOKEN) {
  throw new Error('Missing WIT_TOKEN. Go to https://wit.ai/docs/quickstart to get one.')
}


var FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN || 'EAAWWKHfJWxwBAIN85prH443HmoiysM4rDypOZBAi2RKqzcJuiyTuFUkKHedXq8ANzw96KhlBZCxAdX3wyZCAnLxMQ8MettYqeJKzhx61HpknEssdp9nIPncNVVlOceJ8CjoMdivzpVHFtsw1ZBytjTtQxyOKTgOAnYSiR7kQdwZDZD';
if (!FB_PAGE_TOKEN) {
	throw new Error('Missing FB_PAGE_TOKEN. Go to https://developers.facebook.com/docs/pages/access-tokens to get one.')
}

var FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'my_voice_is_my_password_verify_me'

var MONGODB_URL = process.env.PROD_MONGODB || 'mongodb://127.0.0.1:27017/escape_bot';

var ESCAPE_ROOMS_COLLECTION = "escape_rooms_new";

var NUM_OF_ROOMS_TO_RETURN = 10;

module.exports = {
  WIT_TOKEN: WIT_TOKEN,
  FB_PAGE_TOKEN: FB_PAGE_TOKEN,
  FB_VERIFY_TOKEN: FB_VERIFY_TOKEN,
  MONGODB_URL: MONGODB_URL,
  ESCAPE_ROOMS_COLLECTION: ESCAPE_ROOMS_COLLECTION,
    NUM_OF_ROOMS_TO_RETURN: NUM_OF_ROOMS_TO_RETURN
};
