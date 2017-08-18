const vorpal = require('vorpal')();
var Table = require('cli-table');
var w2g = null;

vorpal
    .command('list', 'List repositories')
    .option('-a, --active', 'List only active repositories')
    .option('-n, --not-active', 'List only not active repositories')
    .action(function(args, callback) {
        var console = this;
        w2g.gogsc.Repos.listMyRepos(function(err, repos) {
            if (!err) {
                var table = new Table({
                    head: ['Name', 'Active', 'Active (Priority)']
                });
                var active, prio_active;
                repos.forEach(function(repo, idx_repo, array_repo) {
                    w2g.getRepo('repoId', repo.id, function(err, row) {
                        active = (!err && row.active)? 'X' : '';
                        prio_active = (!err && row.active_prio)? 'X' : '';
                        table.push([repo.full_name, active, prio_active]);
                        if (idx_repo === array_repo.length - 1) {
                            console.log(table.toString());
                            callback();
                        }
                    });
                });
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
                        // CREATE BOARD IF NOT PRIORITY
                        w2g.gogsc.Repos.getRepo(args.username,
                            args.repo, function(err, repo) {
                                // Get repo ID from gogs
                                if (!exists) {
                                    w2g.insertRepo(repo.id,
                                        repoFullName,
                                        w2g.prioBoardId, /* Just in case */
                                        null,
                                        null,
                                        null,
                                        null);
                                }
                                var updateKey = args.options.priority?'active_prio':'active';
                                w2g.updateRepo('repoFullName', repoFullName, updateKey, 'X');
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
                                                }
                                            });
                                        callback();
                                    });
                                }
                                callback();
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
