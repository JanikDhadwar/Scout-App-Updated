const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

function createSessions(filename) {
  let values = new Map();
  if (fs.existsSync(filename)) {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (!Array.isArray(data)) throw Error('Invalid session file. Existing file was preserved.');
    values = new Map(data.filter(([, value]) => value.expires > Date.now()));
  }
  const hash = token => createHash('sha256').update(String(token)).digest('hex');
  function save() {
    for (const [key, value] of values) if (value.expires <= Date.now()) values.delete(key);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(`${filename}.tmp`, JSON.stringify([...values]), { mode: 0o600 });
    fs.renameSync(`${filename}.tmp`, filename);
  }
  return {
    get: token => values.get(hash(token)),
    set(token, value) { values.set(hash(token), value); save(); },
    update(token, patch) { const key=hash(token),value=values.get(key);if(!value)return false;values.set(key,{...value,...patch});save();return true; },
    delete(token) { values.delete(hash(token)); save(); },
    revoke(userId) { for (const [key, value] of values) if (value.userId === userId) values.delete(key); save(); },
  };
}
module.exports = { createSessions };
