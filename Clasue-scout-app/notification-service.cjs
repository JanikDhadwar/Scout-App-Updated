const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const webpush = require('web-push');
const { rows, reject, requireMember, activeMember } = require('./domain.cjs');
const { activeEvent } = require('./event-transition.cjs');
const { viewPlan } = require('./assignment-service.cjs');
const { isCompleted, matchLabel } = require('./src/argus/workspace-model.js');
const hash = value => createHash('sha256').update(value).digest('hex');

function validSubscription(value) {
  if (!value || typeof value.endpoint !== 'string' || value.endpoint.length > 2048) return false;
  try {
    const url = new URL(value.endpoint), host = url.hostname;
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false;
    if (!['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(host) && !/^[a-z0-9-]+\.notify\.windows\.com$/.test(host)) return false;
    return typeof value.keys?.p256dh === 'string' && /^[\w-]{80,100}$/.test(value.keys.p256dh) && typeof value.keys?.auth === 'string' && /^[\w-]{20,30}$/.test(value.keys.auth);
  } catch { return false; }
}
function createPrivatePush(filename) {
  const read = () => fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : { keys: null, subscriptions: [] };
  function write(value) { fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(`${filename}.tmp`, JSON.stringify(value), { mode: 0o600 }); fs.renameSync(`${filename}.tmp`, filename); }
  function keys() { const value = read(); if (!value.keys) { value.keys = webpush.generateVAPIDKeys(); write(value); } return value.keys; }
  return {
    publicKey: () => keys().publicKey,
    subscriptions: (userId, teamId) => read().subscriptions.filter(s => s.user_id === userId && s.team_id === teamId),
    save(userId, teamId, subscription) {
      if (!validSubscription(subscription)) reject('Unsupported or invalid browser push subscription.', 400);
      const value = read(), id = hash(subscription.endpoint);
      // An endpoint is an installation, not an account. Explicit opt-in after account switch rebinds it.
      value.subscriptions = value.subscriptions.filter(s => s.id !== id);
      value.subscriptions.push({ id, user_id: userId, team_id: teamId, subscription: { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } } });
      write(value); return id;
    },
    remove(id, userId) { const value = read(); value.subscriptions = value.subscriptions.filter(s => !(s.id === id && (!userId || s.user_id === userId))); write(value); },
    async send(record, message) { const vapid = keys(); return webpush.sendNotification(record.subscription, JSON.stringify(message), { TTL: 60, timeout: 8000, vapidDetails: { subject: process.env.ARGUS_PUBLIC_URL || 'https://6390scout.app', publicKey: vapid.publicKey, privateKey: vapid.privateKey } }); },
  };
}
function localTime(now, timezone = 'UTC') {
  try { const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value])); return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) }; }
  catch { return localTime(now, 'UTC'); }
}
function remindersFor(db, teamId, userId, now = Date.now()) {
  const event = activeEvent(db, teamId); if (!event || !activeMember(db, userId, teamId)) return [];
  const preference = rows(db, 'user_preferences').find(p => p.team_id === teamId && p.user_id === userId) || {};
  const time = localTime(now, preference.timezone), quiet = time.hour < 7 || time.hour >= 22;
  const plan = viewPlan(db, event), result = [];
  for (const handoff of rows(db, 'match_handoffs').filter(h => h.team_id === teamId && h.event_key === event.event_key && [h.to_user_id, h.from_user_id].includes(userId))) {
    const pending = handoff.status === 'pending' && handoff.expires_at > now;
    const expires = pending ? handoff.expires_at : Date.parse(handoff.responded_at || handoff.created_at) + 3600000;
    if (expires <= now || (handoff.status === 'pending' && !pending)) continue;
    result.push({ key: `handoff:${handoff.id}:${handoff.status}:${handoff.revision}`, kind: 'handoff', title: pending ? 'Handoff awaiting acceptance' : `Handoff ${handoff.status}`,
      text: `Team ${handoff.team_number} · ${handoff.match_key}. ${pending ? 'Responsibility stays with the sender until accepted.' : 'Open Argus to review responsibility.'}`, route: `/matches/${encodeURIComponent(handoff.match_key)}`, due: now, expires, push: true });
  }
  const duties = plan.assignments.filter(d => d.scout_user_id === userId && !d.completion && !d.schedule_cancelled);
  for (const duty of duties.filter(d => d.report_kind !== 'pit')) {
    const match = event.matches?.find(m => m.key === duty.match_key), start = Number(match?.predicted_time || match?.time) * 1000;
    if (isCompleted(match) || !Number.isFinite(start) || start <= now) continue;
    result.push({ key: `match:${duty.id}:${duty.scout_user_id}`, kind: 'match', title: 'Upcoming assigned match', text: `Team ${duty.team_number} · ${matchLabel(match)}`, route: `/matches/${encodeURIComponent(duty.match_key)}`, due: start - 300000, expires: start, push: !quiet && preference.match_reminders !== false });
  }
  const pits = duties.filter(d => d.report_kind === 'pit');
  if (pits.length && time.hour >= 9 && time.hour < 22) result.push({ key: `pit:${event.id}:${userId}:${time.date}`, kind: 'pit', title: 'Pit scouting still needed', text: `${pits.length} pit reports await server confirmation.`, route: '/assignments', due: now, expires: now + 3600000, push: !quiet && preference.pit_reminders !== false });
  for (const conflict of plan.conflicts.filter(c => c.user_id === userId && !isCompleted(event.matches?.find(m => m.key === c.match_key)))) result.push({ key: `conflict:${event.id}:${conflict.match_key}:${userId}:${conflict.team_numbers.join(',')}`, kind: 'conflict', title: 'Assignment conflict', text: `Teams ${conflict.team_numbers.join(', ')} need you in ${conflict.match_key}. Request one-match coverage.`, route: `/matches/${encodeURIComponent(conflict.match_key)}`, due: now, expires: now + 3600000, push: !quiet });
  return result;
}
function prepareJobs(db, now = Date.now()) {
  let changed = false;
  for (const member of rows(db, 'memberships')) {
    const reminders = remindersFor(db, member.team_id, member.user_id, now);
    for (const reminder of reminders) {
      const key = hash(`${member.team_id}:${member.user_id}:${reminder.key}`);
      let job = rows(db, 'notification_jobs').find(j => j.id === key);
      if (!job) {
        job = { id: key, team_id: member.team_id, user_id: member.user_id, reminder_key: reminder.key, due: reminder.due, expires: reminder.expires, sent: false, attempts: 0 };
        db.notification_jobs = [...rows(db, 'notification_jobs'), job]; changed = true;
      } else if (!job.sent && job.due !== reminder.due && reminder.kind === 'match') { job.due = reminder.due; job.expires = reminder.expires; changed = true; }
      if (reminder.due <= now && !rows(db, 'notifications').some(n => n.id === key)) {
        db.notifications = [...rows(db, 'notifications'), { id: key, team_id: member.team_id, user_id: member.user_id, ...reminder, created_at: new Date(now).toISOString(), read: false }]; changed = true;
      }
    }
  }
  // A week's delivery history is enough for routine dedupe; keep active reminders.
  const cutoff = now - 7 * 86400000;
  for (const key of ['notifications', 'notification_jobs']) {
    const before = rows(db, key), after = before.filter(r => r.expires > cutoff);
    if (after.length !== before.length) { db[key] = after; changed = true; }
  }
  return changed;
}
function createScheduler({ readDB, writeDB, push }) {
  let running = false;
  return async function tick(now = Date.now()) {
    if (running) return; running = true;
    try {
      const db = readDB(); if (prepareJobs(db, now)) writeDB(db);
      const due = rows(db, 'notification_jobs').filter(j => !j.sent && j.attempts < 4 && j.due <= now && j.expires > now && (!j.retry_at || j.retry_at <= now)).slice(0, 50);
      for (const candidate of due) {
        const current = readDB(), job = rows(current, 'notification_jobs').find(j => j.id === candidate.id);
        const reminder = remindersFor(current, candidate.team_id, candidate.user_id, now).find(r => r.key === candidate.reminder_key);
        if (!job || job.sent || !reminder || reminder.expires <= now) continue;
        const subscriptions = push.subscriptions(job.user_id, job.team_id);
        if (!reminder.push || !subscriptions.length) continue;
        job.attempts++; job.retry_at = now + 60000; writeDB(current);
        let failed = false;
        for (const record of subscriptions) {
          // Push lock-screen content intentionally contains no robot data or personal names.
          try { await push.send(record, { title: 'Argus scouting update', body: 'Open Argus to review your assignments or handoffs.', tag: job.id, route: reminder.route }); }
          catch (error) { if ([404, 410].includes(error.statusCode)) push.remove(record.id); else failed = true; }
        }
        const latest = readDB(), saved = rows(latest, 'notification_jobs').find(j => j.id === job.id);
        if (saved) { saved.sent = !failed; saved.last_attempt_at = now; writeDB(latest); }
      }
    } finally { running = false; }
  };
}
function registerNotificationRoutes(app, { readDB, writeDB, dbFile }) {
  const push = createPrivatePush(path.join(path.dirname(dbFile), 'argus-push.private.json'));
  const tick = createScheduler({ readDB, writeDB, push });
  app.get('/api/notifications', (req, res, next) => {
    try {
      const db = readDB(), teamId = req.query.team_id; requireMember(db, req.user.id, teamId);
      if (prepareJobs(db)) writeDB(db);
      const valid = new Set(remindersFor(db, teamId, req.user.id).map(r => r.key));
      res.json(rows(db, 'notifications').filter(n => n.team_id === teamId && n.user_id === req.user.id && n.expires > Date.now() && valid.has(n.key)).slice(-100).reverse());
    } catch (e) { next(e); }
  });
  app.post('/api/notifications/:id/read', (req, res, next) => {
    try { const db = readDB(), row = rows(db, 'notifications').find(n => n.id === req.params.id && n.user_id === req.user.id); if (!row) reject('Notification not found.', 404); requireMember(db, req.user.id, row.team_id); row.read = true; writeDB(db); res.json({ ok: true }); } catch (e) { next(e); }
  });
  app.get('/api/push/status', (req, res, next) => {
    try { const db = readDB(); requireMember(db, req.user.id, req.query.team_id); res.json({ public_key: push.publicKey(), subscriptions: push.subscriptions(req.user.id, req.query.team_id).map(s => ({ id: s.id })) }); } catch (e) { next(e); }
  });
  app.post('/api/push/subscribe', (req, res, next) => {
    try { requireMember(readDB(), req.user.id, req.body?.team_id); res.json({ id: push.save(req.user.id, req.body.team_id, req.body.subscription) }); } catch (e) { next(e); }
  });
  app.post('/api/push/unsubscribe', (req, res, next) => {
    try { requireMember(readDB(), req.user.id, req.body?.team_id); if (typeof req.body?.id !== 'string') reject('Subscription ID required.', 400); push.remove(req.body.id, req.user.id); res.json({ ok: true }); } catch (e) { next(e); }
  });
  const interval = setInterval(() => { tick().catch(() => console.error('Argus reminder scheduler failed; jobs remain saved for retry.')); }, 30000); interval.unref();
  return { tick };
}
module.exports = { validSubscription, remindersFor, prepareJobs, createScheduler, registerNotificationRoutes };
