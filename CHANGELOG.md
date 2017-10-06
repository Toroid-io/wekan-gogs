## [Ureleased] -
### Added
- #16 Dockerfile

### Fixed
- #24 Pass the correct username when new issue is created
- #15 Add opensource project files
- #23 Add description and repository to package.json

## [0.0.4] - 2017-10-04
### Added
- #11 Configuration file
- #14 Name the software

## [0.0.3] - 2017-09-29
###Added
- Server can be run with 'no-cli' parameter in order to run in background
- #8 Add/remove card when an issue is opened or reopened/closed
- #9 Add comment to issue when a comment is added in the card and vice versa

(waiting [merge](https://github.com/wekan/wekan/pull/1263)

## [0.0.2] - 2017-09-08
### Fixed
- #5 Crear la tarjeta de prioridad en la lista correcta
- #3 Pull requests as issues
- #2 Issue pagination

## [0.0.1] - 2017-09-01
### Added
- Register hosts data through the CLI
- Create Priority board
- Add webhook integration to boards
- Activate repo:
 - Create board
 - Create labels in Gogs
 - Create webhook in repo
- Activate repo in priority mode:
 - Create priority label in Gogs
- Sync issues
 - Add them to `To Do` list
- Moving cards are synchronised between priority and normal boards

(waiting [merge](https://github.com/wekan/wekan/pull/1199)
