var server = require('./server.js');

var config = {};


if (!process.env.WG_URL ||
    !process.env.WG_GOGS_URL ||
    !process.env.WG_GOGS_USERNAME ||
    !process.env.WG_GOGS_PASSWORD ||
    !process.env.WG_WEKAN_URL ||
    !process.env.WG_WEKAN_USERNAME ||
    !process.env.WG_WEKAN_PASSWORD) {

    console.log('Please set up all environment variables before execution');
    process.exit(1);
}

// Optional parameters
config.cli = (process.env.WG_CLI)?true:false;
config.gogs_token = (process.env.WG_GOGS_TOKEN)?process.env.WG_GOGS_TOKEN:null;

// Required parameters
config.gogs_url = process.env.WG_GOGS_URL;
config.gogs_username = process.env.WG_GOGS_USERNAME;
config.gogs_password = process.env.WG_GOGS_PASSWORD;
config.wekan_url = process.env.WG_WEKAN_URL;
config.wekan_username = process.env.WG_WEKAN_USERNAME;
config.wekan_password = process.env.WG_WEKAN_PASSWORD;
config.wekangogs_url = process.env.WG_URL;

var w2g = require('./wekan-gogs.js')(config, function(err) {
    if (err) {
        console.log(err);
        process.exit(1);
    } else {
        server.run(w2g);
    }
});
