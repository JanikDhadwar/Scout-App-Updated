const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');
const modulePath = path.join(__dirname, 'writer-lock.cjs');
const { acquireWriterLock } = require('./writer-lock.cjs');

function writer(filename) {
  const child = spawn(process.execPath, ['-e', `
    try {
      const lock = require(${JSON.stringify(modulePath)}).acquireWriterLock(process.argv[1]);
      process.stdout.write('READY\\n');
      process.on('message', message => { if (message === 'exit') process.exit(0); if (message === 'release') { lock.release(); process.exit(0); } });
    } catch(error) { process.stderr.write(error.message); process.exit(1); }
  `, filename], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
  let output = '';
  const stopped = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  const started = new Promise(resolve => {
    const timeout = setTimeout(() => { child.kill('SIGKILL'); resolve(false); }, 10000);
    child.stdout.on('data', bytes => { output += bytes; if (output.includes('READY\n')) { clearTimeout(timeout); resolve(true); } });
    child.stderr.on('data', bytes => { output += bytes; });
    child.once('exit', () => { clearTimeout(timeout); resolve(false); });
  });
  return { child, started, stopped, get output() { return output; } };
}
function workspace(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-writer-lock-')), filename = path.join(directory, 'db.json'), children = [];
  t.after(async () => { for (const item of children) if (item.child.exitCode === null && item.child.signalCode === null) item.child.kill('SIGKILL'); await Promise.all(children.map(item => item.stopped)); fs.rmSync(directory, { recursive: true, force: true }); });
  return { directory, filename, start() { const item = writer(filename); children.push(item); return item; } };
}

test('a second server process cannot acquire the live writer lock or change its ownership', async t => {
  const scope = workspace(t), first = scope.start();
  assert.equal(await first.started, true, first.output);
  const lockFile = `${scope.filename}.writer.lock`, bytes = fs.readFileSync(lockFile, 'utf8');
  const second = scope.start(); assert.equal(await second.started, false); assert.equal((await second.stopped).code, 1);
  assert.match(second.output, /writer|running|locked/i); assert.equal(fs.readFileSync(lockFile, 'utf8'), bytes);
});

test('normal process exit releases the lock and permits the updater to start the next writer', async t => {
  const scope = workspace(t), first = scope.start(); assert.equal(await first.started, true, first.output);
  first.child.send('exit'); assert.equal((await first.stopped).code, 0);
  assert.equal(fs.existsSync(`${scope.filename}.writer.lock`), false);
  const next = scope.start(); assert.equal(await next.started, true, next.output);
});

test('a crashed writer is cautiously reclaimed and competing restarts yield exactly one new writer', async t => {
  const scope = workspace(t), first = scope.start(); assert.equal(await first.started, true, first.output);
  first.child.kill('SIGKILL'); await first.stopped;
  assert.equal(fs.existsSync(`${scope.filename}.writer.lock`), true);
  const candidates = [scope.start(), scope.start()];
  assert.equal((await Promise.all(candidates.map(item => item.started))).filter(Boolean).length, 1);
  const info = JSON.parse(fs.readFileSync(`${scope.filename}.writer.lock`, 'utf8'));
  const winner = candidates.find(item => item.child.pid === info.pid);
  assert.ok(winner); assert.equal(winner.child.exitCode, null);
});

test('malformed and external-owner locks fail closed without exposing or replacing their contents', async t => {
  const scope = workspace(t), lockFile = `${scope.filename}.writer.lock`;
  const variants = ['{synthetic-secret-invalid-lock', JSON.stringify({ version: 1, pid: 123, token: 'a'.repeat(64), hostname: 'another-host', created_at: new Date().toISOString() })];
  for (const bytes of variants) {
    fs.writeFileSync(lockFile, bytes);
    const candidate = scope.start(); assert.equal(await candidate.started, false); await candidate.stopped;
    assert.equal(fs.readFileSync(lockFile, 'utf8'), bytes); assert.equal(candidate.output.includes('synthetic-secret-invalid-lock'), false);
  }
});

test('an ambiguous stale-reclamation guard is preserved for stopped-writer operator recovery', async t => {
  const scope = workspace(t), guard = `${scope.filename}.writer.lock.reclaim`;
  fs.writeFileSync(guard, 'unverified-owner');
  const candidate = scope.start(); assert.equal(await candidate.started, false); await candidate.stopped;
  assert.equal(fs.readFileSync(guard, 'utf8'), 'unverified-owner'); assert.equal(fs.existsSync(`${scope.filename}.writer.lock`), false);
});

test('cleanup never removes a replacement lock owned by another process token', async t => {
  const scope = workspace(t), first = scope.start(); assert.equal(await first.started, true, first.output);
  const lockFile = `${scope.filename}.writer.lock`, replacement = JSON.stringify({ version: 1, pid: process.pid, token: 'b'.repeat(64), hostname: os.hostname(), created_at: new Date().toISOString() });
  fs.writeFileSync(lockFile, replacement);
  first.child.send('exit'); await first.stopped;
  assert.equal(fs.readFileSync(lockFile, 'utf8'), replacement);
});

test('server port failure and signal lifecycle release ownership before the next start', async t => {
  const scope = workspace(t), reserved = net.createServer();
  await new Promise(resolve => reserved.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => reserved.close(resolve)));
  for (const [port, terminate] of [[reserved.address().port, false], [0, true]]) {
    const child = spawn(process.execPath, ['-e', `
      const {acquireWriterLock, bindWriterLifecycle} = require(${JSON.stringify(modulePath)});
      const lock = acquireWriterLock(process.argv[1]);
      const server = require('node:http').createServer((_req,res)=>res.end('ok'));
      bindWriterLifecycle(server,lock,{shutdownMs:1000});
      server.listen(Number(process.argv[2]),'127.0.0.1',()=>{
        process.stdout.write('READY\\n');
        if (process.argv[3] === 'true') process.emit('SIGTERM');
      });
    `, scope.filename, String(port), String(terminate)], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = ''; child.stdout.on('data', bytes => { output += bytes; }); child.stderr.on('data', bytes => { output += bytes; });
    const code = await new Promise(resolve => child.once('exit', resolve));
    assert.equal(code, terminate ? 0 : 1, output);
    assert.equal(fs.existsSync(`${scope.filename}.writer.lock`), false);
  }
});

test('a database-file symlink cannot produce a writer lock for a different identity', async t => {
  const scope = workspace(t), lstat = fs.lstatSync;
  fs.writeFileSync(scope.filename, '{}');
  mock.method(fs, 'lstatSync', (name, ...args) => name === scope.filename ? { isSymbolicLink: () => true } : lstat(name, ...args));
  let lock;
  try { assert.throws(() => { lock = acquireWriterLock(scope.filename); }, /symbolic|symlink/i); }
  finally { lock?.release(); mock.restoreAll(); }
  assert.equal(fs.existsSync(`${scope.filename}.writer.lock`), false);
});
