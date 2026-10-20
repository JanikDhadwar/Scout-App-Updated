const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { rows } = require('./domain.cjs');
const VERSION = 1;
const COLLECTIONS = ['users', 'teams', 'memberships', 'forms', 'submissions', 'announcements',
  'scout_events', 'pit_scouts', 'assignments', 'picklists', 'match_handoffs', 'report_tombstones',
  'team_allocations', 'assignment_plans', 'responsibility_history', 'audit_events', 'submission_states',
  'ownership_transfers', 'practice_submissions', 'user_preferences', 'form_versions', 'notifications', 'notification_jobs'];

function migrate(input,copy=true) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid database. Restore a verified backup; no data was changed.');
  if (Number(input.argus_schema_version || 0) > VERSION) throw Error('Database requires a newer Argus release.');
  const db = copy?structuredClone(input):input;
  for (const collection of COLLECTIONS) {
    if (db[collection] !== undefined && !Array.isArray(db[collection])) throw Error(`Invalid database collection: ${collection}`);
    if (!db[collection]) db[collection] = [];
  }
  if (!db.argus_schema_version) {
    for (const event of db.scout_events) {
      const owners = new Map();
      for (const [userId, allocation] of Object.entries(event.assignment || {})) {
        for (const number of allocation?.teams || []) {
          if (!/^\d+$/.test(String(number)) || Number(number) < 1) continue;
          const key = String(Number(number));
          owners.set(key, [...new Set([...(owners.get(key) || []), userId])]);
        }
      }
      for (const [number, users] of owners) {
        // Ambiguous or former-member allocations remain in the legacy record for review.
        if (users.length !== 1 || !rows(db, 'memberships').some(m => m.team_id === event.team_id && m.user_id === users[0])) continue;
        const id = createHash('sha256').update(`${event.id}:${number}`).digest('hex');
        if (!db.team_allocations.some(a => a.team_id === event.team_id && a.event_key === event.event_key && String(a.team_number) === number)) {
          db.team_allocations.push({ id, team_id: event.team_id, event_id: event.id, event_key: event.event_key,
            team_number: Number(number), owner_user_id: users[0], locked: false, revision: 1, source: 'legacy' });
        }
      }
    }
    // Preserve the event previously displayed on existing installations exactly once.
    for (const team of db.teams) if (!Object.hasOwn(team, 'active_event_id')) {
      team.active_event_id = db.scout_events.find(e => e.team_id === team.id && !e.archived_at && !e.data_cleared_at)?.id || null;
    }
  }
  db.argus_schema_version = VERSION;
  return db;
}
function createDatabase(filename) {
  function read() { return migrate(fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : {},false); }
  function write(db) {
    const validated = migrate(db,false);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    if (fs.existsSync(filename)) {
      const previous = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (!previous.argus_schema_version) {
        const backup = `${filename}.pre-upgrade-v${VERSION}.bak`;
        if (!fs.existsSync(backup)) fs.copyFileSync(filename, backup, fs.constants.COPYFILE_EXCL);
        fs.chmodSync(backup, 0o600);
      }
    }
    fs.writeFileSync(`${filename}.tmp`, JSON.stringify(validated, null, 2), { mode: 0o600 });
    const descriptor=fs.openSync(`${filename}.tmp`,'r');try{fs.fsyncSync(descriptor);}finally{fs.closeSync(descriptor);}
    fs.renameSync(`${filename}.tmp`, filename);
  }
  return { read, write };
}
module.exports = { migrate, createDatabase, VERSION };
