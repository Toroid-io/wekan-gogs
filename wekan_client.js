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
        create: function(title, callback) {
            var opts = addToBody('/api/boards', {
                title: title,
                owner: wekan.adminId
            });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    callback(err, null);
                } else {
                    callback(null, body._id);
                }
            });
        },
        get: function(callback) {
            var opts = addToBody('/api/users/'+wekan.adminId+'/boards', {});
            request.get(opts, function(err, res, body) {
                if (err != null) {
                    callback(err, null);
                } else {
                    callback(null, body);
                }
            });
        },
        delete: function(boardId, callback) {
            var opts = addToBody('/api/boards/'+boardId, {});
            request.delete(opts, function(err, res, body) {
                if (err != null) {
                    callback(err, null);
                } else {
                    callback(null, body._id);
                }
            });
        }
    },
    Lists: {
        create: function(title, boardId, callback) {
            var opts = addToBody('/api/boards/'+boardId+'/lists', {
                title: title,
            });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    callback(err, null);
                } else {
                    callback(null, body._id);
                }
            });
        },
        get: function(boardId, callback) {
            var opts = addToBody('/api/boards/'+boardId+'/lists', {});
            request.get(opts, function (err, res, body) {
                if (err != null) {
                    callback(err, null);
                } else {
                    callback(null, body);
                }
            });
        }
    },
    Cards: {
        create: function(title, description, boardId,
            listId, callback) {
                var opts = addToBody('/api/boards/'+boardId+'/lists/'+listId+'/cards', {
                    title: title,
                    authorId: wekan.adminId,
                    description: description
                });
                request.post(opts, function(err, res, body) {
                    if (err != null) {
                        callback(err, null);
                    } else {
                        callback(null, body._id);
                    }
                });
        },
        delete: function(boardId, listId, cardId, callback) {
            var opts = addToBody('/api/boards/'+boardId+'/lists/'+listId+'/cards/'+cardId, {});
            request.delete(opts, function(err, res, body) {
                if (err != null) {
                    callback(err, null);
                } else {
                    callback(null, body._id);
                }
            });
        }
    }
}

module.exports = function(baseUrl, user, pass, callback) {
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
            callback(null);
        } else {
            console.log('Error getting admin token!');
            callback('Error getting admin token!');
        }
    });

    return wekan;
};
