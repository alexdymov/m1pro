const { name, author, dependencies, repository, version } = require('../package.json')

module.exports = {
  name,
  namespace: `https://alexdymov.github.io/${name}`,
  version,
  author,
  source: repository.url,
  match: [
    'https://monopoly-one.com/*',
    'https://demos.monopoly-one.com/*'
  ],
  require: [],
  grant: [
    'GM_xmlhttpRequest'
  ],
  'run-at': 'document-start'
}
