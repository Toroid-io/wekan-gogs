const vorpal = require('vorpal')();
var Table = require('cli-table');
var w2g = null;

vorpal
    .command('list', 'List repositories')
    .option('-a, --active', 'List only active repositories')
    .action(function(args, callback) {
        w2g.db.all('SELECT * FROM repos', function(err, repos) {
            if (!err && repos) {
                var table = new Table({
                    head: ['Name', 'Active', 'Active (Priority)']
                });
                var active, prio_active;
                repos.forEach(function(repo) {
                    active = (repo.active)? 'X' : '';
                    prio_active = (repo.active_prio)? 'X' : '';
                    if ( (args.options.active && (repo.active || repo.active_prio)) || !args.options.active ) {
                        table.push([repo.username+'/'+repo.repoName, active, prio_active]);
                    }
                });
                console.log(table.toString());
                callback();
            } else {
                console.log('Error listing repos');
                callback();
            }
        });
    });

vorpal
    .command('deactivate <username> <repo>', 'Deactivate repository')
    .option('-p, --priority', 'Deactivate repo in priority board')
    .action(function(args, callback) {
        var console = this;
        w2g.db.get('SELECT * FROM repos WHERE username = ? AND repoName = ?',
            args.username, args.repo, function(err, repo) {
                exists = (!err && repo);
                if (exists && repo.active_prio && args.options.priority) {
                    w2g.deleteLabels(repo.repoId, true);
                    w2g.gogsc.Webhooks.deleteWebhook(args.username, args.repo, repo.hook_prioId,
                        function(err, none) {
                            if (err) {
                                console.log('Error deleting webhook');
                                callback();
                            }
                            w2g.updateRepo('repoId', repo.repoId, 'hook_prioId', null);
                            w2g.updateRepo('repoId', repo.repoId, 'active_prio', 0);
                            w2g.db.all('SELECT * FROM cards \
                                WHERE repoId = ? AND cardPrioId NOT NULL', repo.repoId,
                                function(err, cards) {
                                    if (!err) {
                                        cards.forEach(function(card) {
                                            w2g.wekanc.Cards.delete(w2g.prioBoardId, card.listPrioId, card.cardPrioId);
                                        });
                                        if (!repo.active) {
                                            w2g.deleteLabels(repo.repoId, false);
                                            w2g.db.run('UPDATE cards \
                                                SET cardPrioId = null, listPrioId = null \
                                                WHERE repoId = ?', repo.repoId);
                                        }
                                        callback();
                                    } else {
                                        console.log('Error deleting cards');
                                        callback();
                                    }
                                });
                        });
                } else if (exists && repo.active && !args.options.priority) {
                    if (!repo.active_prio) {
                        w2g.deleteLabels(repo.repoId, false);
                    }
                    w2g.gogsc.Webhooks.deleteWebhook(args.username, args.repo, repo.hookId,
                        function(err, none) {
                            if (err) {
                                console.log('Error deleting webhook');
                                callback();
                            }
                            w2g.updateRepo('repoId', repo.repoId, 'hookId', null);
                            w2g.updateRepo('repoId', repo.repoId, 'active', 0);
                            w2g.wekanc.Boards.delete(repo.boardId, function(err, id) {
                                if (err) {
                                    console.log('Error deleting board');
                                    callback();
                                }
                                w2g.updateRepo('repoId', repo.repoId, 'boardId', null);
                                w2g.updateRepo('repoId', repo.repoId, 'backlogListId', null);
                                w2g.db.run('UPDATE cards \
                            SET cardId = null, listId = null, boardId = null \
                            WHERE repoId = ?', repo.repoId);
                                callback();
                            });
                        });
                } else {
                    console.log('Repository is not active');
                    callback();
                }
            });
    });

vorpal
    .command('activate <username> <repo>', 'Activate repository')
    .option('-p, --priority', 'Activate repo in priority board')
    .action(function(args, callback) {
        var console = this;
        var url = (args.options.priority)?w2g.url+'/gogs/priority':w2g.url+'/gogs';
        callback();
        w2g.db.get('SELECT * FROM repos WHERE username = ? AND repoName = ?',
            args.username, args.repo, function(err, repo) {
                exists = (!err && repo);
                active = (!err && repo && repo.active)? 'X' : '';
                prio_active = (!err && repo && repo.active_prio)? 'X' : '';
                if (exists && repo.active_prio  && args.options.priority) {
                    console.log('Repo is already activated');
                    callback();
                    return;
                } else if (exists && repo.active && !args.options.priority) {
                    console.log('Repo is already activated');
                    callback();
                    return;
                } else if (!exists) {
                    console.log('Repo does not exists in database, please consider syncing repos first');
                    callback();
                    return;
                }
                // Create hook then!
                w2g.gogsc.Webhooks.createWebhook(args.username,
                    args.repo, url, function(err, hook) {
                        if (!err) {
                            callback();
                            var updateKey = args.options.priority?'active_prio':'active';
                            w2g.updateRepo('repoId', repo.repoId, updateKey, 1);
                            updateKey = args.options.priority?'hook_prioId':'hookId';
                            w2g.updateRepo('repoId', repo.repoId, updateKey, hook.id);
                            if (!args.options.priority) {
                                w2g.wekanc.Boards.create(args.username+'/'+args.repo, function(err, boardId) {
                                    if (err) {
                                        console.log('Error creating board in Wekan');
                                        callback();
                                        //TODO: Cleanup
                                    }
                                    updateKey = 'boardId';
                                    w2g.updateRepo('repoId', repo.repoId, updateKey, boardId);
                                    w2g.wekanc.Integrations.create(boardId, w2g.url+'/wekan');
                                    // Create All lists
                                    // if index == 0, then save to-do reference
                                    w2g.kanLabels.other.forEach(function(label, label_idx, label_array) {
                                        w2g.wekanc.Lists.create(label.name.split(':').pop(), boardId,
                                            function(err, listId) {
                                                if (err != null) {
                                                    console.log('Error creating list');
                                                    callback();
                                                } else {
                                                    if (label_idx === 0) {
                                                        w2g.updateRepo('repoId', repo.repoId, 'backlogListId', listId);
                                                    }
                                                    // If not active in priority (all labels where deleted, create them
                                                    if (!repo.active_prio) {
                                                        w2g.gogsc.Labels.createLabel(args.username,
                                                            args.repo, label.name,
                                                            label.color, function (err, glabel) {
                                                                // Save in DB
                                                                if (!err) {
                                                                    // null because of gogs API problem
                                                                    w2g.insertLabel(null, repo.repoId, label.name,
                                                                        listId, label.prioListId);
                                                                } else {
                                                                    console.log('Error creating label');
                                                                }
                                                                if (label_idx === label_array.length - 1) {
                                                                    w2g.syncLabels(args.username, args.repo);
                                                                    callback();
                                                                }
                                                            });
                                                    } else {
                                                        w2g.updateLabel('labelName', label.name, 'listId', listId);
                                                    }
                                                }
                                            });
                                    });
                                });
                            } else {
                                w2g.gogsc.Labels.createLabel(args.username,
                                    args.repo, w2g.kanLabels.priority.name,
                                    w2g.kanLabels.priority.color, function (err, label) {
                                        // Save in DB
                                        if (!err) {
                                            w2g.insertLabel(null, repo.repoId, label.name,
                                                w2g.prioBacklogListId, null);
                                            // If not active (all labels where deleted, create them)
                                            if (!repo.active) {
                                                w2g.kanLabels.other.forEach(function(label, label_idx, label_array) {
                                                    w2g.gogsc.Labels.createLabel(args.username,
                                                        args.repo, label.name,
                                                        label.color, function (err, glabel) {
                                                            // Save in DB
                                                            if (!err) {
                                                                // null because of gogs API problem
                                                                w2g.insertLabel(null, repo.repoId, label.name,
                                                                    null, label.prioListId);
                                                            } else {
                                                                console.log('Error creating label');
                                                            }
                                                            if (label_idx === label_array.length - 1) {
                                                                w2g.syncLabels(args.username, args.repo);
                                                                callback();
                                                            }
                                                        });
                                                });
                                            } else {
                                                w2g.syncLabels(args.username, args.repo);
                                                callback();
                                            }
                                        } else {
                                            console.log('Error creating priority label');
                                            callback();
                                        }
                                    });
                            }
                        }
                    });
            });
    });

vorpal
    .command('sync issues <username> <repo>', 'Sync repository issues (only run this after activate)')
    .action(function(args, callback) {
        w2g.syncIssues(args.username, args.repo);
        callback();
    });

vorpal
    .command('sync repos [username]', 'Sync repository list')
    .action(function(args, callback) {
        w2g.syncRepos();
        callback();
    });

vorpal
    .delimiter('wekan-gogs:')

module.exports = function(_w2g) {
    w2g = _w2g;
    return vorpal;
}
