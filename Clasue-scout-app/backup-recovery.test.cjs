const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const script = path.resolve(__dirname, '../scripts/argus-backup.cjs');
const { createBackup } = require('../scripts/argus-backup.cjs');

function temporary(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-backup-drill-'));
  try { return run(directory); }
  finally { mock.restoreAll(); fs.rmSync(directory, { recursive: true, force: true }); }
}
function data(directory) {
  const filename = path.join(directory, 'source.json');
  const input = { unknown: { preserve: true }, submissions: [{ id: 'confirmed', answers: { photo: 'data:image/png;base64,aGVsbG8=' } }], users: [{ id: 'user', password_hash: 'synthetic-hash' }] };
  fs.writeFileSync(filename, JSON.stringify(input));
  return { filename, input };
}
function cli(...args) { return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', windowsHide: true }); }

test('backup CLI requires an explicit stopped-writer acknowledgement and never writes an existing output directory', () => temporary(directory => {
  const { filename } = data(directory), target = path.join(directory, 'backup');
  const missing = cli('create', '--db', filename, '--out', target);
  assert.notEqual(missing.status, 0); assert.match(missing.stderr, /offline|stopped/i);
  assert.equal(fs.existsSync(target), false);
  fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'keep.txt'), 'newer');
  const existing = cli('create', '--db', filename, '--out', target, '--offline');
  assert.notEqual(existing.status, 0); assert.equal(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8'), 'newer');
}));

test('private backup and restore-to-new-target preserve unknown records and embedded media without restoring sessions', () => temporary(directory => {
  const { filename, input } = data(directory), backup = path.join(directory, 'backup'), target = path.join(directory, 'restored');
  fs.writeFileSync(path.join(directory, 'argus.env'), 'TBA_API_KEY=synthetic-private-value\n');
  fs.writeFileSync(path.join(directory, 'argus-integrations.private.json'), JSON.stringify({ team: { TBA_API_KEY: 'synthetic-workspace-key' } }));
  fs.writeFileSync(path.join(directory, 'argus-sessions.private.json'), JSON.stringify([['sensitive-session', { userId: 'user', expires: Date.now() + 100000 }]]));
  const made = cli('create', '--db', filename, '--out', backup, '--offline', '--include-private');
  assert.equal(made.status, 0, made.stderr);
  assert.equal(made.stdout.includes('synthetic-private-value'), false);
  assert.equal(fs.existsSync(path.join(backup, 'argus-sessions.private.json')), false);
  assert.equal(cli('verify', '--backup', backup).status, 0);
  const recovered = cli('restore', '--backup', backup, '--target', target);
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(target, 'db.json'))), input);
  assert.equal(fs.readFileSync(path.join(target, 'argus.env'), 'utf8'), 'TBA_API_KEY=synthetic-private-value\n');
  assert.equal(fs.existsSync(path.join(target, 'argus-sessions.private.json')), false);
  assert.equal(fs.existsSync(path.join(target, 'db.json.initialized')), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(filename)), input);
  assert.notEqual(cli('restore', '--backup', backup, '--target', target).status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(target, 'db.json'))), input);
}));

test('checksum corruption aborts verification and restoration before creating a destination', () => temporary(directory => {
  const { filename } = data(directory), backup = path.join(directory, 'backup'), target = path.join(directory, 'restored');
  assert.equal(cli('create', '--db', filename, '--out', backup, '--offline').status, 0);
  fs.appendFileSync(path.join(backup, 'db.json'), ' ');
  assert.notEqual(cli('verify', '--backup', backup).status, 0);
  assert.notEqual(cli('restore', '--backup', backup, '--target', target).status, 0);
  assert.equal(fs.existsSync(target), false);
}));

test('unsafe backup manifest names cannot write outside the new restoration directory', () => temporary(directory => {
  const { filename } = data(directory), backup = path.join(directory, 'backup'), target = path.join(directory, 'restored');
  assert.equal(cli('create', '--db', filename, '--out', backup, '--offline').status, 0);
  const manifest = JSON.parse(fs.readFileSync(path.join(backup, 'manifest.json')));
  manifest.files[0].name = '../outside.json';
  fs.writeFileSync(path.join(backup, 'manifest.json'), JSON.stringify(manifest));
  assert.notEqual(cli('restore', '--backup', backup, '--target', target).status, 0);
  assert.equal(fs.existsSync(target), false); assert.equal(fs.existsSync(path.join(directory, 'outside.json')), false);
}));

test('corrupt or missing source databases never create misleading successful backups', () => temporary(directory => {
  for (const bytes of ['{bad', JSON.stringify({ argus_schema_version: 999 }), JSON.stringify({ submissions: {} })]) {
    const filename = path.join(directory, 'source.json'), backup = path.join(directory, 'backup');
    fs.writeFileSync(filename, bytes);
    assert.notEqual(cli('create', '--db', filename, '--out', backup, '--offline').status, 0);
    assert.equal(fs.existsSync(backup), false);
  }
  assert.notEqual(cli('create', '--db', path.join(directory, 'missing.json'), '--out', path.join(directory, 'backup'), '--offline').status, 0);
}));

test('database-only backup excludes operator secrets unless explicitly selected', () => temporary(directory => {
  const { filename } = data(directory), backup = path.join(directory, 'backup');
  fs.writeFileSync(path.join(directory, 'argus.env'), 'SECRET=synthetic\n');
  const made = cli('create', '--db', filename, '--out', backup, '--offline');
  assert.equal(made.status, 0, made.stderr);
  assert.equal(fs.existsSync(path.join(backup, 'argus.env')), false);
  assert.match(made.stdout, /private.*false|database.only/i);
}));

test('a source mutation detected during capture rejects the snapshot before creating output', () => temporary(directory => {
  const { filename } = data(directory), backup = path.join(directory, 'backup');
  const read = fs.readFileSync; let databaseReads = 0;
  mock.method(fs, 'readFileSync', (name, ...args) => {
    if (name === filename && ++databaseReads === 2) fs.appendFileSync(filename, ' ');
    return read(name, ...args);
  });
  assert.throws(() => createBackup({ dbFile: filename, output: backup, offline: true }), /changed during backup/i);
  assert.equal(fs.existsSync(backup), false);
}));

test('invalid private configuration fails without printing secret contents or creating a backup', () => temporary(directory => {
  const { filename } = data(directory), backup = path.join(directory, 'backup');
  fs.writeFileSync(path.join(directory, 'argus-integrations.private.json'), '{synthetic-private-secret');
  const made = cli('create', '--db', filename, '--out', backup, '--offline', '--include-private');
  assert.notEqual(made.status, 0); assert.equal(made.stderr.includes('synthetic-private-secret'), false);
  assert.equal(fs.existsSync(backup), false);
}));
