var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var request = require('request');
var sqlite3 = require('sqlite3');
// Create or open DB
var db = new sqlite3.Database('gogsWekan.db',
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    function(err) {
        if (err != null) {
            console.log('Error opening gogs database!');
            process.exit(1);
        }
    });
db.serialize(); //sticky

var wekan, gogs;

var init = function(gurl, gusr, gpass, gtoken, wurl, wusr, wpass) {
    require('./wekan.js')(wurl, wusr, wpass,
        function(err, _wekan) {
            if (err != null) {
                console.log('Error initializing wekan module');
                process.exit(1);
            }
            wekan = _wekan;
            gogs = require('./gogs.js')(gurl, gusr, gpass, gtoken, db, wekan);
        });
};

// Get usr && pass from database, or prompt user input
db.get('SELECT * FROM auth', function(err, row) {
    if (err == null && row != undefined) {
        // Full info in database
        console.log('Found credentials in database!');
        init(row.gogs_url, null,
            null, row.gogs_token,
            row.wekan_url, row.wekan_username,
            row.wekan_password);
    } else {
        // Missing data, prompt user input
        var prompt = require('prompt');
        var schema = {
            properties: {
                gogs_url: {
                    required: true
                },
                gogs_username: {
                    required: true
                },
                gogs_password: {
                    required: true,
                    hidden: true
                },
                wekan_url: {
                    required: true
                },
                wekan_username: {
                    required: true
                },
                wekan_password: {
                    required: true,
                    hidden: true
                }
            }
        };
        prompt.start();
        prompt.get(schema, function (err, result) {
            if (err != null) {
                console.log('Error reading credentials!');
                process.exit(1);
            }
            db.run('INSERT INTO auth (gogs_url, gogs_username, \
                gogs_password, wekan_url, wekan_username, \
                wekan_password) VALUES \
                (?,?,?,?,?,?)', result.gogs_url,
                result.gogs_username,
                result.gogs_password,
                result.wekan_url,
                result.wekan_username,
                result.wekan_password);

            init(result.gogs_url,
                result.gogs_username,
                result.gogs_password,
                null,
                result.wekan_url,
                result.wekan_username,
                result.wekan_password);
        });
    }
});

const port = 7654;
var app = express();

app.use(morgan('dev')); //Logging
app.use(bodyParser.json());

app.post('/gogs/priority', function (req, res) {
    console.log(req.body);
    gogs.parseHookPrio(req.body);
    res.status(200).send('OK');
});

app.post('/gogs', function (req, res) {
    //gogs.parseHook(req.body);
    res.status(200).send('OK');
});

app.post('/wekan', function (req, res) {
    console.log(req.body);
    res.status(200).send('OK');
});

app.listen(port, function() {
    console.log('Listening on port '+port);
});
