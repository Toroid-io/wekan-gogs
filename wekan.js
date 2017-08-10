var request = require('request');

var setupPrioBoard = function() {
    wekan.Boards.get(function(err, boards) {
        if (err != null) {
            console.log('Error Boards.get setupPrioBoards');
            return;
        }
        boards.forEach(function(el) {
            if (el.title === 'Priority') {
                wekan.prioBoardId = el._id;
                wekan.Lists.get(el._id, function(err, lists) {
                    lists.forEach(function(el) {
                        if (el.title == 'To Do') {
                            wekan.prioBacklogListId = el._id;
                        }
                    });
                    if (wekan.prioBacklogListId === null) {
                        // Create Backlog List
                        wekan.Lists.create('To Do', wekan.prioBoardId,
                            function(err, listId) {
                                if (err != null) {
                                    console.log('Error creating To Do list!');
                                    return;
                                } else {
                                    wekan.prioBacklogListId = listId;
                                }
                            });
                    }
                });
            }
        });
        if (wekan.prioBoardId === null) {
            wekan.Boards.create('Priority', function(err, boardId) {
                if (err != null) {
                    console.log('Error creating priority board!');
                    return;
                } else {
                    wekan.prioBoardId = boardId;
                    // Create Backlog List
                    wekan.Lists.create('To Do', boardId,
                        function(err, listId) {
                            if (err != null) {
                                console.log('Error creating To Do list!');
                            } else {
                                wekan.prioBacklogListId = listId;
                            }
                        });
                }
            });
        }
    });
};

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
    prioBoardId: null,
    prioBacklogListId: null,
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
                    console.log('lists:', body);
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
            setupPrioBoard();
            callback(null, wekan);
        } else {
            console.log('Error getting admin token: ');
            callback('error', null);
        }
    });

    return null;
};
