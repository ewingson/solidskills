const { readFileSync } = require('fs')
const { join } = require('path')

const skillsDir = join(__dirname, 'skills')

module.exports = {
  protocol: readFileSync(join(skillsDir, 'protocol.md'), 'utf8'),
  webacl: readFileSync(join(skillsDir, 'webacl.md'), 'utf8')
}
