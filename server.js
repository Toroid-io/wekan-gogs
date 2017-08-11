var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var wekan2gogs = require('./wekan2gogs.js')(function(err) {
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
    console.log(req.body);
    wekan2gogs.gogs.parseHookPrio(req.body);
    res.status(200).send('OK');
});

app.post('/gogs', function (req, res) {
    //wekan2gogs.gogs.parseHook(req.body);
    res.status(200).send('OK');
});

app.post('/wekan', function (req, res) {
    console.log(req.body);
    res.status(200).send('OK');
});

app.listen(port, function() {
    console.log('Listening on port '+port);
});
