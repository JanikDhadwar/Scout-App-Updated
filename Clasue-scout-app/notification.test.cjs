const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validSubscription, remindersFor, prepareJobs, createScheduler } = require('./notification-service.cjs');
const { migrate } = require('./database.cjs');
const { fixture } = require('../scripts/qa-fixture.cjs');

test('push only accepts known HTTPS browser push services, never localhost or arbitrary URLs', () => {
  const keys = { p256dh: 'x'.repeat(87), auth: 'x'.repeat(22) };
  assert.equal(validSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/example', keys }), true);
  for (const endpoint of ['http://fcm.googleapis.com/test', 'https://localhost/test', 'https://127.0.0.1/test', 'https://evil.example/test', 'https://fcm.googleapis.com.evil.example/x', 'https://user:password@fcm.googleapis.com/x', 'https://fcm.googleapis.com:444/x']) assert.equal(validSubscription({ endpoint, keys }), false, endpoint);
  assert.equal(validSubscription({ endpoint: 'https://web.push.apple.com/example', keys: { auth: 'bad' } }), false);
});
test('reminders respect responsibility, event scope, completion, practice exclusion and deduplication', () => {
  const db = migrate(fixture()), now = Date.UTC(2026, 9, 20, 12), match = db.scout_events[0].matches.at(-1);
  match.time = now / 1000 + 240;
  const first = remindersFor(db, 'qa-workspace', 'qa-owner', now);
  assert.ok(first.some(r => r.kind === 'match'));
  assert.equal(remindersFor(db, 'qa-workspace', 'qa-outsider', now).length, 0);
  prepareJobs(db, now); const count = db.notifications.length; prepareJobs(db, now); assert.equal(db.notifications.length, count);
  db.practice_submissions.push({ ...db.submissions[0], user_id: 'qa-owner', scouted_team: 6390, match_key: match.key });
  assert.ok(remindersFor(db, 'qa-workspace', 'qa-owner', now).some(r => r.kind === 'match'));
  db.submissions.push({ id: 'confirmed', team_id: 'qa-workspace', event_key: '2026qa', user_id: 'qa-owner', form_id: 'qa-match-form', scouted_team: 6390, match_key: match.key, report_kind: 'match' });
  assert.ok(!remindersFor(db, 'qa-workspace', 'qa-owner', now).some(r => r.kind === 'match'));
});
test('durable push jobs retry without losing concurrent database changes and never send stale assignments', async () => {
  let db = migrate(fixture()), now = Date.UTC(2026, 9, 20, 12), sends = 0;
  db.scout_events[0].matches.at(-1).time = now / 1000 + 240;
  const tick = createScheduler({ readDB: () => structuredClone(db), writeDB: value => { db = structuredClone(value); },
    push: { subscriptions: id => id === 'qa-owner' ? [{ id: 'test' }] : [], remove() {}, async send(_record, message) { sends++; assert.ok(!JSON.stringify(message).includes('6390')); db.concurrent = 'keep'; } } });
  await tick(now); assert.ok(sends > 0); assert.equal(db.concurrent, 'keep'); const previous = sends;
  await tick(now + 1000); assert.equal(sends, previous);
  // Already handed-off responsibility must never trigger another owner's match push.
  db.assignments[0].scout_user_id = 'qa-member'; db.assignments[0].revision++;
  await tick(now + 2000); assert.equal(sends, previous);
});
