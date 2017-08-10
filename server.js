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
require('./wekan.js')('http://localhost:8002',
    'am',
    'G2~)4%735tjiA@85(|S9a@RTp',
    function(err, _wekan) {
        if (err != null) {
            coonsole.log('Error initializing wekan module');
            process.exit(1);
        }
        wekan = _wekan;
        gogs = require('./gogs.js')(
            'http://localhost:8001',
            db,
            wekan
        );
    });

var port = 7654;
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
    console.log(req.body.issue.labels);
    res.status(200).send('OK');
});

app.post('/wekan', function (req, res) {
    console.log(req.body);
    res.status(200).send('OK');
});

app.listen(port, function() {
    console.log('Listening on port '+port);
});
