var request = require('request');

var addToBody = function(url, data) {
    var options = {
        url: gogs.baseUrl+'/api/v1'+url,
        json: true,
        headers: {
            'Authorization': 'token '+gogs.token
        },
        body: {}
    };

    for (var k in data) {
        if (data.hasOwnProperty(k)) {
            options.body[k] = data[k];
        }
    }

    return options;
}

var gogs = {
    baseUrl: null,
    user: null,
    pass: null,
    token: null,
    Issues: {
        create: function(username, repoName, title, body, cb) {
            var opts = addToBody('/repos/'+username+'/'+repoName+'/issues', {
                title: title,
                body: body
            });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        edit: function(username, repoName, issueNumber, data, cb) {
            var opts = addToBody('/repos/'+username+'/'+repoName+'/issues/'+issueNumber, data);
            request.patch(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        getAll: function(username, repoName, page, cb) {
            var opts = addToBody('/repos/'+username+'/'+repoName+'/issues?page='+page, {});
            request.get(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        }
    },
    Comments: {
        listIssue: function(username, repoName, issueIndex, cb) {
            var opts = addToBody('/repos/'+username+'/'+repoName+'/issues/'+issueIndex+'/comments', {});
            request.get(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        create: function(username, repoName, issueIndex, body, cb) {
            var opts = addToBody('/repos/'+username+'/'+repoName+'/issues/'+issueIndex+'/comments', {
                body: body
            });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        }
    },
    Repos: {
        listMyRepos: function(cb) {
            var opts = addToBody('/user/repos', {});
            request.get(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        getRepo: function(username, repoName, cb) {
            var opts = addToBody('/repos/'+username+'/'+repoName, {});
            request.get(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        }
    },
    Webhooks: {
        listWebhooks: function(user, repoName, cb) {
            var opts = addToBody('/repos/'+user+'/'+repoName+'/hooks', {});
            request.get(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        // Dafaults to gogs type, json payload
        createWebhook: function(user, repoName, url, cb) {
            var opts = addToBody('/repos/'+user+'/'+repoName+'/hooks', {
                type: 'gogs',
                config: {
                    url: url,
                    content_type: 'json'
                },
                events: [
                    'create',
                    'delete',
                    'fork',
                    'push',
                    'issues',
                    'issue_comment',
                    'pull_request',
                    'release',
                ],
                active: true
            });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        deleteWebhook: function(username, repoName, hookId, cb) {
            var opts = addToBody('/repos/'+username+'/'+repoName+'/hooks/'+hookId, {});
            request.delete(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        }
    },
    Users: {
        createToken: function(appName, cb) {
            if (!gogs.user || !gogs.pass) {
                if (cb) cb('user/pass not set in client!', null);
            }
            var opts = addToBody('/users/'+gogs.user+'/tokens', {
                name: appName
            });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body.sha1);
                }
            }).auth(gogs.user, gogs.pass);
        }
    },
    Labels: {
        getAll: function(username, repoName, cb) {
            var opts = addToBody('/repos/'+username+'/'+repoName+'/labels', {});
            request.get(opts, function(err, res, labels) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, labels);
                }
            });
        },
        getIssueLabels: function(repoName, issueId, cb) {
            var opts = addToBody('/repos/'+gogs.user+'/'+repoName+'/issues/'+issueId+'/labels', {});
            request.get(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        createLabel: function(username, repoName, labelName, labelColor, cb) {
            var opts = addToBody('/repos/'+username+'/'+repoName+'/labels', {
                name: labelName,
                color: labelColor
            });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        addIssueLabels: function(username, repoName, issueIndex, labels, cb) {
            var opts = addToBody('/repos/'+username+'/'+repoName+
                '/issues/'+issueIndex+'/labels', {
                    labels: labels
                });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        deleteIssueLabel: function(username, repoName, issueIndex, labelId, cb) {
            var opts = addToBody('/repos/'+username+'/'+repoName+
                '/issues/'+issueIndex+'/labels/'+labelId, {});
            request.delete(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        },
        delete: function(username, repoName, labelId, cb) {
            var opts = addToBody('/repos/'+username+'/'+repoName+
                '/labels/'+labelId, {});
            request.delete(opts, function(err, res, body) {
                if (err != null) {
                    if (cb) cb(err, null);
                } else {
                    if (cb) cb(null, body);
                }
            });
        }
    }
};

module.exports = function(baseUrl, user, pass) {
    gogs.baseUrl = baseUrl;
    if (!user || !pass) {
        console.log('user/pass must be set');
        return null;
    }
    gogs.user = user;
    gogs.pass = pass;
    return gogs;
};
