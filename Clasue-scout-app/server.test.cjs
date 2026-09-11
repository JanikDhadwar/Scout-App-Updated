const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

test('local API persists data, validates writes, and returns JSON errors', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-test-'));
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const db = path.join(dir, 'data', 'db.json');
  const server = spawn(process.execPath, [path.join(__dirname, 'server.cjs')], {
    env: { ...process.env, APP_PORT: String(port), DB_FILE: db }, stdio: 'pipe',
  });
  const base = `http://127.0.0.1:${port}/api`;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
      server.stdout.once('data', () => { clearTimeout(timer); resolve(); });
      server.once('error', reject);
    });
    assert.equal((await fetch(`${base}/health`)).status, 200);
    const write = (url, method, body) => fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await write('/teams', 'POST', { name: 'Missing ID' })).status, 400);
    assert.equal((await write('/teams', 'POST', { id: 'team-1', name: 'Test' })).status, 200);
    assert.equal((await write('/teams/team-1', 'PATCH', { id: 'changed', name: 'Updated' })).status, 200);
    assert.equal((await (await fetch(`${base}/teams/team-1`)).json()).id, 'team-1');
    assert.equal(JSON.parse(fs.readFileSync(db)).teams[0].name, 'Updated');
    assert.equal(fs.existsSync(`${db}.tmp`), false);
    const unknown = await fetch(`${base}/unknown`);
    assert.equal(unknown.status, 404);
    assert.match(unknown.headers.get('content-type'), /json/);
    assert.equal((await write('/session', 'POST', { key: '__proto__' })).status, 400);
    await fetch(`${base}/teams/team-1`, { method: 'DELETE' });
    assert.deepEqual(await (await fetch(`${base}/teams`)).json(), []);
  } finally {
    const stopped = new Promise(resolve => server.once('exit', resolve));
    server.kill();
    await stopped;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
