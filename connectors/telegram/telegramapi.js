/**
 * Created by Arseny on 17/06/2017.
 */
const TOKEN = "417781282:AAGq1n0vtYqcy5gsesep1msbGV9Qk8XJ_kk";
const Tgfancy = require("tgfancy");

const options = {
    webHook: {
        // Port to which you should bind is assigned to $PORT variable
        // See: https://devcenter.heroku.com/articles/dynos#local-environment-variables
        port: process.env.PORT
        // you do NOT need to set up certificates since Heroku provides
        // the SSL certs already (https://<app-name>.herokuapp.com)
        // Also no need to pass IP because on Heroku you need to bind to 0.0.0.0
    }
};

const Bot = new Tgfancy(TOKEN, options);

// Heroku routes from port :443 to $PORT
// Add URL of your app to env variable or enable Dyno Metadata
// to get this automatically
// See: https://devcenter.heroku.com/articles/dyno-metadata
const url = process.env.APP_URL || 'https://escape-bot-backend.herokuapp.com:443';


// This informs the Telegram servers of the new webhook.
// Note: we do not need to pass in the cert, as it already provided
Bot.setWebHook(`${url}/bot${TOKEN}`);


// Just to ping!
Bot.on('message', function onMessage(msg) {
    Bot.sendMessage(msg.chat.id, 'I am alive on Heroku!');
});


