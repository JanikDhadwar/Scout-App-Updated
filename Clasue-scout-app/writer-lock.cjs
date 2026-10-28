const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomBytes } = require('node:crypto');

const ambiguous = () => Error('Database writer lock is unverified. Stop all writers and inspect private lock ownership before operator recovery.');
function readOwner(filename) {
  try {
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2048) throw ambiguous();
    const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (value?.version !== 1 || !Number.isSafeInteger(value.pid) || value.pid < 1 || !/^[a-f0-9]{64}$/.test(value.token) || value.hostname !== os.hostname() || !Number.isFinite(Date.parse(value.created_at))) throw ambiguous();
    return value;
  } catch { throw ambiguous(); }
}
function definitelyStopped(owner) {
  try { process.kill(owner.pid, 0); return false; }
  catch (error) { if (error.code === 'ESRCH') return true; return false; }
}
function createOwnerFile(filename, owner) {
  let descriptor, created = false;
  try {
    descriptor = fs.openSync(filename, 'wx', 0o600); created = true;
    fs.writeFileSync(descriptor, JSON.stringify(owner)); fs.fsyncSync(descriptor);
  } catch (error) {
    if (descriptor !== undefined) { fs.closeSync(descriptor); descriptor = undefined; }
    if (created) try { fs.unlinkSync(filename); } catch { /* Fail closed if cleanup fails. */ }
    throw error;
  } finally { if (descriptor !== undefined) fs.closeSync(descriptor); }
}
function removeOwned(filename, token) {
  try {
    if (readOwner(filename).token !== token) return false;
    fs.unlinkSync(filename); return true;
  } catch { return false; }
}
function acquireWriterLock(databaseFile) {
  if (typeof databaseFile !== 'string' || !databaseFile) throw Error('An explicit database file is required for the writer lock.');
  let filename = path.resolve(databaseFile);
  let info;
  try { info = fs.lstatSync(filename); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (info?.isSymbolicLink()) throw Error('Database file symlinks are not supported. Configure the actual persistent file path.');
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  filename = fs.existsSync(filename) ? fs.realpathSync(filename) : path.join(fs.realpathSync(path.dirname(filename)), path.basename(filename));
  const lockFile = `${filename}.writer.lock`, guardFile = `${lockFile}.reclaim`;
  const owner = { version: 1, pid: process.pid, token: randomBytes(32).toString('hex'), hostname: os.hostname(), created_at: new Date().toISOString() };
  if (fs.existsSync(guardFile)) throw ambiguous();
  try { createOwnerFile(lockFile, owner); }
  catch (error) {
    if (error.code !== 'EEXIST') throw Error('Database writer lock could not be created. Check private storage permissions.', { cause: error });
    const previous = readOwner(lockFile);
    if (!definitelyStopped(previous)) throw Error('Another Argus database writer is running or its process ownership cannot be disproved.', { cause: error });
    // One reclaimer at a time, including a second owner check under the guard.
    // The guard itself is never automatically reclaimed if a crash leaves it
    // ambiguous. PID reuse similarly causes safe refusal, never a guessed unlock.
    try { createOwnerFile(guardFile, owner); }
    catch { throw ambiguous(); }
    try {
      const current = readOwner(lockFile);
      if (current.token !== previous.token || current.pid !== previous.pid || !definitelyStopped(current)) throw ambiguous();
      fs.unlinkSync(lockFile);
      try { createOwnerFile(lockFile, owner); }
      catch { throw Error('Another Argus database writer acquired the lock during restart.'); }
    } finally { removeOwned(guardFile, owner.token); }
  }
  let released = false;
  function release() {
    if (released) return false;
    released = true; process.removeListener('exit', release);
    return removeOwned(lockFile, owner.token);
  }
  process.once('exit', release);
  return { release };
}
function bindWriterLifecycle(server, lock, { shutdownMs = 30000 } = {}) {
  let stopping = false;
  function stop() {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), shutdownMs); deadline.unref();
    server.close(() => { clearTimeout(deadline); lock.release(); process.exit(0); });
  }
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  server.once('error', () => { lock.release(); console.error('Argus could not listen on the configured port.'); process.exit(1); });
}
module.exports = { acquireWriterLock, bindWriterLifecycle };
