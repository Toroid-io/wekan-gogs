var fs = require('fs')
    , ini = require('ini')
    , server = require('./server.js');

var config = {};

if (fs.existsSync('./wekan-gogs.ini')) { 
    config = ini.parse(fs.readFileSync('./wekan-gogs.ini', 'utf-8'));
} else {

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

    config.cli = (process.env.WG_CLI)?true:false;
    config.gogs_token = (process.env.WG_GOGS_TOKEN)?process.env.WG_GOGS_TOKEN:null;

    config.gogs_url = process.env.WG_GOGS_URL;
    config.gogs_username = process.env.WG_GOGS_USERNAME;
    config.gogs_password = process.env.WG_GOGS_PASSWORD;
    config.wekan_url = process.env.WG_WEKAN_URL;
    config.wekan_username = process.env.WG_WEKAN_USERNAME;
    config.wekan_password = process.env.WG_WEKAN_PASSWORD;
    config.wekangogs_url = process.env.WG_URL;

    fs.writeFileSync('./wekan-gogs.ini', ini.stringify(config));
}

var w2g = require('./wekan2gogs.js')(config, function(err) {
    if (err) {
        console.log(err);
        process.exit(1);
    } else {
        server.run(w2g);
    }
});
