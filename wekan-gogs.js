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
        },
        createCard: function(hook, prio) {
            if (!prio) {
                const listId = hook.listId;
                const boardId = hook.boardId;
                const cardId = hook.cardId;
                const title = hook.card;
                const user = hook.user;
                w2g.newCard(cardId, listId, boardId, title, user);
            }
        },
        archivedCard: function(hook, prio) {
            const cardId = hook.cardId;
            const user = hook.user;
            w2g.delCard(cardId, user, prio);
        },
        addComment: function(hook, prio) {
            const cardId = hook.cardId;
            const user = hook.user;
            const comment = hook.comment;
            const commentId = hook.commentId;
            w2g.newWComment(cardId, commentId, user, comment);
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
            if (body.issue && body.action === 'opened') {
                w2g.gogs.newIssue(body);
            } else if (body.issue && body.action === 'closed') {
                w2g.gogs.closeIssue(body);
            } else if (body.comment && body.action === 'created') {
                w2g.gogs.newComment(body);
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
        },
        newIssue: function(body) {
            const issue = body.issue;
            w2g.newIssues(body.repository.owner.username, body.repository.name, [issue]);
        },
        closeIssue: function(body) {
            const issueId = body.issue.id;
            w2g.delIssue(issueId);
        },
        newComment: function(body) {
            const repoId = body.repository.id;
            const issueId = body.issue.id;
            const guser = body.comment.user.username;
            const gcommentId = body.comment.id;
            const gcomment = body.comment.body;
            w2g.newGComment(repoId, issueId, gcommentId, guser, gcomment);
        }
    },
    deleteLabels: function(repoId, priority) {
        w2g.db.all('SELECT l.*, r.username, r.repoName \
            FROM labels AS l \
            INNER JOIN repos AS r ON l.repoId = r.repoId \
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
                w2g.newIssues(username, repoName, issues);
            } else {
                console.log('Error getting issues');
            }
        });
    },
    syncLabels: function(username, repoName) {
        w2g.gogsc.Labels.getAll(username, repoName, function(err, labels) {
            if (!err) {
                labels.forEach(function(el) {
                    w2g.db.get('SELECT l.*, r.repoId FROM labels AS l \
                    INNER JOIN repos AS r ON r.repoName = ? AND r.username = ? \
                    WHERE l.labelName = ? AND l.repoId = r.repoId', repoName, username, el.name,
                        function(err, row) {
                            if (!err && row) {
                                w2g.db.run('UPDATE labels SET id = ? \
                                    WHERE labelName = ? AND repoId = ?', el.id, el.name, row.repoId);
                            } else if (err) {
                                console.log('Error getting data from database');
                            }
                        });
                });
            }
        });
    },
    newIssues: function(username, repoName, issues) {
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
                                        w2g.wekanc.Cards.create(issue.title, issue.body, row.boardId, row.listId, function(err, cardId) {
                                            if (!err) {
                                                w2g.insertIssue(issue.id, row.repoId, issue.number, cardId, null, row.boardId, row.listId, null);
                                                w2g.gogsc.Labels.addIssueLabels(username, repoName, issue.number, [row.labelId]);
                                            } else {
                                                console.log('Error creating card', err);
                                            }
                                        });
                                    }
                                });
                        }
                    });
                } else {
                    console.log('Error getting data from database');
                }
            });
    },
    newGComment: function(repoId, issueId, gcommentId, guser, gcomment) {
        const commentBody = '_**'+guser+'** commented in Gogs:_\n\n>'+gcomment;
        w2g.db.get('SELECT c.cardId, c.cardPrioId, \
            r.boardId \
            FROM cards AS c \
            INNER JOIN repos AS r ON r.repoId = c.repoId \
            INNER JOIN comments AS com ON com.cardId = c.cardId \
            WHERE c.repoId = ?', repoId, function(err, row) {
                if (!err) {
                    w2g.db.get('SELECT wcommentId FROM comments WHERE gcommentId = ?',
                        gcommentId, function(err, comment) {
                            console.log(comment, row);
                            if (!err && row && row.cardId && (!comment || !comment.wcommentId)) {
                                w2g.wekanc.Comments.create(row.boardId, row.cardId, commentBody, function(err, wcommentId) {
                                    w2g.db.run('INSERT INTO comments VALUES (?,?,?)',
                                        gcomment.id, wcommentId, row.cardId);
                                });
                            }
                        });
                } else {
                    console.log('Error getting data from database');
                }
            });
    },
    newWComment: function(cardId, wcommentId, wuser, wcomment) {
        wcomment = wcomment.replace(/\n/g, '\n\n>');
        const commentBody = '_**'+wuser+'** commented in Wekan:_\n\n>'+wcomment;
        w2g.db.get('SELECT c.issueIndex, c.issueId, c.cardId, \
            r.username, r.repoName \
            FROM cards AS c \
            INNER JOIN repos AS r ON r.repoId = c.repoId \
            WHERE c.cardId = ? OR c.cardPrioId = ?', cardId, cardId, function(err, row) {
                if (!err) {
                    w2g.db.get('SELECT gcommentId FROM comments WHERE wcommentId = ?',
                        wcommentId, function(err, comment) {
                            console.log(comment, row);
                            if (!err && row && row.issueIndex && (!comment || !comment.gcommentId)) {
                                w2g.gogsc.Comments.create(row.username, row.repoName, row.issueIndex, commentBody, function(err, gcomment) {
                                    w2g.db.run('INSERT INTO comments VALUES (?,?,?)',
                                        gcomment.id, wcommentId, row.cardId);
                                });
                            }
                        });
                } else {
                    console.log('Error getting data from database');
                }
            });
    },
    newCard: function(cardId, listId, boardId, cardTitle, author) {
        w2g.db.get('SELECT l.id AS labelId, r.repoName, \
            r.repoId, r.username \
            FROM labels AS l \
            INNER JOIN repos AS r ON r.boardId = ? \
            WHERE l.listId = ?',
            boardId, listId, function(err, row) { /* [0] is to-do */
                if (!err) {
                    w2g.db.get('SELECT issueId FROM cards WHERE cards.cardId = ?',
                        cardId, function(err, issue) {
                            if (!err && (!issue || issue.issueId == null)) {
                                w2g.gogsc.Issues.create(row.username, row.repoName, cardTitle,
                                    '_Issue opened by **'+author+'** in Wekan_', function(err, data){
                                        w2g.insertIssue(data.id, row.repoId, data.number, cardId, null, boardId, listId, null);
                                        w2g.gogsc.Labels.addIssueLabels(row.username, row.repoName, data.number, [row.labelId]);
                                });
                            }
                        });
                } else {
                    console.log('Error getting data from database');
                }
            });
    },
    delCard: function(cardId, author, prio) {
        w2g.db.get('SELECT c.*, c.repoId, \
            r.username, r.repoName FROM cards AS c \
            INNER JOIN repos AS r ON r.repoId = c.repoId \
            WHERE c.cardId = ? OR c.cardPrioId = ?',
            cardId, cardId, function(err, row) {
                if (!err && row.issueIndex) {
                    w2g.gogsc.Issues.edit(row.username, row.repoName,
                        row.issueIndex, {state: 'closed'});
                } else {
                    console.log('Error getting data from database');
                }
            });
    },
    delIssue: function(issueId) {
        w2g.db.get('SELECT c.*, r.boardId \
            FROM cards AS c \
            INNER JOIN repos AS r ON r.repoId = c.repoId \
            WHERE c.issueId = ?', issueId, function(err, row) {
                if (!err) {
                    if (row.cardId) {
                        w2g.db.run('DELETE FROM cards WHERE cards.cardId = ?', row.cardId);
                        w2g.wekanc.Cards.delete(row.boardId, row.listId, row.cardId);
                    }
                    if (row.cardPrioId) {
                        w2g.db.run('DELETE FROM cards WHERE cards.cardPrioId = ?', row.cardId);
                        w2g.wekanc.Cards.delete(w2g.prioBoardId, row.listPrioId, row.cardPrioId);
                    }
                    w2g.db.all('SELECT l.id, r.* \
                        FROM labels AS l \
                        INNER JOIN repos AS r ON r.repoId = l.repoId \
                        WHERE l.repoId = ?', row.repoId, function(err, labels) {
                        if (!err && labels) {
                            labels.forEach(function(label) {
                                w2g.gogsc.Labels.deleteIssueLabel(label.username,
                                    label.repoName, row.issueIndex, label.id);
                            });
                        }
                    })
                } else {
                    console.log('Error getting data from database');
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
        w2g.db.run('INSERT INTO auth VALUES (?)', token);
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
        w2g.db.run('INSERT INTO labels VALUES (null, ?,?,?,?,?)',
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

module.exports = function(config, cb) {
    // Create or open DB
    w2g.db = new sqlite3.Database('data/wekan-gogs.db',
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        function(err) {
            if (err != null) {
                if (cb) cb('Error opening gogs database!');
            }
        });
    w2g.db.serialize(); //sticky

    var wurl = config.wekan_url;
    var wuser = config.wekan_username;
    var wpass = config.wekan_password;
    var gurl = config.gogs_url;
    var guser = config.gogs_username;
    var gpass = config.gogs_password;

    w2g.url = config.wekangogs_url;
    w2g.wekanc = require('./wekan_client.js')(wurl, wuser, wpass,
        function(err) {
            if (!err) {
                w2g.setupPrioBoard(function(err) {/* TODO */});
            }
        });
    w2g.gogsc = require('./gogs_client.js')(gurl, guser, gpass);
    if (!w2g.wekanc) {
        if (cb) cb('Error initializing wekan client!');
    }
    if (!w2g.gogsc) {
        if (cb) cb('Error initializing gogs client!');
    }
    w2g.db.get('SELECT * FROM auth', function(err, row) {
        if (!err && (!row || !row.gogs_token)) {
            w2g.gogsc.Users.createToken('wekan-gogs', function(err, token) {
                if (err) {
                    if (cb) cb('Error registering app with gogs!');
                }
                w2g.gogsc.token = token;
                w2g.saveGogsToken(token);
            });
        } else if (!err) {
            w2g.gogsc.token = row.gogs_token;
        } else {
            console.log('Error getting data from database');
        }
    });

    if(!config.cli){
        cb(null, w2g);
    }
    var cli = require('./cli.js')(w2g);
    cli.show();

    cb(null, w2g);
};
