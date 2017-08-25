var request = require('request');

var addToBody = function(url, data) {
    var options = {
        url: wekan.baseUrl+url,
        json: true,
        headers: {
            'Authorization': 'Bearer '+wekan.adminToken
        },
        body: {
            userId: wekan.adminId
        }
    };

    for (var k in data) {
        if (data.hasOwnProperty(k)) {
            options.body[k] = data[k];
        }
    }

    return options;
}

var wekan = {
    adminId: null,
    adminToken: null,
    Boards: {
        create: function(title, cb) {
            var opts = addToBody('/api/boards', {
                title: title,
                owner: wekan.adminId
            });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body._id);
                }
            });
        },
        get: function(cb) {
            var opts = addToBody('/api/users/'+wekan.adminId+'/boards', {});
            request.get(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        delete: function(boardId, cb) {
            var opts = addToBody('/api/boards/'+boardId, {});
            request.delete(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body._id);
                }
            });
        }
    },
    Lists: {
        create: function(title, boardId, cb) {
            var opts = addToBody('/api/boards/'+boardId+'/lists', {
                title: title,
            });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body._id);
                }
            });
        },
        get: function(boardId, cb) {
            var opts = addToBody('/api/boards/'+boardId+'/lists', {});
            request.get(opts, function (err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        }
    },
    Cards: {
        create: function(title, description, boardId,
            listId, cb) {
                var opts = addToBody('/api/boards/'+boardId+'/lists/'+listId+'/cards', {
                    title: title,
                    authorId: wekan.adminId,
                    description: description
                });
                request.post(opts, function(err, res, body) {
                    if (err != null) {
                        if (cb) cb(err, null);
                    } else {
                        if (cb) cb(null, body._id);
                    }
                });
        },
        delete: function(boardId, listId, cardId, cb) {
            var opts = addToBody('/api/boards/'+boardId+'/lists/'+listId+'/cards/'+cardId, {});
            request.delete(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body._id);
                }
            });
        }
    }
}

module.exports = function(baseUrl, user, pass, cb) {
    wekan.baseUrl = baseUrl;
    // We need to save the new token each time we login
    request.post({
        url: wekan.baseUrl+'/users/login',
        body: {
            username: user,
            password: pass
        },
        json: true
    }, function (err, res, body) {
        if (err == null && body.token) {
            wekan.adminToken = body.token;
            wekan.adminId = body.id;
            if (cb) cb(null);
        } else {
            console.log('Error getting admin token!');
            if (cb) cb('Error getting admin token!');
        }
    });

    return wekan;
};
