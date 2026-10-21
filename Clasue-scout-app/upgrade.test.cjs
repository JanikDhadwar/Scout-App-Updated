const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { migrate, createDatabase } = require('./database.cjs');
const allocation = require('./assignment-service.cjs');
const { changeMember, requestTransfer, respondTransfer } = require('./member-service.cjs');
const { createFixture, fixture } = require('../scripts/qa-fixture.cjs');
const {analyticsForUser}=require('./shared-analytics.cjs');

function data() {
  const db = migrate(fixture()), event = db.scout_events[0];
  event.matches = event.matches.map(m => ({ ...m, actual_time: null, post_result_time: null,
    time: Math.floor(Date.now() / 1000) + 600, alliances: Object.fromEntries(Object.entries(m.alliances).map(([c, a]) => [c, { ...a, score: -1 }])) }));
  db.team_allocations = []; event.assignment = {}; db.submissions = [];
  return db;
}
const input = { event_id: 'qa-event', scout_ids: ['qa-owner', 'qa-admin', 'qa-member'], pit_form_id: 'qa-pit-form', match_form_id: 'qa-match-form', seed: 'test' };
function apply(db, options = input) {
  const preview = allocation.previewPlan(db, options, 'qa-owner');
  return allocation.applyPlan(db, { ...preview.input, fingerprint: preview.fingerprint, request_id: `request-${db.audit_events.length}` }, 'qa-owner');
}
test('approved conditional numeric evidence remains correct without revealing the private condition or notes',async()=>{
 const db=migrate(fixture()),event=db.scout_events[0];event.shared_summary_policy={metric_ids:['qa-match-form:height']};
 const analytics=await analyticsForUser(db,event,'qa-member');
 assert.equal(analytics.teams.find(t=>t.teamNumber==='254').metrics['qa-match-form:height'].mean,2);
 assert.ok(!JSON.stringify(analytics).includes('Climbed'));assert.ok(!JSON.stringify(analytics).includes('Scout notes'));
});
test('migration preserves unknown/legacy fields, imports only unique owners, backs up before write and is repeatable', () => {
  const original = fixture(); original.unknown = { keep: true }; original.scout_events[0].assignment['qa-member'].teams.push(254);
  const first = migrate(original); assert.deepEqual(first.unknown, { keep: true }); assert.equal(first.team_allocations.some(a => a.team_number === 254), false);
  assert.deepEqual(migrate(first), first); assert.equal(original.argus_schema_version, undefined);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-migration-')), filename = path.join(dir, 'db.json');
  try { fs.writeFileSync(filename, JSON.stringify(original)); const store = createDatabase(filename); store.write(store.read());
    assert.deepEqual(JSON.parse(fs.readFileSync(`${filename}.pre-upgrade-v1.bak`)), original);
    assert.equal(store.read().argus_schema_version, 1); assert.throws(() => migrate({ users: {} }), /collection/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('selected scouts own persistent balanced teams with every pit/match duty and idempotent reconciliation', () => {
  const db = data(), result = apply(db);
  assert.equal(result.allocations.length, 4); assert.equal(result.assignments.length, 20);
  const loads = input.scout_ids.map(id => result.allocations.filter(a => a.owner_user_id === id).length);
  assert.ok(Math.max(...loads) - Math.min(...loads) <= 1);
  for (const owner of result.allocations) assert.equal(result.assignments.filter(a => a.team_number === owner.team_number && a.scout_user_id === owner.owner_user_id).length, 5);
  assert.ok(result.conflicts.some(c => c.kind === 'collision'));
  const before = structuredClone(db.team_allocations); apply(db, { ...input, scout_ids: ['qa-owner'] });
  assert.deepEqual(db.team_allocations.map(a => [a.team_number, a.owner_user_id]), before.map(a => [a.team_number, a.owner_user_id]));
  assert.equal(allocation.reconcile(db, db.scout_events[0], 'qa-owner').added, 0);
});
test('deselection, locks, stale previews, schedule additions and accepted coverage preserve ownership guarantees', () => {
  const db = data(); apply(db, { ...input, scout_ids: ['qa-owner', 'qa-admin'] });
  assert.equal(db.team_allocations.some(a => a.owner_user_id === 'qa-member'), false);
  const locked = db.team_allocations[0]; allocation.updateAllocation(db, locked.id, { revision: locked.revision, locked: true }, 'qa-owner');
  const oldOwner = locked.owner_user_id; apply(db, { ...input, mode: 'rerandomize' }); assert.equal(db.team_allocations.find(a => a.id === locked.id).owner_user_id, oldOwner);
  const preview = allocation.previewPlan(db, input, 'qa-owner'); db.scout_events[0].matches.push({ ...db.scout_events[0].matches[0], key: 'qa_extra' });
  assert.throws(() => allocation.applyPlan(db, { ...preview.input, fingerprint: preview.fingerprint, request_id: 'stale' }, 'qa-owner'), /changed/);
  const duty = db.assignments.find(a => a.report_kind === 'match'); duty.scout_user_id = 'qa-idle'; duty.handoff_id = 'accepted';
  const result = allocation.reconcile(db, db.scout_events[0], 'qa-owner'); assert.equal(result.added, 4); assert.equal(duty.scout_user_id, 'qa-idle');
  assert.equal(allocation.reconcile(db, db.scout_events[0], 'qa-owner').added, 0);
});
test('Admin member management cannot escalate roles; transfers need the correct active recipient', () => {
  const db = data();
  assert.throws(() => changeMember(db, { actorId: 'qa-admin', id: 'qa-membership-2', action: 'role', nextRole: 'owner' }), /Owner/);
  assert.throws(() => changeMember(db, { actorId: 'qa-admin', id: 'qa-membership-0', action: 'remove' }), /owner/i);
  assert.throws(() => changeMember(db, { actorId: 'qa-member', id: 'qa-membership-1', action: 'remove' }), /Administrator/);
  const offer = requestTransfer(db, { actorId: 'qa-owner', teamId: 'qa-workspace', targetId: 'qa-member', now: 1000 });
  assert.throws(() => respondTransfer(db, { actorId: 'qa-admin', id: offer.id, action: 'accept', now: 2000 }), /another/);
  assert.throws(() => respondTransfer(db, { actorId: 'qa-member', id: offer.id, action: 'accept', now: 9999999 }), /expired/);
  respondTransfer(db, { actorId: 'qa-member', id: offer.id, action: 'accept', now: 2000 });
  assert.equal(db.teams[0].owner_id, 'qa-member'); assert.equal(db.memberships.filter(m => m.team_id === 'qa-workspace' && m.role === 'owner').length, 1);
  changeMember(db, { actorId: 'qa-admin', id: 'qa-membership-4', action: 'remove' }); assert.ok(!db.memberships.some(m => m.id === 'qa-membership-4'));
});
test('upgraded API enforces roles, immutable removal, approved summaries, practice isolation, history and restart sessions', async () => {
  const { dbFile, directory } = createFixture();
  const reservation = net.createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  let server;
  const start = async () => {
    server = spawn(process.execPath, [path.join(__dirname, 'server.cjs')], { env: { ...process.env, APP_PORT: String(port), DB_FILE: dbFile, TBA_API_KEY: '', GROQ_API_KEY: '' }, stdio: 'pipe' });
    let errors = ''; server.stderr.on('data', d => { errors += d; });
    await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(Error(`startup timeout ${errors}`)), 10000);
      server.stdout.once('data', () => { clearTimeout(timeout); resolve(); }); server.once('exit', code => { if (code) { clearTimeout(timeout); reject(Error(errors)); } }); });
  };
  const stop = () => new Promise(resolve => { server.once('exit', resolve); server.kill(); });
  const client = () => { let cookie = ''; return async (url, method = 'GET', body) => {
    const response = await fetch(`http://127.0.0.1:${port}/api${url}`, { method, headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, body: await response.json() };
  }; };
  try {
    await start(); const owner = client(), admin = client(), scout = client(), foreign = client();
    for (const [call, username] of [[owner, 'qa_owner'], [admin, 'qa_admin'], [scout, 'qa_member'], [foreign, 'qa_outsider']]) assert.equal((await call('/auth/login', 'POST', { username, password: 'ArgusQA2026!' })).status, 200);
    assert.equal((await scout('/admin/overview?event_id=qa-event')).status, 403);
    assert.equal((await foreign('/assignment-plan?event_id=qa-event')).status, 403);
    assert.equal((await admin('/memberships/qa-membership-2/role', 'POST', { role: 'owner' })).status, 403);
    assert.equal((await admin('/memberships/qa-membership-1/remove', 'POST', {})).status, 403);
    assert.equal((await owner('/auth/transfer-ownership', 'POST', { team_id: 'qa-workspace', user_id: 'qa-member' })).status, 403);
    const missing = await admin('/admin/overview?event_id=qa-event'); assert.equal(missing.status, 200); assert.ok(missing.body.assignments.some(a => a.id === 'qa-assignment'));assert.ok(!missing.body.missing.some(a=>a.id==='qa-assignment'),'Future matches are pending, not missed');
    const warning = { event_id: 'qa-event', team_number: '1678', match_key: '2026qa_qm2', dismissed: true, revision: 0 };
    assert.equal((await scout('/admin/coverage', 'POST', warning)).status, 403);
    assert.equal((await foreign('/admin/coverage', 'POST', warning)).status, 403);
    assert.equal((await admin('/admin/coverage', 'POST', { ...warning, match_key: '2026qa_qm4' })).status, 409);
    assert.equal((await admin('/admin/coverage', 'POST', warning)).status, 200);
    assert.equal((await admin('/admin/coverage', 'POST', warning)).status, 409);
    const covered = (await admin('/admin/overview?event_id=qa-event')).body.team_coverage.find(t => t.team_number === '1678');
    assert.ok(covered.dismissed_matches.some(s => s.match_key === warning.match_key));
    assert.ok(!covered.missing_matches.some(s => s.match_key === warning.match_key));
    const teamWarning=(await admin('/admin/overview?event_id=qa-event')).body.team_coverage.find(t=>t.team_number==='2056');
    const teamRequest={scope:'team',event_id:'qa-event',team_number:teamWarning.team_number,dismissed:true,expected_revision:teamWarning.revision};
    const realBefore=(await owner('/submissions')).body;
    assert.equal((await scout('/admin/coverage','POST',teamRequest)).status,403);
    assert.equal((await foreign('/admin/coverage','POST',teamRequest)).status,403);
    assert.equal((await admin('/admin/coverage','POST',teamRequest)).body.status,'green');
    assert.equal((await admin('/admin/coverage','POST',teamRequest)).status,409);
    assert.deepEqual((await owner('/submissions')).body,realBefore,'Team dismissal never invents reports');
    const preview = await admin('/assignment-plan/preview', 'POST', input); assert.equal(preview.status, 200);
    const applied = await admin('/assignment-plan/apply', 'POST', { ...preview.body.input, fingerprint: preview.body.fingerprint, request_id: 'api-plan' }); assert.equal(applied.status, 200);
    assert.equal((await admin('/assignment-plan/apply', 'POST', { ...preview.body.input, fingerprint: preview.body.fingerprint, request_id: 'api-plan' })).body.replayed, true);
    const removal = await admin('/submissions/qa-zero/remove', 'POST', { revision: 0, reason: 'Duplicate review' }); assert.equal(removal.status, 200);
    assert.equal((await scout('/submissions/qa-home/remove', 'POST', { revision: 0, reason: 'Not allowed' })).status, 403);
    assert.equal((await owner('/submissions/qa-zero')).status, 404);
    assert.equal((await admin('/submissions/qa-zero/restore', 'POST', { revision: 1, reason: 'Keep evidence' })).status, 200);
    assert.equal((await owner('/submissions/qa-zero')).status, 200);
    assert.equal((await scout('/submissions/qa-zero')).status, 404);
    assert.equal((await admin('/events/qa-event/sharing', 'PATCH', { revision: 0, metric_ids: ['qa-match-form:auto'] })).status, 200);
    const shared = await scout('/events/qa-event/analytics'); assert.equal(shared.status, 200);
    assert.ok(shared.body.teams.find(t => t.teamNumber === '254').metrics['qa-match-form:auto']);
    const serialized = JSON.stringify(shared.body); assert.ok(!serialized.includes('Scout notes')); assert.ok(!serialized.includes('qa_owner')); assert.ok(!serialized.includes('answers":{"auto":0,"teleop"'));
    assert.equal((await foreign('/events/qa-event/analytics')).status, 403);
    const practice = { id: 'practice-test', team_id: 'qa-workspace', user_id: 'qa-member', form_id: 'qa-pit-form', report_kind: 'pit', answers: { notes: 'Practice only' }, practice: true };
    assert.equal((await scout('/practice', 'POST', practice)).status, 200); assert.equal((await scout('/practice', 'POST', practice)).status, 200);
    assert.ok(!(await owner('/submissions')).body.some(r => r.id === practice.id));
    assert.equal((await scout('/submissions', 'POST', practice)).status, 400);
    const required={id:'required-pit',team_id:'qa-workspace',title:'Required pit',kind:'pit',allow_team_select:true,questions:[{id:'n',text:'Count',type:'number',required:true}]};
    assert.equal((await admin('/forms','POST',required)).status,200);
    const checked={id:'required-report',team_id:'qa-workspace',event_key:'2026qa',form_id:required.id,user_id:'qa-member',report_kind:'pit',scouted_team:'254',questions_snapshot:required.questions,answers:{}};
    assert.equal((await scout('/submissions','POST',checked)).status,400,'Required fields are enforced without the frontend');
    assert.equal((await scout('/submissions','POST',{...checked,answers:{n:'not a number'}})).status,400);
    assert.equal((await scout('/submissions','POST',{...checked,answers:{n:0}})).status,200,'Zero is valid');
    const legacy={...checked,id:'legacy-snapshot',questions_snapshot:[{id:'older',text:'Older value',type:'number'}],answers:{older:3}};
    assert.equal((await scout('/submissions','POST',legacy)).status,200,'Unknown old snapshots are preserved for review');
    const review=(await admin('/admin/reports?team_id=qa-workspace')).body.reports.find(r=>r.id===legacy.id);assert.equal(review.state.review_required,true);
    assert.equal((await scout(`/submissions/${legacy.id}/review`,'POST',{revision:0,reason:'Attempt',approved:true})).status,403);
    assert.equal((await admin(`/submissions/${legacy.id}/review`,'POST',{revision:0,reason:'Reviewed original snapshot',approved:true})).status,200);
    assert.equal((await owner('/scout_events', 'POST', { id: 'new-event', team_id: 'qa-workspace', event_key: 'next', event_name: 'Next', matches: [] })).status, 200);
    const eventPreview = await admin('/event-transition/preview?team_id=qa-workspace&next_event_id=new-event');
    assert.equal((await admin('/event-transition', 'POST', { team_id: 'qa-workspace', next_event_id: 'new-event', expected: eventPreview.body.fingerprint, preserve_history: true })).status, 200);
    assert.ok((await owner('/submissions')).body.some(r => r.id === 'qa-zero'));
    assert.equal((await scout('/admin/activity?team_id=qa-workspace')).status, 403);
    assert.ok((await admin('/admin/activity?team_id=qa-workspace')).body.entries.length > 0);
    await stop(); await start(); assert.equal((await owner('/auth/me')).status, 200, 'session survives process restart');
    assert.ok((await admin('/admin/overview?event_id=qa-event')).body.team_coverage.find(t => t.team_number === '1678').dismissed_matches.some(s => s.match_key === warning.match_key), 'Dismissals survive restart');
    assert.equal((await admin('/admin/coverage', 'POST', { ...warning, dismissed: false, revision: 1 })).status, 200);
    assert.ok((await admin('/admin/overview?event_id=qa-event')).body.team_coverage.find(t => t.team_number === '1678').missing_matches.some(s => s.match_key === warning.match_key));
    const teamAfterRestart=(await admin('/admin/overview?event_id=qa-event')).body.team_coverage.find(t=>t.team_number==='2056');
    assert.equal(teamAfterRestart.status,'green');assert.equal(teamAfterRestart.pit_missing,true);
    assert.equal((await owner('/admin/coverage','POST',{...teamRequest,dismissed:false,expected_revision:teamAfterRestart.revision})).body.status,'red');
    assert.ok(fs.existsSync(`${dbFile}.pre-upgrade-v1.bak`));
  } finally { if (server?.exitCode === null) await stop(); fs.rmSync(directory, { recursive: true, force: true }); }
});
