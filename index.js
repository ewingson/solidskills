const { readFileSync } = require('fs')
const { join } = require('path')

const skillsDir = join(__dirname, 'skills')

module.exports = {
  protocol: readFileSync(join(skillsDir, 'protocol.md'), 'utf8'),
  servers: readFileSync(join(skillsDir, 'servers.md'), 'utf8'),
  solidOidc: readFileSync(join(skillsDir, 'solid-oidc.md'), 'utf8'),
  solidos: readFileSync(join(skillsDir, 'solidos.md'), 'utf8'),
  webacl: readFileSync(join(skillsDir, 'webacl.md'), 'utf8')
}
