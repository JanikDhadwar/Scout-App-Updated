#!/usr/bin/env node
// Deliberately independent of server startup: never load .env or guess DB_FILE.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { migrate } = require('../Clasue-scout-app/database.cjs');
const appVersion = require('../Clasue-scout-app/package.json').version;
const privateNames = ['argus.env', 'argus-integrations.private.json', 'argus-push.private.json'];
const allowedNames = new Set(['db.json', ...privateNames]);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function regularFile(filename, maxBytes = Infinity) {
  const info = fs.lstatSync(filename);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maxBytes) throw Error('Backup input must be an ordinary file within its size limit.');
  return fs.readFileSync(filename);
}
function validateDatabase(bytes) {
  try {
    const original = JSON.parse(bytes.toString('utf8'));
    migrate(original); // Validate a clone: original bytes and unknown fields stay unchanged.
    return original;
  } catch { throw Error('Database cannot be validated. Source files were preserved.'); }
}
function syncDirectory(directory) {
  let descriptor;
  try { descriptor = fs.openSync(directory, 'r'); fs.fsyncSync(descriptor); }
  catch (error) {
    if (process.platform !== 'win32' || !['EPERM', 'EISDIR', 'EINVAL', 'EBADF'].includes(error.code)) throw error;
  } finally { if (descriptor !== undefined) fs.closeSync(descriptor); }
}
function writeNewDirectory(directory, files) {
  fs.mkdirSync(directory, { mode: 0o700 }); // No recursive creation, reuse, overwrite, or --force.
  const owned = [];
  try {
    for (const [name, bytes] of files) {
      const filename = path.join(directory, name);
      const descriptor = fs.openSync(filename, 'wx', 0o600);
      owned.push(filename);
      try { fs.writeFileSync(descriptor, bytes); fs.fsyncSync(descriptor); }
      finally { fs.closeSync(descriptor); }
    }
    syncDirectory(directory);
    syncDirectory(path.dirname(directory));
  } catch (error) {
    // Only files created by this invocation are eligible for cleanup; never
    // recurse through a user-provided path or delete an existing directory.
    for (const filename of owned) try { fs.unlinkSync(filename); } catch { /* Preserve original failure. */ }
    try { fs.rmdirSync(directory); } catch { /* A partial backup cannot verify. */ }
    throw error;
  }
}
function createBackup({ dbFile, output, offline = false, includePrivate = false }) {
  if (!offline) throw Error('Stop every database writer first and pass --offline to acknowledge the stopped-writer requirement.');
  if (!dbFile || !output) throw Error('Explicit --db and --out paths are required. No default database is used.');
  const source = path.resolve(dbFile), directory = path.resolve(output);
  if (fs.existsSync(directory)) throw Error('Backup output already exists. Choose a new directory.');
  const databaseBytes = regularFile(source), database = validateDatabase(databaseBytes);
  const files = new Map([['db.json', databaseBytes]]), sources = new Map([['db.json', source]]);
  if (includePrivate) for (const name of privateNames) {
    const filename = path.join(path.dirname(source), name);
    if (!fs.existsSync(filename)) continue;
    const bytes = regularFile(filename);
    if (name.endsWith('.json')) {
      try { const value = JSON.parse(bytes.toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); }
      catch { throw Error('Private configuration cannot be validated. No backup was created.'); }
    }
    files.set(name, bytes); sources.set(name, filename);
  }
  // Detect accidental running writers or changed configuration. This is not a
  // replacement for quiescing the application and external updater processes.
  for (const [name, filename] of sources) if (!regularFile(filename).equals(files.get(name))) throw Error('Source changed during backup. Stop writers and retry into a new directory.');
  const manifest = {
    format: 'argus-backup-v1', created_at: new Date().toISOString(), app_version: appVersion,
    database_schema: database.argus_schema_version || 0,
    counts: Object.fromEntries(Object.entries(database).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])),
    private_configuration_included: includePrivate, sessions_included: false,
    files: [...files].map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: digest(bytes) })),
  };
  files.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  writeNewDirectory(directory, files);
  return { ok: true, files: manifest.files.length, counts: manifest.counts, private_configuration_included: includePrivate, sessions_included: false };
}
function inspectBackup(directory) {
  directory = path.resolve(directory);
  let manifest;
  try { manifest = JSON.parse(regularFile(path.join(directory, 'manifest.json'), 65536).toString('utf8')); }
  catch { throw Error('Backup manifest is missing or invalid.'); }
  if (manifest?.format !== 'argus-backup-v1' || !Array.isArray(manifest.files) || manifest.files.length < 1 || manifest.files.length > allowedNames.size || manifest.sessions_included !== false || typeof manifest.private_configuration_included !== 'boolean') throw Error('Unsupported or invalid backup manifest.');
  const names = new Set(), files = new Map();
  for (const entry of manifest.files) {
    if (!entry || !allowedNames.has(entry.name) || names.has(entry.name) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw Error('Unsafe or invalid backup file entry.');
    names.add(entry.name);
    const bytes = regularFile(path.join(directory, entry.name));
    if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) throw Error('Backup checksum verification failed. No files were restored.');
    files.set(entry.name, bytes);
  }
  if (!files.has('db.json') || fs.readdirSync(directory).some(name => name !== 'manifest.json' && !names.has(name))) throw Error('Backup contains missing or unexpected files.');
  if (!manifest.private_configuration_included && [...names].some(name => name !== 'db.json')) throw Error('Backup private configuration flags do not match its files.');
  const database = validateDatabase(files.get('db.json'));
  const counts = Object.fromEntries(Object.entries(database).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length]));
  if (JSON.stringify(counts) !== JSON.stringify(manifest.counts) || (database.argus_schema_version || 0) !== manifest.database_schema) throw Error('Backup database metadata does not match its manifest.');
  for (const [name, bytes] of files) if (name !== 'db.json' && name.endsWith('.json')) {
    try { const value = JSON.parse(bytes.toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); }
    catch { throw Error('Backup private configuration is invalid.'); }
  }
  return { manifest, files };
}
function verifyBackup({ backup }) {
  if (!backup) throw Error('An explicit --backup directory is required.');
  const { manifest } = inspectBackup(backup);
  return { ok: true, files: manifest.files.length, counts: manifest.counts, private_configuration_included: manifest.private_configuration_included, sessions_included: false };
}
function restoreBackup({ backup, target }) {
  if (!backup || !target) throw Error('Explicit --backup and --target directories are required.');
  target = path.resolve(target);
  if (fs.existsSync(target)) throw Error('Restoration target already exists. Choose a new directory; existing records are never overwritten.');
  const { manifest, files } = inspectBackup(backup);
  files.set('db.json.initialized', Buffer.from('Argus database initialized\n'));
  writeNewDirectory(target, files);
  return { ok: true, files: manifest.files.length, counts: manifest.counts, sessions_restored: false, activation_required: true };
}
function main(argv) {
  const [command, ...args] = argv, options = {};
  const allowed = { create: ['db', 'out', 'offline', 'include-private'], verify: ['backup'], restore: ['backup', 'target'] }[command];
  if (!allowed) throw Error('Usage: create --db FILE --out NEW_DIRECTORY --offline [--include-private] | verify --backup DIRECTORY | restore --backup DIRECTORY --target NEW_DIRECTORY');
  for (let i = 0; i < args.length; i++) {
    const name = args[i].slice(2);
    if (!args[i].startsWith('--') || !allowed.includes(name) || Object.hasOwn(options, name)) throw Error('Unknown or duplicate backup option.');
    if (['offline', 'include-private'].includes(name)) options[name] = true;
    else { const value = args[++i]; if (!value || value.startsWith('--')) throw Error('A backup path option is missing its value.'); options[name] = value; }
  }
  const result = command === 'create' ? createBackup({ dbFile: options.db, output: options.out, offline: options.offline, includePrivate: options['include-private'] }) : command === 'verify' ? verifyBackup({ backup: options.backup }) : restoreBackup({ backup: options.backup, target: options.target });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`Backup operation failed: ${error.message}\n`); process.exitCode = 1; }
}
module.exports = { createBackup, verifyBackup, restoreBackup };
