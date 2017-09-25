var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var w2g = require('./wekan2gogs.js')(function(err) {
    if (err) {
        console.log(err);
        process.exit(1);
    }
});

const port = 7654;
var app = express();

app.use(morgan('dev')); //Logging
app.use(bodyParser.json());

app.post('/gogs/priority', function (req, res) {
    w2g.gogs.parseHookPrio(req.body);
    res.status(200).send('OK');
});

app.post('/gogs', function (req, res) {
    w2g.gogs.parseHook(req.body);
    res.status(200).send('OK');
});

app.post('/wekan/priority', function (req, res) {
    w2g.wekan.parseHook(req.body, true);
    res.status(200).send('OK');
});

app.post('/wekan', function (req, res) {
    w2g.wekan.parseHook(req.body, false);
    res.status(200).send('OK');
});

app.listen(port, function() {
    console.log('Listening on port '+port);
});
