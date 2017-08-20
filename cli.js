const vorpal = require('vorpal')();
var Table = require('cli-table');
var w2g = null;

vorpal
    .command('list', 'List repositories')
    .option('-a, --active', 'List only active repositories')
    .action(function(args, callback) {
        var console = this;
        w2g.gogsc.Repos.listMyRepos(function(err, repos) {
            if (!err && repos) {
                var table = new Table({
                    head: ['Name', 'Active', 'Active (Priority)']
                });
                var active, prio_active;
                repos.forEach(function(repo, idx_repo, array_repo) {
                    w2g.getRepo('repoId', repo.id, function(err, row) {
                        active = (!err && row.active)? 'X' : '';
                        prio_active = (!err && row.active_prio)? 'X' : '';
                        if ( ((args.options.active && (active === 'X' || prio_active === 'X')) || !args.options.active) ) {
                            table.push([repo.full_name, active, prio_active]);
                        }
                        if (idx_repo === array_repo.length - 1) {
                            console.log(table.toString());
                            callback();
                        }
                    });
                });
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
        var repoFullName = args.username+'/'+args.repo;
        w2g.getRepo('repoFullName', repoFullName, function(err, row) {
            exists = (!err && row);
            if (exists && row.active_prio && args.options.priority) {
                w2g.gogsc.Webhooks.deleteWebhook(args.username, args.repo, row.hook_prioId,
                    function(err, none) {
                        if (err) {
                            //TODO: Wat?
                            console.log('Error deleting webhook');
                            callback();
                        }
                    });
                w2g.updateRepo('repoId', row.repoId, 'hook_prioId', null);
                w2g.updateRepo('repoId', row.repoId, 'active_prio', 0);
                callback();
            } else if (exists && row.active && !args.options.priority) {
                w2g.gogsc.Webhooks.deleteWebhook(args.username, args.repo, row.hookId,
                    function(err, none) {
                        if (err) {
                            //TODO: Wat?
                            console.log('Error deleting webhook');
                            callback();
                        }
                        w2g.updateRepo('repoId', row.repoId, 'hookId', null);
                        w2g.updateRepo('repoId', row.repoId, 'active', 0);
                        w2g.wekanc.Boards.delete(row.boardId, function(err, id) {
                            if (err) {
                                console.log('Error deleting board');
                                callback();
                            }
                            w2g.updateRepo('repoId', row.repoId, 'boardId', null);
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
        var repoFullName = args.username+'/'+args.repo;
        w2g.getRepo('repoFullName', repoFullName, function(err, row) {
            exists = (!err && row);
            active = (!err && row.active)? 'X' : '';
            prio_active = (!err && row.active_prio)? 'X' : '';
            if (exists && prio_active === 'X' && args.options.priority) {
                console.log('Repo is already activated');
                callback();
            } else if (exists && active == 'X' && !args.options.priority) {
                console.log('Repo is already activated');
                callback();
            }
            // Create hook then!
            w2g.gogsc.Webhooks.createWebhook(args.username,
                args.repo, url, function(err, hook) {
                    if (!err) {
                        w2g.gogsc.Repos.getRepo(args.username,
                            args.repo, function(err, repo) {
                                // Get repo ID from gogs
                                if (!exists) {
                                    w2g.insertRepo(repo.id,
                                        repoFullName,
                                        w2g.prioBoardId, /* Just in case */
                                        w2g.prioBacklogListId, /* Just in case */
                                        0,
                                        0,
                                        null,
                                        null);
                                }
                                var updateKey = args.options.priority?'active_prio':'active';
                                w2g.updateRepo('repoFullName', repoFullName, updateKey, 1);
                                updateKey = args.options.priority?'hook_prioId':'hookId';
                                w2g.updateRepo('repoFullName', repoFullName, updateKey, hook.id);
                                if (!args.options.priority) {
                                    w2g.wekanc.Boards.create(repoFullName, function(err, boardId) {
                                        if (err) {
                                            console.log('Error creating board in Wekan');
                                            callback();
                                            //TODO: Cleanup
                                        }
                                        updateKey = 'boardId';
                                        w2g.updateRepo('repoFullName', repoFullName, updateKey, boardId);
                                        // Create Backlog List
                                        w2g.wekanc.Lists.create('To Do', boardId,
                                            function(err, listId) {
                                                if (err != null) {
                                                    console.log('Error creating To Do list!');
                                                    callback();
                                                    // TODO: Cleanup
                                                } else {
                                                    updateKey = 'backlogListId';
                                                    w2g.updateRepo('repoFullName', repoFullName, updateKey, listId);
                                                    callback();
                                                }
                                            });
                                    });
                                } else {
                                    callback();
                                }
                            });
                    }
                });
        });
    });

vorpal
    .delimiter('wekan-gogs:')

module.exports = function(_w2g) {
    w2g = _w2g;
    return vorpal;
}
