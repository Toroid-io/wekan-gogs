var sqlite3 = require('sqlite3');

var w2g = {
    url: null,
    prioBoardId: null,
    prioBacklogListId: null,
    wekanc: null,
    gogsc: null,
    db: null,
    wekan: {
        parseHook: function(hook, prio) {
            var act = w2g.wekan[hook.description.split('-')[1]];
            if (hook && hook.description && act) {
                act(hook, prio);
            }
        },
        moveCard: function(hook, prio) {
            const oldListId = hook.oldListId;
            const listId = hook.listId;
            const boardId = hook.boardId;
            const cardId = hook.cardId;
            w2g.db.get('SELECT DISTINCT \
                l1.id AS oldLabelId, \
                l1.listId AS oldListId, \
                l1.prioListId AS oldPrioListId, \
                l2.id AS newLabelId, \
                l2.listId AS newListId, \
                l2.prioListId AS newPrioListId, \
                r.username AS username, \
                r.repoName AS repoName, \
                r.boardId, c.listId AS currentListId, \
                c.listPrioId AS currentPrioListId, \
                c.cardId, c.cardPrioId, c.repoId, \
                c.issueIndex AS issueIndex \
                FROM labels \
                INNER JOIN labels AS l1 ON l1.listId = ? OR l1.prioListId = ? \
                INNER JOIN labels AS l2 ON l2.listId = ? OR l2.prioListId = ? \
                INNER JOIN repos AS r ON r.repoId = c.repoId \
                INNER JOIN cards AS c ON c.cardId = ? OR c.cardPrioId = ?',
                oldListId, oldListId, listId, listId, cardId, cardId, function(err, row) {
                    if (!err && row) {
                        w2g.gogsc.Labels.deleteIssueLabel(row.username,
                            row.repoName,
                            row.issueIndex,
                            row.oldLabelId);
                        w2g.gogsc.Labels.addIssueLabels(row.username,
                            row.repoName, row.issueIndex, [row.newLabelId]);
                        console.log(row);
                        if (prio && row.newListId != row.currentListId) {
                            console.log('Moving repo board');
                            w2g.wekanc.Cards.update(row.boardId, row.oldListId, row.cardId, {
                                listId: row.newListId });
                        } else if (row.newPrioListId != row.currentPrioListId) {
                            console.log('Moving prio board');
                            w2g.wekanc.Cards.update(w2g.prioBoardId, row.oldPrioListId, row.cardPrioId, {
                                listId: row.newPrioListId });
                        }
                        w2g.updateIssue('cardId', row.cardId, 'listId', row.newListId);
                        w2g.updateIssue('cardId', row.cardId, 'listPrioId', row.newPrioListId);
                    } else {
                        console.log('Error getting data from database');
                    }
                });
        }
    },
    gogs: {
        parseHookPrio: function(body) {
            if (body.issue &&
                body.issue.pull_request == null &&
                body.action === 'label_updated') {
                w2g.gogs.label(body);
            }
        },
        parseHook: function(body) {
            if (body.issue) {
                //w2g.gogs.issue(body);
            }
        },
        label: function(body) {
            var issue = body.issue;
            var has_prio = false;
            issue.labels.forEach(function(el){
                if (el.name === w2g.kanLabels.priority.name) {
                    has_prio = true;
                }
            });
            w2g.db.get('SELECT c.*, l.prioListId AS newListId \
                FROM cards AS c \
                INNER JOIN labels AS l ON l.listId = c.listId \
                WHERE c.issueId = ?', issue.id, function(err, data) {
                    if ((err && has_prio) || (!err && has_prio && data && !data.cardPrioId)) {
                        // Create card
                        var boardId = w2g.prioBoardId;
                        var listId = data.newListId;
                        w2g.wekanc.Cards.create(issue.title,
                            issue.body,
                            boardId,
                            listId, function(err, cardId) {
                                if (err != null) {
                                } else {
                                    //Insert issue
                                    w2g.insertIssue(issue.id,
                                        body.repository.id,
                                        issue.number,
                                        null,
                                        cardId,
                                        null,
                                        null,
                                        listId);
                                }
                            });
                    } else if (!err && !has_prio && data && data.cardPrioId) {
                        // Delete card
                        w2g.wekanc.Cards.delete(w2g.prioBoardId,
                            data.listPrioId,
                            data.cardPrioId,
                            function(err, _id){
                                if (err != null) {
                                    console.log('Error deleting card '+_id);
                                } else {
                                    w2g.updateIssue('issueId', issue.id, 'cardPrioId', null);
                                    w2g.updateIssue('issueId', issue.id, 'listPrioId', null);
                                }
                            });
                    }
                });
        }
    },
    deleteLabels: function(repoId, priority) {
        w2g.db.all('SELECT l.*, r.username, r.repoName \
            FROM labels AS l \
            INNER JOIN repos AS r \
            WHERE l.repoId = ? AND l.labelName LIKE ?',
            repoId, (priority?'%priority':'%'), function(err, row) {
                if (!err) {
                    row.forEach(function(label) {
                        w2g.gogsc.Labels.delete(label.username, label.repoName, label.id);
                        w2g.db.run('DELETE FROM labels WHERE id = ?', label.id);
                    });
                }
            });
    },
    prioBoardExists: function(user, cb) {
        w2g.db.get('SELECT * FROM boards_prio WHERE wekan_userid = ?',
            user, function(err, row) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, row);
                }
            });
    },
    insertPrioList: function(listId, boardId, labelName) {
        w2g.db.run('INSERT INTO lists_prio VALUES (?,?,?)',
            listId, boardId, labelName);
    },
    insertPrioBoard: function(userId, boardId, listId) {
        w2g.db.run('INSERT INTO boards_prio VALUES (?,?,?)',
            userId,
            boardId,
            listId);
    },
    updatePrioBoard: function(userId, boardId, listId) {
        w2g.db.run('UPDATE boards_prio SET boardId = ?, \
                backlogListId = ? WHERE wekan_userid = ?',
            boardId, listId, userId);
    },
    syncRepos: function() {
        w2g.gogsc.Repos.listMyRepos(function(err, repos) {
            if (!err) {
                repos.forEach(function(repo) {
                    w2g.db.run('INSERT INTO repos \
                    SELECT ?, ?, ?, null, null, 0, 0, null, null \
                    WHERE NOT EXISTS(SELECT 1 FROM repos WHERE repoId = ?)',
                        repo.id, repo.owner.username, repo.full_name.split('/').pop(),
                        repo.id);
                });
            } else {
                console.log('Error syncing repos');
            }
        });
    },
    syncIssues: function(username, repoName, page) {
        w2g.gogsc.Issues.getAll(username, repoName, page, function(err, issues) {
            if (!err) {
                w2g.db.get('SELECT l.id AS labelId, \
                l.listId, r.boardId, r.repoId \
                FROM labels AS l \
                INNER JOIN repos AS r \
                ON r.username = ? AND r.repoName = ? \
                WHERE l.labelName = ?',
                    username, repoName, w2g.kanLabels.other[0].name, function(err, row) { /* [0] is to-do */
                        if (!err) {
                            issues.forEach(function(issue) {
                                if (issue.pull_request == null) {
                                w2g.db.get('SELECT cardId FROM cards WHERE cards.issueId = ?',
                                    issue.id, function(err, card) {
                                        if (!err && (!card || card.cardId == null)) {
                                            w2g.gogsc.Labels.addIssueLabels(username, repoName, issue.number, [row.labelId]);
                                            w2g.wekanc.Cards.create(issue.title, issue.body, row.boardId, row.listId, function(err, cardId) {
                                                w2g.insertIssue(issue.id, row.repoId, issue.number, cardId, null, row.boardId, row.listId, null);
                                            });
                                        }
                                    });
                                }
                            });
                        } else {
                            console.log('Error getting data from database');
                        }
                });
            } else {
                console.log('Error getting issues');
            }
        });
    },
    syncLabels: function(username, repoName) {
        w2g.gogsc.Labels.getAll(username, repoName, function(err, labels) {
            if (!err) {
                labels.forEach(function(el) {
                    w2g.getLabel('labelName', el.name, function(err, row) {
                        if (!err && row) {
                            w2g.updateLabel('labelName', el.name, 'id', el.id);
                        }
                    });
                });
            }
        });
    },
    insertIssue: function(issueId, repoId, issueIndex, cardId, cardPrioId, boardId, listId, listPrioId) {
        w2g.db.run('INSERT OR REPLACE INTO cards VALUES (?,?,?, \
            COALESCE((SELECT cardId FROM cards WHERE issueId = \''+issueId+'\'), ?), \
            COALESCE((SELECT cardPrioId FROM cards WHERE issueId = \''+issueId+'\'), ?), \
            COALESCE((SELECT boardId FROM cards WHERE issueId = \''+issueId+'\'), ?), \
            COALESCE((SELECT listId FROM cards WHERE issueId = \''+issueId+'\'), ?), \
            COALESCE((SELECT listPrioId FROM cards WHERE issueId = \''+issueId+'\'), ?))',
            issueId,
            repoId,
            issueIndex,
            cardId,
            cardPrioId,
            boardId,
            listId,
            listPrioId);
    },
    removePrioIssue: function(issueId) {
        w2g.db.run('DELETE FROM cards_prio WHERE issueId = ?',
            issueId);
    },
    insertRepo: function(repoId, username, repoName, boardId, backlogListId, active, active_prio, hookId, hook_prioId) {
        w2g.db.run('INSERT INTO repos VALUES (?,?,?,?,?,?,?,?,?)',
            repoId,
            username,
            repoName,
            boardId,
            backlogListId,
            active,
            active_prio,
            hookId,
            hook_prioId);
    },
    updateRepo: function(searchkey, searchvalue, updatekey, updatevalue) {
        w2g.db.run('UPDATE repos SET '+updatekey+' = ? WHERE '+searchkey+' = ?',
            updatevalue, searchvalue);
    },
    getCard: function(searchKey, searchValue, cb) {
        w2g.db.get('SELECT * FROM cards WHERE '+searchKey+' = ?',
            searchValue,
            function(err, row) {
                if (err == null && row != undefined) {
                    if (cb) cb(null, row);
                } else {
                    if (cb) cb(true);
                }
            });
    },
    updateIssue: function(searchKey, searchValue, updateKey, updateValue) {
        w2g.db.run('UPDATE cards SET '+updateKey+' = ? WHERE '+searchKey+' = ?',
            updateValue, searchValue);
    },
    getRepo: function(searchKey, searchValue, cb) {
        w2g.db.get('SELECT * FROM repos WHERE '+searchKey+' = ?',
            searchValue,
            function(err, row) {
                if (err == null && row != undefined) {
                    if (cb) cb(null, row);
                } else {
                    if (cb) cb(true);
                }
            });
    },
    saveGogsToken: function(token) {
        w2g.db.run('UPDATE auth SET gogs_token = ?', token);
    },
    getLabel: function(searchKey, searchValue, cb) {
        w2g.db.get('SELECT * FROM labels WHERE '+searchKey+' = ?',
            searchValue,
            function(err, row) {
                if (!err && row) {
                    if (cb) cb(null, row);
                } else {
                    if (cb) cb(true);
                }
            });
    },
    insertLabel: function(id, repoId, labelName, listId, prioListId) {
        w2g.db.run('INSERT INTO labels VALUES (?,?,?,?,?)',
            id, repoId, labelName, listId, prioListId);
    },
    updateLabel: function(searchKey, searchValue, updateKey, updateValue) {
        w2g.db.run('UPDATE labels SET '+updateKey+' = ? WHERE '+searchKey+' = ?',
            updateValue, searchValue);
    },
    setupPrioBoard: function(cb) {
        w2g.prioBoardExists(w2g.wekanc.adminId, function(err, row) {
            if (err) {
                if (cb) cb(err);
            } else if (!row || !row.boardId) {
                // Create board
                w2g.wekanc.Boards.create('Priority', function(err, boardId) {
                    if (err != null) {
                        console.log('Error creating priority board!');
                        return;
                    } else {
                        w2g.prioBoardId = boardId;
                        w2g.kanLabels.other.forEach(function(label, label_idx, label_array) {
                            // Create list
                            w2g.wekanc.Lists.create(label.name.split(':').pop(),
                                boardId,
                                function(err, listId) {
                                    if (err != null) {
                                        console.log('Error creating list');
                                    } else {
                                        if (label_idx === 0) { // if To Do
                                            w2g.prioBacklogListId = listId;
                                            w2g.insertPrioBoard(w2g.wekanc.adminId,
                                                boardId, listId);
                                        } else if (label_idx === label_array.length - 1) {
                                            w2g.wekanc.Integrations.create(boardId, w2g.url+'/wekan/priority', function(err, int) {
                                                if (err) {
                                                    console.log('Error creaating wekan webook');
                                                }
                                            });
                                        }
                                        w2g.insertPrioList(listId, boardId, label.name);
                                        label_array[label_idx].prioListId = listId;
                                    }
                                });
                        });
                    }
                });
            } else {
                // Just save the reference
                w2g.prioBoardId = row.boardId;
                w2g.prioBacklogListId = row.backlogListId;
                w2g.setupPrioLabels(row.boardId);
            }
        });
    },
    setupPrioLabels: function(prioBoardId, cb) {
        w2g.kanLabels.other.forEach(function(label, label_index, label_array) {
            w2g.db.get('SELECT * FROM lists_prio \
                    WHERE boardId = ? AND labelName = ?',
                prioBoardId, label.name, function(err, list) {
                    if (!err) {
                        label_array[label_index].prioListId = list.listId;
                    } else {
                        console.log('Error getting prio lists');
                    }
                });
        });
    },
    kanLabels: {
        priority: {
            name: 'kan:Priority',
            color: '#FE2E2E'
        },
        other: [
            {
                name: 'kan:To Do',
                color: '#c7def8',
                prioListId: null
            },
            {
                name: 'kan:In Progress',
                color: '#fca43f',
                prioListId: null
            },
            {
                name: 'kan:Review',
                color: '#bf3cfc',
                prioListId: null
            },
            {
                name: 'kan:Done',
                color: '#71d658',
                prioListId: null
            }
        ]
    }
};

module.exports = function(cb) {
    // Create or open DB
    w2g.db = new sqlite3.Database('gogsWekan.db',
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        function(err) {
            if (err != null) {
                if (cb) cb('Error opening gogs database!');
            }
        });
    w2g.db.serialize(); //sticky

    var init = function(gurl, gusr, gpass, gtoken, wurl, wusr, wpass) {
        w2g.wekanc = require('./wekan_client.js')(wurl, wusr, wpass,
            function(err) {
                if (!err) {
                    w2g.setupPrioBoard(function(err) {/* TODO */});
                }
            });
        w2g.gogsc = require('./gogs_client.js')(gurl, gusr, gpass, gtoken);
        if (!w2g.wekanc) {
            if (cb) cb('Error initializing wekan client!');
        }
        if (!w2g.gogsc) {
            if (cb) cb('Error initializing gogs client!');
        }
        if (!gtoken) {
            w2g.gogsc.Users.createToken('Wekan2Gogs', function(err, token) {
                if (err) {
                    if (cb) cb('Error registering app with gogs!');
                }
                w2g.saveGogsToken(token);
            });
        }
        var cli = require('./cli.js')(w2g);
        cli.show();
    };

    // Get usr && pass from database, or prompt user input
    w2g.db.get('SELECT * FROM auth', function(err, row) {
        if (!err && row) {
            // Full info in database
            console.log('Found credentials in database!');
            w2g.url = row.w2g_url;
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
                    },
                    w2g_url: {
                        required: true
                    }
                }
            };
            prompt.start();
            prompt.get(schema, function (err, result) {
                if (err != null) {
                    if (cb) cb('Error reading credentials!');
                }
                w2g.db.run('INSERT INTO auth (gogs_url, gogs_username, \
                gogs_password, wekan_url, wekan_username, \
                wekan_password, w2g_url) VALUES \
                (?,?,?,?,?,?,?)', result.gogs_url,
                    result.gogs_username,
                    result.gogs_password,
                    result.wekan_url,
                    result.wekan_username,
                    result.wekan_password,
                    result.w2g_url);

                w2g.url = result.w2g_url;
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
