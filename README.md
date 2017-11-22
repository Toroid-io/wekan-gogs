# wekan-gogs

**wekan-gogs** is a small NodeJS application than provides bidirectional
communication between [Wekan](https://github.com/wekan/wekan) and
[Gogs](https://github.com/gogits/gogs).

## Install

### Ship with Docker

Create a file `docker-compose.yml` like the following. Change the environment
variables to match your setup.

```
version: '2'

services:
  wekan-gogs:
    image: toroid/wekan-gogs
    ports:
      - 7654:7654
    volumes:
      - wekan-gogs-db:/home/node/wekan-gogs/data
    restart: always
    environment:
      - WG_WEKAN_URL=https://my-wekan.io:8081
      - WG_WEKAN_USERNAME=wuser
      - WG_WEKAN_PASSWORD=wpass
      - WG_GOGS_URL=https://my-gogs.io
      - WG_GOGS_USERNAME=guser
      - WG_GOGS_PASSWORD=gpass
      - WG_URL=http://172.19.0.1:7654 # wekan-gogs server URL
      - WG_CLI=true
    stdin_open: true
    tty: true

volumes:
  wekan-gogs-db:
    driver: local
```

Then, run `docker-compose up -d`. The database will be created in the named
volume `wekan-gogs-db`.

The moment you want to use the CLI, attach to the container using `docker
attach {{container-name || container-id}}`. Don't forget to detach using `^P^Q`
to avoid exiting the shell.

**For the moment no UI was developed, so all actions are run through a CLI.**

## User guide

### First Run

After you run wekan-gogs for the first time, an application is registered in
Gogs and a Priority board is created in Wekan.

### Add a repository for synchronization

wekan-gogs does not synchronize any repository by default. To activate
the synchronization between repositories, follow these steps:

#### Update the repository list

```
wekan-gogs: sync repos
wekan-gogs: list
┌─────────────┬────────┬───────────────────┐
│ Name        │ Active │ Active (Priority) │
├─────────────┼────────┼───────────────────┤
│ andres/test │        │                   │
├─────────────┼────────┼───────────────────┤
│ andres/lala │        │                   │
└─────────────┴────────┴───────────────────┘
```

#### Activate the synchronization for a repo
```
wekan-gogs: activate andres test
wekan-gogs: list
┌─────────────┬────────┬───────────────────┐
│ Name        │ Active │ Active (Priority) │
├─────────────┼────────┼───────────────────┤
│ andres/test │ X      │                   │
├─────────────┼────────┼───────────────────┤
│ andres/lala │        │                   │
└─────────────┴────────┴───────────────────┘
```

This will create a board in Wekan using the following convention
`repo_owner/repoName`. Additionally, a set of labels is created in the
repository. These labels match the lists in the newly created Board and are
assigned by `wekan-gogs` automatically upon card movement between lists. You
should not assign one of these labels manually.

For the moment there are four fixed lists:

- `To Do` (label `kan:To Do`)
- `In Progress` (label `kan:In Progress`)
- `Review` (label `kan:Review`)
- `Done` (label `kan:Done`)

You can also activate the repository in priority mode. This will add a label
`kan:Priority` to the repository. If you add that label to an issue, it will be
added as a card in the Priority board.

```
wekan-gogs: activate --priority andres test
wekan-gogs: list
┌─────────────┬────────┬───────────────────┐
│ Name        │ Active │ Active (Priority) │
├─────────────┼────────┼───────────────────┤
│ andres/test │ X      │ X                 │
├─────────────┼────────┼───────────────────┤
│ andres/lala │        │                   │
└─────────────┴────────┴───────────────────┘
```

#### Synchronize issues

wekan-gogs will automatically synchronize the issues created **after**
activating a specific repository. However, if you have open issues in a
newly activated repository, you need to synchronise them manually. The
current Gogs API paginates the results, so you need to provide the page
you're fetching.

```
wekan-gogs: sync issues andres test 1
```

You should now see all your issues created as cards in the `To Do` list, and
the corresponding label assigned to them.

### Need help?

```
wekan-gogs: help

  Commands:

    help [command...]                       Provides help for a given command.
    exit                                    Exits application.
    list [options]                          List repositories
    deactivate [options] <username> <repo>  Deactivate repository
    activate [options] <username> <repo>    Activate repository
    sync issues <username> <repo> <page>    Sync repository issues (only run this after activate)
    sync repos [username]                   Sync repository list
```

## Implemented features

- Open issue in Gogs <--> Create card in Wekan
- Comment on issue <--> Comment on card
- Move card to another list in Wekan --> Assign the label to issue Gogs
- Move card in Priority board <--> Move card in repository board
