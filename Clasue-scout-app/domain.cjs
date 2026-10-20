const { randomUUID } = require('node:crypto');

const rows = (db, key) => Array.isArray(db[key]) ? db[key] : [];
const reject = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const membership = (db, userId, teamId) => rows(db, 'memberships').find(row => row.user_id === userId && row.team_id === teamId);
const role = (db, userId, teamId) => membership(db, userId, teamId)?.role;
const admin = (db, userId, teamId) => ['owner', 'admin'].includes(role(db, userId, teamId));
const activeMember = (db, userId, teamId) => !!membership(db, userId, teamId) && rows(db, 'users').some(user => user.id === userId && !user.disabled && !user.disabled_at);
function requireMember(db, userId, teamId) {
  if (!activeMember(db, userId, teamId)) reject('Workspace membership required.', 403);
}
function requireAdmin(db, userId, teamId) {
  requireMember(db, userId, teamId);
  if (!admin(db, userId, teamId)) reject('Administrator permission required.', 403);
}
function audit(db, { teamId, eventKey = null, actorId, action, targetId, detail = {} }) {
  // Call sites provide bounded operational metadata, never request bodies or answers.
  const entry = { id: randomUUID(), team_id: teamId, event_key: eventKey, actor_id: actorId,
    action, target_id: targetId, detail, created_at: new Date().toISOString() };
  db.audit_events = [...rows(db, 'audit_events'), entry];
  return entry;
}
const reportRemoved = (db, reportId) => rows(db, 'submission_states').some(state => state.id === reportId && state.removed);
const realReports = db => rows(db, 'submissions').filter(report => !reportRemoved(db, report.id) && !rows(db,'submission_states').some(s=>s.id===report.id&&s.review_required));
module.exports = { rows, reject, membership, role, admin, activeMember, requireMember, requireAdmin, audit, reportRemoved, realReports };
