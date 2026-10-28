const { randomUUID } = require('node:crypto');
const { rows, reject, requireMember, requireAdmin, admin, role, audit, realReports } = require('./domain.cjs');
const assignments = require('./assignment-service.cjs');
const members = require('./member-service.cjs');
const coverage = require('./admin-coverage.cjs');
const { changeReportState,validateReport } = require('./submission-service.cjs');
const { analyticsForUser, sharedInputs } = require('./shared-analytics.cjs');
const { refreshStates } = require('./match-handoffs.cjs');

function registerUpgradeRoutes(app, { readDB, writeDB, verifyPassword, sessions, dbFile }) {
  require('./notification-service.cjs').registerNotificationRoutes(app,{readDB,writeDB,dbFile});
  // All handlers are mounted after authentication and before generic collections.
  const route = (method, path, handler) => app[method](path, async (req, res, next) => {
    try { const value = await handler(req); res.json(value); }
    catch (error) { if (!error.status) return next(error); res.status(error.status).json({ error: error.message }); }
  });
  route('get', '/api/assignment-plan', req => {
    const db = readDB(), event = assignments.eventFor(db, req.query.event_id);
    requireMember(db, req.user.id, event.team_id);
    const view = assignments.viewPlan(db, event);
    if (!admin(db, req.user.id, event.team_id)) {
      const owned=new Set(view.allocations.filter(a=>a.owner_user_id===req.user.id).map(a=>String(a.team_number)));
      view.assignments = view.assignments.filter(a => a.scout_user_id === req.user.id || a.primary_scout_user_id === req.user.id || owned.has(String(a.team_number)));
      view.conflicts = view.conflicts.filter(c => c.user_id === req.user.id);
      view.allocations = view.allocations.filter(a => a.owner_user_id === req.user.id);
      view.unowned = []; view.plan = view.plan ? { revision: view.plan.revision } : null;
    }
    return view;
  });
  route('post', '/api/assignment-plan/preview', req => assignments.previewPlan(readDB(), req.body || {}, req.user.id));
  route('post', '/api/assignment-plan/apply', req => {
    const db = readDB(), result = assignments.applyPlan(db, req.body || {}, req.user.id); writeDB(db); return result;
  });
  route('patch', '/api/team-allocations/:id', req => {
    const db = readDB(), result = assignments.updateAllocation(db, req.params.id, req.body || {}, req.user.id); writeDB(db); return result;
  });
  route('post', '/api/assignment-plan/reconcile', req => {
    const db = readDB(), event = assignments.eventFor(db, req.body?.event_id, req.user.id);
    const result = assignments.reconcile(db, event, req.user.id);
    audit(db, { teamId: event.team_id, eventKey: event.event_key, actorId: req.user.id, action: 'assignments.reconcile', targetId: event.id, detail: result });
    writeDB(db); return result;
  });
  // The old generator encoded per-match randomization and could bypass participant choices.
  route('post', '/api/assignments/generate', req => {
    const db = readDB(); assignments.eventFor(db, req.body?.event_id, req.user.id);
    reject('Open Assignments and preview permanent team ownership. The older per-match randomizer has been retired.');
  });
  route('get', '/api/admin/overview', req => {
    const db = readDB(), event = assignments.eventFor(db, req.query.event_id, req.user.id);
    if (refreshStates(db)) writeDB(db);
    const view = assignments.viewPlan(db, event);
    const { isCompleted } = require('./src/argus/workspace-model.js');
    const missing = view.assignments.filter(a => !a.completion && !a.schedule_cancelled && (a.report_kind === 'pit' || isCompleted(event.matches?.find(m => m.key === a.match_key))));
    return { ...view, team_coverage: coverage.teamCoverage(db, event, view.assignments), missing, completed: view.assignments.filter(a => a.completion).length,
      members: rows(db, 'memberships').filter(m => m.team_id === event.team_id),
      people:rows(db,'users').filter(u=>view.assignments.some(a=>a.scout_user_id===u.id||a.primary_scout_user_id===u.id)||rows(db,'audit_events').some(a=>a.team_id===event.team_id&&a.actor_id===u.id)).map(u=>({id:u.id,username:u.username})),
      handoffs: rows(db, 'match_handoffs').filter(h => h.team_id === event.team_id && h.event_key === event.event_key),
      history: rows(db, 'responsibility_history').filter(h => h.team_id === event.team_id && h.event_key === event.event_key).slice(-200).reverse(),
      training: rows(db,'practice_submissions').filter(r=>r.team_id===event.team_id).map(r=>({id:r.id,user_id:r.user_id,report_kind:r.report_kind,created_at:r.created_at})) };
  });
  route('post', '/api/admin/coverage', req => {
    const db = readDB(), event = assignments.eventFor(db, req.body?.event_id, req.user.id);
    const result = req.body?.scope==='team'?coverage.changeTeamDismissal(db,event,req.body,req.user.id):coverage.changeDismissal(db, event, req.body || {}, req.user.id);
    writeDB(db); return result;
  });
  route('get', '/api/admin/members', req => {
    const db = readDB(); requireAdmin(db, req.user.id, req.query.team_id);
    return rows(db, 'memberships').filter(m => m.team_id === req.query.team_id);
  });
  route('get', '/api/admin/activity', req => {
    const db = readDB(); requireAdmin(db, req.user.id, req.query.team_id);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const entries = rows(db, 'audit_events').filter(a => a.team_id === req.query.team_id && (!req.query.event_key || a.event_key === req.query.event_key)).reverse();
    const start = req.query.before ? entries.findIndex(a => a.id === req.query.before) + 1 : 0;
    return { entries: entries.slice(start, start + limit), next: entries[start + limit]?.id ? entries[start + limit - 1]?.id : null };
  });
  for (const action of ['remove', 'role']) route('post', `/api/memberships/:id/${action}`, req => {
    const db = readDB(), result = members.changeMember(db, { id: req.params.id, actorId: req.user.id, action, nextRole: req.body?.role });
    writeDB(db); return result;
  });
  route('post', '/api/auth/transfer-ownership', async req => {
    const snapshot = readDB();
    if (role(snapshot, req.user.id, req.body?.team_id) !== 'owner') reject('Owner permission required.', 403);
    const account=rows(snapshot,'users').find(u=>u.id===req.user.id);
    if (typeof req.body?.password !== 'string' || req.body.password.length>1024 || !await verifyPassword(req.body.password, account?.password_hash)) reject('Re-enter your password to request ownership transfer.', 403);
    const db=readDB(),current=rows(db,'users').find(u=>u.id===req.user.id),session=sessions.get(req.sessionToken);
    if(!current||current.disabled||current.disabled_at||current.password_hash!==account.password_hash||!session||session.userId!==current.id||session.expires<=Date.now())reject('Account changed. Sign in again.',401);
    if(role(db,req.user.id,req.body?.team_id)!=='owner')reject('Owner permission required.',403);
    const result = members.requestTransfer(db, { actorId: req.user.id, teamId: req.body.team_id, targetId: req.body.user_id }); writeDB(db); return result;
  });
  route('get', '/api/ownership-transfers', req => {
    const db = readDB(); requireMember(db, req.user.id, req.query.team_id);
    return rows(db, 'ownership_transfers').filter(t => t.team_id === req.query.team_id && [t.from_user_id, t.to_user_id].includes(req.user.id))
      .map(t => ({ ...t, status: t.status === 'pending' && t.expires_at <= Date.now() ? 'expired' : t.status }));
  });
  route('post', '/api/ownership-transfers/:id/respond', req => {
    const db = readDB(), result = members.respondTransfer(db, { actorId: req.user.id, id: req.params.id, action: req.body?.action }); writeDB(db); return result;
  });
  for (const removed of [true, false]) route('post', `/api/submissions/:id/${removed ? 'remove' : 'restore'}`, req => {
    const db = readDB(), result = changeReportState(db, { id: req.params.id, actorId: req.user.id, removed, reason: req.body?.reason, revision: req.body?.revision });
    refreshStates(db); writeDB(db); return result;
  });
  route('post','/api/submissions/:id/review',req=>{
    const db=readDB(),report=rows(db,'submissions').find(r=>r.id===req.params.id);if(!report)reject('Report not found.',404);
    requireAdmin(db,req.user.id,report.team_id);
    const state=rows(db,'submission_states').find(s=>s.id===report.id);if(!state||!state.review_required)reject('This report does not need legacy-snapshot review.');
    if(req.body?.revision!==state.revision)reject('Report state changed. Reload before reviewing.');
    if(req.body?.approved!==true||typeof req.body.reason!=='string'||!req.body.reason.trim()||req.body.reason.length>500)reject('Review the original report and enter a reason before approving.',400);
    state.review_required=false;state.reviewed_by=req.user.id;state.reviewed_at=new Date().toISOString();state.revision++;
    audit(db,{teamId:report.team_id,eventKey:report.event_key,actorId:req.user.id,action:'report.review',targetId:report.id,detail:{reason:req.body.reason.trim()}});
    refreshStates(db);writeDB(db);return state;
  });
  route('get', '/api/admin/reports', req => {
    const db = readDB(); requireAdmin(db, req.user.id, req.query.team_id);
    const reports = rows(db, 'submissions').filter(r => r.team_id === req.query.team_id && (!req.query.event_key || r.event_key === req.query.event_key));
    const page = Math.max(0, Number(req.query.page) || 0);
    return { total: reports.length, reports: reports.slice().reverse().slice(page * 25, page * 25 + 25).map(r => ({
      id: r.id, form_title: r.form_title, scouted_team: r.scouted_team, match_key: r.match_key, report_kind: r.report_kind, user_id: r.user_id, created_at: r.created_at,
      state: rows(db, 'submission_states').find(s => s.id === r.id) || { revision: 0, removed: false } })) };
  });
  route('get', '/api/events/:id/analytics', req => {
    const db = readDB(), event = assignments.eventFor(db, req.params.id); requireMember(db, req.user.id, event.team_id);
    return analyticsForUser(db, event, req.user.id);
  });
  route('get', '/api/events/:id/evidence/:reportId', req => {
    const db = readDB(), event = assignments.eventFor(db, req.params.id); requireMember(db, req.user.id, event.team_id);
    const report = (admin(db, req.user.id, event.team_id) ? realReports(db) : sharedInputs(db, event).submissions)
      .find(r => r.id === req.params.reportId && r.team_id === event.team_id && r.event_key === event.event_key);
    if (!report) reject('Approved evidence not found.', 404);
    return report;
  });
  route('patch', '/api/events/:id/sharing', req => {
    const db = readDB(), event = assignments.eventFor(db, req.params.id, req.user.id);
    if (req.body?.revision !== (event.sharing_revision || 0)) reject('Publication settings changed. Reload before saving.');
    const ids = req.body.metric_ids;
    const allowed = new Set(rows(db, 'forms').filter(f => f.team_id === event.team_id).flatMap(f => (f.questions || []).filter(q => ['number', 'scale', 'boolean', 'select'].includes(q.type)).map(q => `${f.id}:${q.id}`)));
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !allowed.has(id))) reject('Choose existing structured measurements.', 400);
    event.shared_summary_policy = { metric_ids: [...new Set(ids)] }; event.sharing_revision = (event.sharing_revision || 0) + 1;
    audit(db, { teamId: event.team_id, eventKey: event.event_key, actorId: req.user.id, action: 'summary.publish', targetId: event.id, detail: { metric_ids: event.shared_summary_policy.metric_ids } });
    writeDB(db); return { policy: event.shared_summary_policy, revision: event.sharing_revision };
  });
  route('get', '/api/practice', req => {
    const db = readDB(); requireMember(db, req.user.id, req.query.team_id);
    return rows(db, 'practice_submissions').filter(r => r.team_id === req.query.team_id && r.user_id === req.user.id);
  });
  route('post', '/api/practice', req => {
    const db = readDB(), body = req.body || {}; requireMember(db, req.user.id, body.team_id);
    if (body.user_id !== req.user.id || typeof body.id !== 'string' || !/^[-\w]{1,200}$/.test(body.id) || !['pit', 'match'].includes(body.report_kind)) reject('Invalid practice identity or report type.', 400);
    const form = rows(db, 'forms').find(f => f.id === body.form_id && f.team_id === body.team_id && (f.kind || 'match') === body.report_kind);
    if (!form) reject('Choose a workspace practice form.', 400);
    if (!body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) reject('Practice answers must be an object.', 400);
    const check={...body,event_key:null};delete check.practice;delete check.practice_session_id;delete check.mode;
    const invalid=validateReport(db,form,check);if(invalid)reject(invalid,400);
    const existing = rows(db, 'practice_submissions').find(r => r.id === body.id);
    const { isDeepStrictEqual } = require('node:util');
    if (existing) { if (isDeepStrictEqual(existing, body)) return existing; reject('This practice ID already has different answers.'); }
    // Practice accepts the same immutable offline payload but never enters real report stores.
    db.practice_submissions = [...rows(db, 'practice_submissions'), body]; writeDB(db); return body;
  });
  route('get', '/api/preferences', req => {
    const db = readDB(); requireMember(db, req.user.id, req.query.team_id);
    return rows(db, 'user_preferences').find(p => p.team_id === req.query.team_id && p.user_id === req.user.id) || { team_id: req.query.team_id, user_id: req.user.id };
  });
  route('patch', '/api/preferences', req => {
    const db = readDB(), body = req.body || {}; requireMember(db, req.user.id, body.team_id);
    if (body.available !== undefined && typeof body.available !== 'boolean') reject('Invalid availability.', 400);
    if (body.guide_dismissed !== undefined && typeof body.guide_dismissed !== 'boolean') reject('Invalid guide preference.', 400);
    const old = rows(db, 'user_preferences').find(p => p.team_id === body.team_id && p.user_id === req.user.id);
    if(body.timezone!==undefined){try{if(typeof body.timezone!=='string'||body.timezone.length>100)throw Error();new Intl.DateTimeFormat('en',{timeZone:body.timezone}).format();}catch{reject('Choose a valid timezone.',400);}}
    for(const key of ['match_reminders','pit_reminders'])if(body[key]!==undefined&&typeof body[key]!=='boolean')reject('Invalid reminder setting.',400);
    const row = { ...old, id: old?.id || randomUUID(), team_id: body.team_id, user_id: req.user.id,
      available: body.available ?? old?.available ?? true, guide_dismissed: body.guide_dismissed ?? old?.guide_dismissed ?? false,
      timezone:body.timezone||old?.timezone||'UTC',match_reminders:body.match_reminders??old?.match_reminders??true,pit_reminders:body.pit_reminders??old?.pit_reminders??true };
    db.user_preferences = [...rows(db, 'user_preferences').filter(p => p.id !== old?.id), row]; writeDB(db); return row;
  });
}
module.exports = { registerUpgradeRoutes };
