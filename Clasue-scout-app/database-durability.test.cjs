const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase, migrate } = require('./database.cjs');

function temporary(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-storage-fault-'));
  try { return run(path.join(directory, 'db.json'), directory); }
  finally { mock.restoreAll(); fs.rmSync(directory, { recursive: true, force: true }); }
}

test('a missing established database fails closed in process and after restart without recreating records', () => temporary(filename => {
  const store = createDatabase(filename);
  store.write(migrate({ submissions: [{ id: 'durable-report', unknown: { preserve: true } }] }));
  fs.unlinkSync(filename);
  assert.throws(() => store.read(), /missing|unavailable/i);
  assert.throws(() => store.write(migrate({})), /missing|unavailable/i);
  assert.throws(() => createDatabase(filename).read(), /missing|unavailable/i);
  assert.equal(fs.existsSync(filename), false);
}));

test('an existing database observed before its first write cannot disappear into an empty workspace', () => temporary(filename => {
  fs.writeFileSync(filename, JSON.stringify({ submissions: [{ id: 'existing' }] }));
  const store = createDatabase(filename);
  assert.equal(store.read().submissions[0].id, 'existing');
  fs.unlinkSync(filename);
  assert.throws(() => store.read(), /missing|unavailable/i);
  assert.throws(() => createDatabase(filename).read(), /missing|unavailable/i);
  assert.equal(fs.existsSync(filename), false);
}));

test('corrupt and future-schema files remain unchanged and cannot be replaced by an empty write', () => temporary(filename => {
  for (const bytes of ['{broken', JSON.stringify({ argus_schema_version: 999 }), JSON.stringify({ submissions: {} })]) {
    fs.writeFileSync(filename, bytes);
    const store = createDatabase(filename);
    assert.throws(() => store.read());
    assert.throws(() => store.write(migrate({})));
    assert.equal(fs.readFileSync(filename, 'utf8'), bytes);
  }
}));

test('rename failure preserves committed records, removes its temporary file and permits a safe retry', () => temporary((filename, directory) => {
  const store = createDatabase(filename), original = migrate({ submissions: [{ id: 'confirmed' }] });
  store.write(original);
  const changed = store.read(); changed.submissions.push({ id: 'pending', unknown: 42 });
  const rename = fs.renameSync;
  mock.method(fs, 'renameSync', (from, to) => { if (to === filename) throw Object.assign(Error('simulated disk failure'), { code: 'EIO' }); return rename(from, to); });
  assert.throws(() => store.write(changed), /simulated disk failure/);
  assert.deepEqual(store.read(), original);
  assert.equal(fs.readdirSync(directory).filter(name => /\.tmp$/.test(name)).length, 0);
  mock.restoreAll();
  store.write(changed);
  assert.deepEqual(createDatabase(filename).read(), changed);
}));

test('fsync failure cannot acknowledge or replace a committed database', () => temporary(filename => {
  const store = createDatabase(filename); store.write(migrate({ submissions: [{ id: 'confirmed' }] }));
  const bytes = fs.readFileSync(filename, 'utf8');
  mock.method(fs, 'fsyncSync', () => { throw Object.assign(Error('simulated quota failure'), { code: 'ENOSPC' }); });
  assert.throws(() => store.write(migrate({ submissions: [{ id: 'new' }] })), /simulated quota failure/);
  assert.equal(fs.readFileSync(filename, 'utf8'), bytes);
}));

test('database file symlinks are rejected before reading or replacing an external target', () => temporary(filename => {
  fs.writeFileSync(filename, JSON.stringify({ submissions: [{ id: 'external-target' }] }));
  const lstat = fs.lstatSync;
  mock.method(fs, 'lstatSync', (name, ...args) => name === filename ? { isSymbolicLink: () => true } : lstat(name, ...args));
  assert.throws(() => createDatabase(filename), /symbolic|symlink/i);
}));

test('swapping an established database path for a symlink fails closed on subsequent reads and writes', () => temporary(filename => {
  const store = createDatabase(filename); store.write(migrate({ submissions: [{ id: 'confirmed' }] }));
  const bytes = fs.readFileSync(filename, 'utf8'), lstat = fs.lstatSync;
  mock.method(fs, 'lstatSync', (name, ...args) => name === filename ? { isSymbolicLink: () => true } : lstat(name, ...args));
  assert.throws(() => store.read(), /symbolic|symlink/i);
  assert.throws(() => store.write(migrate({})), /symbolic|symlink/i);
  assert.equal(fs.readFileSync(filename, 'utf8'), bytes);
}));
