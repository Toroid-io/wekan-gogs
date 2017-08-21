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
    Repos: {
        listMyRepos: function(callback) {
            var opts = addToBody('/user/repos', {});
            request.get(opts, function(err, res, body) {
                if (err != null) {
                    callback(err, null);
                } else {
                    callback(null, body);
                }
            });
        },
        getRepo: function(username, repoName, callback) {
            var opts = addToBody('/repos/'+username+'/'+repoName, {});
            request.get(opts, function(err, res, body) {
                if (err != null) {
                    callback(err, null);
                } else {
                    callback(null, body);
                }
            });
        }
    },
    Webhooks: {
        listWebhooks: function(user, repoName, callback) {
            var opts = addToBody('/repos/'+user+'/'+repoName+'/hooks', {});
            request.get(opts, function(err, res, body) {
                if (err != null) {
                    callback(err, null);
                } else {
                    callback(null, body);
                }
            });
        },
        // Dafaults to gogs type, json payload
        createWebhook: function(user, repoName, url, callback) {
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
                    callback(err, null);
                } else {
                    callback(null, body);
                }
            });
        },
        deleteWebhook: function(username, repoName, hookId, callback) {
            var opts = addToBody('/repos/'+username+'/'+repoName+'/hooks/'+hookId, {});
            request.delete(opts, function(err, res, body) {
                if (err != null) {
                    callback(err, null);
                } else {
                    callback(null, body);
                }
            });
        }
    },
    Users: {
        createToken: function(appName, callback) {
            if (!gogs.user || !gogs.pass) {
                callback('user/pass not set in client!', null);
            }
            var opts = addToBody('/users/'+gogs.user+'/tokens', {
                name: appName
            });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    callback(err, null);
                } else {
                    callback(null, body.sha1);
                }
            }).auth(gogs.user, gogs.pass);
        }
    },
    Labels: {
        getAll: function(username, repoName, callback) {
            var opts = addToBody('/repos/'+username+'/'+repoName+'/labels', {});
            request.get(opts, function(err, res, labels) {
                if (err != null) {
                    callbak(err, null);
                } else {
                    callback(null, labels);
                }
            });
        },
        getIssueLabels: function(repoName, issueId, callback) {
            var opts = addToBody('/repos/'+gogs.user+'/'+repoName+'/issues/'+issueId+'/labels', {});
            request.get(opts, function(err, res, body) {
                if (err != null) {
                    callbak(err, null);
                } else {
                    callback(null, body);
                }
            });
        },
        createLabel: function(username, repoName, labelName, labelColor, callback) {
            var opts = addToBody('/repos/'+username+'/'+repoName+'/labels', {
                name: labelName,
                color: labelColor
            });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    callbak(err, null);
                } else {
                    callback(null, body);
                }
            });
        },
        addIssueLabels: function(repoName, issueIndex, labels, callback) {
            var opts = addToBody('/repos/'+gogs.user+'/'+repoName+
                '/issues/'+issueIndex+'/labels', {
                    labels: labels
                });
            request.post(opts, function(err, res, body) {
                if (err != null) {
                    callbak(err, null);
                } else {
                    callback(null, body);
                }
            });
        },
        deleteIssueLabel: function(repoName, issueIndex, labelId, callback) {
            var opts = addToBody('/repos/'+gogs.user+'/'+repoName+
                '/issues/'+issueIndex+'/labels/'+labelId, {});
            request.delete(opts, function(err, res, body) {
                if (err != null) {
                    callback(err, null);
                } else {
                    callback(null, body);
                }
            });
        }
    }
};

module.exports = function(baseUrl, user, pass, token) {
    gogs.baseUrl = baseUrl;
    if ((!user || !pass) && !token) {
        console.log('user/pass or token must be set!');
        return null;
    }
    gogs.user = user;
    gogs.pass = pass;
    gogs.token = token;
    return gogs;
};
