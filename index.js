const { readFileSync } = require('fs')
const { join } = require('path')

const skillsDir = join(__dirname, 'skills')

module.exports = {
  webacl: readFileSync(join(skillsDir, 'webacl.md'), 'utf8')
}
