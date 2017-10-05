var server = require('./server.js')
    , fs = require('fs');
const exec = require('child_process').exec;

var main = function() {
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

    require('./wekan-gogs.js')(config, function(err, w2g) {
        if (err) {
            console.log(err);
            process.exit(1);
        } else {
            server.run(w2g);
        }
    });
}

fs.stat('/wekan-gogs/data/wekan-gogs.db', function(err, stat) {
    if (!err) {
        main();
    } else if (err.code == 'ENOENT') {
        // Create database
        exec('cat wekan-gogs.sqlite | sqlite3 data/wekan-gogs.db', function(err) {
            if (err != null) {
                console.log('Error creating database: ', err);
                process.exit(1);
            }
            main();
        });
    }
});

