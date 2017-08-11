var sqlite3 = require('sqlite3');

var wekanc = null;
var gogsc = null;
var db = null;

var w2g = {
    gogs: {
        parseHookPrio: function(body) {
            if (body.issue && body.action === 'label_updated') {
                w2g.gogs.label(body);
            }
        },
        parseHook: function(body) {
            if (body.issue) {
                w2g.gogs.issue(body);
            }
        },
        label: function(body) {
            var issue = body.issue;
            var has_prio = false;
            issue.labels.forEach(function(el){
                if (el.name === 'kan:priority') {
                    has_prio = true;
                }
            });
            w2g.getPrioCard(issue.id, function(err, card){
                if (err != null && has_prio) {
                    // Create card
                    var boardId = wekanc.prioBoardId;
                    var listId = wekanc.prioBacklogListId;
                    wekanc.Cards.create(issue.title,
                        issue.body,
                        boardId,
                        listId, function(err, cardId) {
                            if (err != null) {
                            } else {
                                //Insert issue
                                w2g.insertPrioIssue(issue.id,
                                    cardId,
                                    boardId,
                                    listId);
                            }
                        });
                } else if (err == null && !has_prio) {
                    console.log(card);
                    // Delete card
                    wekanc.Cards.delete(card.boardId,
                        card.listId,
                        card.cardId,
                        function(err, _id){
                            if (err != null) {
                                console.log('Error deleting card '+_id);
                            } else {
                                w2g.removePrioCard(issue.id);
                            }
                        });
                }
            });
        },
        issue: function(issue) {
            if (issue.action = 'opened') {
                console.log(issue);
                w2g.getRepo(issue.repository.id, function(err, repo){
                    if (err != null) {
                        // Create board
                        wekanc.Boards.create(issue.repository.full_name, function (err, boardId) {
                            if (err != null) {
                            } else {
                                // Insert repo
                                w2g.insertRepo(issue.repository.id, boardId);
                                // Create dummy list
                                wekanc.Lists.create('Backlog', boardId, function (err, listId) {
                                    if (err != null) {
                                    } else {
                                        // Create card
                                        wekanc.Cards.create(issue.issue.title,
                                            issue.issue.body,
                                            boardId, listId, function(err, cardId) {
                                                if (err != null) {
                                                } else {
                                                    //Insert issue
                                                    w2g.insertIssue(issue.issue.id,
                                                        cardId,
                                                        boardId,
                                                        listId);
                                                }
                                            });
                                    }
                                });
                            }
                        });
                    } else {
                        // Get lists
                        wekanc.Lists.get(repo.boardId, function(err, lists) {
                            if (err != null || lists.length === 0) {
                            } else {
                                var listId = lists[0]._id;
                                // Create card
                                wekanc.Cards.create(issue.issue.title,
                                    issue.issue.body,
                                    repo.boardId, listId, function(err, cardId) {
                                        if (err != null) {
                                        } else {
                                            //Insert issue
                                            w2g.insertIssue(issue.issue.id,
                                                cardId,
                                                repo.boardId,
                                                listId);
                                        }
                                    });
                            }
                        });
                    }
                });
            }
        }
    },
    insertIssue: function(issueId, cardId, boardId, listId) {
        db.run('INSERT INTO cards (issueId, cardId, boardId, listId) VALUES (?,?,?,?)',
            issueId,
            cardId,
            boardId,
            listId);
    },
    insertPrioIssue: function(issueId, cardId, boardId, listId) {
        db.run('INSERT INTO cards_prio (issueId, cardId, boardId, listId) VALUES (?,?,?,?)',
            issueId,
            cardId,
            boardId,
            listId);
    },
    removePrioCard: function(issueId) {
        db.run('DELETE FROM cards_prio WHERE issueId = ?',
            issueId);
    },
    insertRepo: function(repoId, boardId) {
        db.run('INSERT INTO repos (repoId, boardId) VALUES (?,?)',
            repoId,
            boardId);
    },
    getPrioCard: function(issueId, callback) {
        db.get('SELECT * FROM cards_prio WHERE issueId = ?',
            issueId,
            function(err, row) {
                if (err == null && row != undefined) {
                    callback(null, row);
                } else {
                    callback(true);
                }
            });
    },
    getRepo: function(repoId, callback) {
        db.get('SELECT * FROM repos WHERE repoId = ?',
            repoId,
            function(err, row) {
                if (err == null && row != undefined) {
                    callback(null, row);
                } else {
                    callback(true);
                }
            });
    },
    saveGogsToken: function(token) {
        db.run('UPDATE auth SET gogs_token = ?', token);
    }
};

module.exports = function(callback) {
    // Create or open DB
    db = new sqlite3.Database('gogsWekan.db',
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        function(err) {
            if (err != null) {
                callback('Error opening gogs database!');
            }
        });
    db.serialize(); //sticky

    var init = function(gurl, gusr, gpass, gtoken, wurl, wusr, wpass) {
        wekanc = require('./wekan_client.js')(wurl, wusr, wpass);
        gogsc = require('./gogs_client.js')(gurl, gusr, gpass, gtoken);
        if (!wekanc) {
            callback('Error initializing wekan client!');
        }
        if (!gogsc) {
            callback('Error initializing gogs client!');
        }
        if (!gtoken) {
            gogsc.Users.createToken('Wekan2Gogs', function(err, token) {
                if (err) {
                    callback('Error registering app with gogs!');
                }
                w2g.saveGogsToken(token);
            });
        }
    };

    // Get usr && pass from database, or prompt user input
    db.get('SELECT * FROM auth', function(err, row) {
        if (!err && row) {
            // Full info in database
            console.log('Found credentials in database!');
            init(row.gogs_url, row.gogs_username,
                row.gogs_password, row.gogs_token,
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
                    callback('Error reading credentials!');
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

    return w2g;
};
