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
        },
        update: function(boardId, listId, cardId, params, cb) {
            var opts = addToBody('/api/boards/'+boardId+'/lists/'+listId+'/cards/'+cardId, params);
            request.put(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body._id);
                }
            });

        }
    },
    Comments: {
        create: function(boardId, cardId, comment, cb) {
            var opts = addToBody('/api/boards/'+boardId+'/cards/'+cardId+'/comments', {
                comment: comment,
                authorId: wekan.adminId
            });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body._id);
                }
            });
        }
    },
    Integrations: {
        create: function(boardId, url, cb) {
            var opts = addToBody('/api/boards/'+boardId+'/integrations', {
                url: url
            });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        getAll: function(boardId, cb) {
            var opts = addToBody('/api/boards/'+boardId+'/integrations', {});
            request.get(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        get: function(boardId, intId, cb) {
            var opts = addToBody('/api/boards/'+boardId+'/integrations/'+intId, {});
            request.get(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        update: function(boardId, intId, updateData, cb) {
            var opts = addToBody('/api/boards/'+boardId+'/integrations/'+intId, updateData);
            request.put(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        addActivities: function(boardId, intId, activities, cb) {
            var opts = addToBody('/api/boards/'+boardId+'/integrations/'+intId+'/activities', {
                activities: activities
            });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        removeActivities: function(boardId, intId, activities, cb) {
            var opts = addToBody('/api/boards/'+boardId+'/integrations/'+intId+'/activities', {
                activities: activities
            });
            request.delete(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        delete: function(boardId, intId, cb) {
            var opts = addToBody('/api/boards/'+boardId+'/integrations/'+intId, {});
            request.delete(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
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
