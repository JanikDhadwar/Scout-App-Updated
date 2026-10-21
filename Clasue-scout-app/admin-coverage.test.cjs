const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('../scripts/qa-fixture.cjs');
const { migrate } = require('./database.cjs');
const { teamCoverage, changeDismissal, changeTeamDismissal } = require('./admin-coverage.cjs');

test('coverage groups teams and preserves evidence through dismissals and restoration', () => {
  const db = migrate(fixture()), event = db.scout_events[0];
  db.submissions = [{ id: 'pit', team_id: event.team_id, event_key: event.event_key, scouted_team: 254, report_kind: 'pit' }];
  const teams = teamCoverage(db, event);
  assert.equal(teams.length, 4);
  const team = teams.find(t => t.team_number === '254');
  assert.equal(team.team_name, 'Cheesy Poofs'); assert.equal(team.pit_missing, false);
  assert.equal(team.missing_matches.length, 3);
  assert.equal(teams.find(t => t.team_number === '1678').pit_missing, true);
  const before = structuredClone(db.submissions);
  const input = { team_number: '254', match_key: '2026qa_qm1', dismissed: true, revision: 0 };
  changeDismissal(db, event, input, 'qa-admin');
  assert.equal(teamCoverage(db, event)[0].missing_matches.length, 2);
  assert.equal(teamCoverage(db, event)[0].dismissed_matches.length, 1);
  assert.deepEqual(db.submissions, before);
  assert.throws(() => changeDismissal(db, event, input, 'qa-admin'), /changed/);
  assert.throws(() => changeDismissal(db, event, { ...input, match_key: '2026qa_qm4' }, 'qa-admin'), /completed match/);
  changeDismissal(db, event, { ...input, dismissed: false, revision: 1 }, 'qa-owner');
  assert.equal(teamCoverage(db, event)[0].missing_matches.length, 3);
  db.submissions.push({ ...before[0], id: 'match', report_kind: 'match', match_key: input.match_key });
  assert.equal(teamCoverage(db, event)[0].missing_matches.length, 2);
  assert.throws(() => changeDismissal(db, event, { ...input, revision: 2 }, 'qa-admin'), /completed match/);
  db.submission_states.push({ id: 'match', removed: true });
  assert.equal(teamCoverage(db, event)[0].missing_matches.length, 3);
  db.submission_states.push({ id: 'pit', review_required: true });
  assert.equal(teamCoverage(db, event)[0].pit_missing, true);
  assert.equal(db.audit_events.filter(a => a.action.startsWith('coverage.')).length, 2);
});

test('team warning status is red before pit, yellow for missed matches, green only after coverage or explicit dismissals',()=>{
 const db=migrate(fixture()),event=db.scout_events[0];db.submissions=[];
 const read=()=>teamCoverage(db,event).find(t=>t.team_number==='254');
 const dismiss=(dismissed=true,actor='qa-admin')=>changeTeamDismissal(db,event,{team_number:'254',dismissed,expected_revision:read().revision},actor);
 assert.equal(read().status,'red');assert.equal(read().owner_user_id,'qa-owner');
 const before=structuredClone({reports:db.submissions,assignments:db.assignments,allocations:db.team_allocations});
 const oldRevision=read().revision;dismiss();assert.equal(read().status,'green');assert.equal(read().pit_missing,true);assert.equal(read().pit_dismissal.dismissed,true);assert.equal(read().missing_matches.length,0);assert.equal(read().dismissed_matches.length,3);
 assert.deepEqual({reports:db.submissions,assignments:db.assignments,allocations:db.team_allocations},before);
 assert.throws(()=>changeTeamDismissal(db,event,{team_number:'254',dismissed:false,expected_revision:oldRevision},'qa-admin'),/changed/);
 assert.throws(()=>dismiss(false,'qa-member'),/permission/);assert.equal(read().status,'green');
 dismiss(false,'qa-owner');assert.equal(read().status,'red');assert.equal(read().missing_matches.length,3);
 db.submissions.push({id:'pit',team_id:event.team_id,event_key:event.event_key,scouted_team:254,report_kind:'pit'});assert.equal(read().status,'yellow');
 for(const slot of read().missing_matches)db.submissions.push({id:slot.match_key,team_id:event.team_id,event_key:event.event_key,scouted_team:254,report_kind:'match',match_key:slot.match_key});
 assert.equal(read().status,'green');assert.equal(read().pit_missing,false);assert.equal(read().missing_matches.length,0);
 assert.equal(db.audit_events.filter(a=>a.action.startsWith('coverage.team.')).length,2);
});

test('dismissal snapshots reject changed evidence, new missed matches warn again, and scopes and unknown schedules remain honest',()=>{
 const db=migrate(fixture()),event=db.scout_events[0];db.submissions=[];
 const read=()=>teamCoverage(db,event).find(t=>t.team_number==='254');
 const revision=read().revision;
 db.submissions.push({id:'new',team_id:event.team_id,event_key:event.event_key,scouted_team:254,report_kind:'match',match_key:read().missing_matches[0].match_key});
 const before=structuredClone(db);
 assert.throws(()=>changeTeamDismissal(db,event,{team_number:'254',dismissed:true,expected_revision:revision},'qa-admin'),/changed/);assert.deepEqual(db,before);
 changeTeamDismissal(db,event,{team_number:'254',dismissed:true,expected_revision:read().revision},'qa-owner');assert.equal(read().status,'green');
 const upcoming=event.matches.find(m=>m.key==='2026qa_qm4');upcoming.actual_time=123456;assert.equal(read().status,'yellow');assert.equal(read().missing_matches.length,1);
 const elsewhere={...event,id:'other',team_id:'other',event_key:'other'};assert.equal(teamCoverage(db,elsewhere)[0].status,'red');
 const unknown={...event,matches:[]};db.submissions.push({id:'pit',team_id:event.team_id,event_key:event.event_key,scouted_team:254,report_kind:'pit'});assert.equal(teamCoverage(db,unknown)[0].status,'unknown');
 event.event_teams.push({...event.event_teams[0]});assert.equal(teamCoverage(db,event).length,4);
});
