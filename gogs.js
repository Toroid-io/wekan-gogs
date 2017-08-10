var request = require('request');
var wekan = null;
var db = null;

var gogs = {
    baseUrl: null,
    parseHookPrio: function(body) {
        if (body.issue && body.action === 'label_updated') {
            gogs.label(body);
        }
    },
    parseHook: function(body) {
        if (body.issue) {
            gogs.issue(body);
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
        gogs.getPrioCard(issue.id, function(err, card){
            if (err != null && has_prio) {
                // Create card
                var boardId = wekan.prioBoardId;
                var listId = wekan.prioBacklogListId;
                wekan.Cards.create(issue.title,
                    issue.body,
                    boardId,
                    listId, function(err, cardId) {
                        if (err != null) {
                        } else {
                            //Insert issue
                            gogs.insertPrioIssue(issue.id,
                                cardId,
                                boardId,
                                listId);
                        }
                    });
            } else if (err == null && !has_prio) {
                console.log(card);
                // Delete card
                wekan.Cards.delete(card.boardId,
                    card.listId,
                    card.cardId,
                    function(err, _id){
                        if (err != null) {
                            console.log('Error deleting card '+_id);
                        } else {
                            gogs.removePrioCard(issue.id);
                        }
                    });
            }
        });
    },
    issue: function(issue) {
        if (issue.action = 'opened') {
            console.log(issue);
            gogs.getRepo(issue.repository.id, function(err, repo){
                if (err != null) {
                    // Create board
                    wekan.Boards.create(issue.repository.full_name, function (err, boardId) {
                        if (err != null) {
                        } else {
                            // Insert repo
                            gogs.insertRepo(issue.repository.id, boardId);
                            // Create dummy list
                            wekan.Lists.create('Backlog', boardId, function (err, listId) {
                                if (err != null) {
                                } else {
                                    // Create card
                                    wekan.Cards.create(issue.issue.title,
                                        issue.issue.body,
                                        boardId, listId, function(err, cardId) {
                                            if (err != null) {
                                            } else {
                                                //Insert issue
                                                gogs.insertIssue(issue.issue.id,
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
                    wekan.Lists.get(repo.boardId, function(err, lists) {
                        if (err != null || lists.length === 0) {
                        } else {
                            var listId = lists[0]._id;
                            // Create card
                            wekan.Cards.create(issue.issue.title,
                                issue.issue.body,
                                repo.boardId, listId, function(err, cardId) {
                                    if (err != null) {
                                    } else {
                                        //Insert issue
                                        gogs.insertIssue(issue.issue.id,
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
    }
};

module.exports = function(baseUrl, _db, _wekan) {
    gogs.baseUrl = baseUrl;
    db = _db;
    wekan = _wekan;
    return gogs;
};
