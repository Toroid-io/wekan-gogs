var request = require('request');

var addToBody = function(url, data) {
    var options = {
        url: gogs.baseUrl+'/api/v1'+url,
        json: true,
        headers: {
            'Authorization': 'token '+gogs.token
        },
        body: {}
    };

    for (var k in data) {
        if (data.hasOwnProperty(k)) {
            options.body[k] = data[k];
        }
    }

    return options;
}

var gogs = {
    baseUrl: null,
    user: null,
    pass: null,
    token: null,
    Users: {
        createToken: function(appName, callback) {
            if (!gogs.user || !gogs.pass) {
                callback('user/pass not set in client!', null);
            }
            var opts = addToBody('/users/'+gogs.user+'/tokens', {
                name: appName
            });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    callback(err, null);
                } else {
                    callback(null, body.sha1);
                }
            }).auth(gogs.user, gogs.pass);
        }
    }
};

module.exports = function(baseUrl, user, pass, token) {
    gogs.baseUrl = baseUrl;
    if ((!user || !pass) && !token) {
        console.log('user/pass or token must be set!');
        return null;
    }
    gogs.user = user;
    gogs.pass = pass;
    gogs.token = token;
    return gogs;
};
