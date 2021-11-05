const { name, author, dependencies, repository, version } = require('../package.json')

module.exports = {
  name,
  namespace: `https://alexdymov.github.io/${name}`,
  version,
  author,
  source: repository.url,
  match: [
    'https://monopoly-one.com/*'
  ],
  require: [],
  grant: [
    'none'
  ],
  'run-at': 'document-idle'
}
