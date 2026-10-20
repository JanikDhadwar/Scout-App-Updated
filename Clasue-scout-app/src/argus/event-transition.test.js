import test from 'node:test';
import assert from 'node:assert/strict';
import transitions from '../../event-transition.cjs';

function fixture(){return {teams:[{id:'team',active_event_id:'old'},{id:'other',active_event_id:'foreign'}],scout_events:[{id:'old',team_id:'team',event_key:'2026old',matches:[{key:'match'}],event_teams:[{team_number:1}],unknown:'retain'},{id:'next',team_id:'team',event_key:'2026next'},{id:'foreign',team_id:'other',event_key:'2026old'}],forms:[{id:'form',team_id:'team',questions:[{id:'q'}]},{id:'foreign-form',team_id:'other'}],submissions:[{id:'report',team_id:'team',event_key:'2026old',answers:{q:2}},{id:'legacy',team_id:'team',unknown:'retain'},{id:'foreign-report',team_id:'other',event_key:'2026old'}],pit_scouts:[{id:'visit',team_id:'team',event_key:'2026old'}],assignments:[{id:'assignment',team_id:'team',event_key:'2026old'}],picklists:[{id:'picklist',team_id:'team',event_key:'2026old'}],unknown_store:{preserve:true}};}

test('event transition deletes only outgoing event records and keeps forms, unrelated teams and legacy evidence',()=>{
 const db=fixture(),preview=transitions.previewTransition(db,'team','next');
 assert.equal(preview.counts.submissions,1);assert.equal(preview.export.submissions[0].answers.q,2);
 transitions.applyTransition(db,{teamId:'team',nextEventId:'next',expected:preview.fingerprint,deleteForms:false});
 assert.equal(db.teams[0].active_event_id,'next');assert.deepEqual(db.submissions.map(row=>row.id),['legacy','foreign-report']);
 for(const store of ['pit_scouts','assignments','picklists'])assert.deepEqual(db[store],[]);
 assert.equal(db.forms[0].archived_at,undefined);assert.equal(db.scout_events[0].unknown,'retain');assert.ok(db.scout_events[0].data_cleared_at);
 assert.deepEqual(db.scout_events[0].matches,[]);assert.deepEqual(db.unknown_store,{preserve:true});
 assert.equal(db.report_tombstones[0].id,'report');
 const nextReport={id:'new-event-report',team_id:'team',event_key:'2026next'};db.submissions.push(nextReport);
 transitions.applyTransition(db,{teamId:'team',nextEventId:'next',expected:preview.fingerprint,deleteForms:false});
 assert.ok(db.submissions.includes(nextReport),'A retry after a lost acknowledgement must not delete next-event reports');
});

test('a changed report or form invalidates the deletion preview without deleting anything',()=>{
 for(const change of [db=>db.submissions.push({id:'late',team_id:'team',event_key:'2026old'}),db=>db.forms[0].questions.push({id:'new'})]){
  const db=fixture(),preview=transitions.previewTransition(db,'team','next');change(db);
  assert.throws(()=>transitions.applyTransition(db,{teamId:'team',nextEventId:'next',expected:preview.fingerprint,deleteForms:false}),/changed/i);
  assert.ok(db.submissions.some(row=>row.id==='report'));assert.equal(db.teams[0].active_event_id,'old');
 }
});

test('removing forms archives templates for unfinished drafts without changing IDs or foreign templates',()=>{
 const db=fixture(),preview=transitions.previewTransition(db,'team','next');
 transitions.applyTransition(db,{teamId:'team',nextEventId:'next',expected:preview.fingerprint,deleteForms:true});
 assert.ok(db.forms[0].archived_at);assert.equal(db.forms[0].id,'form');assert.deepEqual(db.forms[0].questions,[{id:'q'}]);assert.equal(db.forms[1].archived_at,undefined);
 assert.throws(()=>transitions.previewTransition(db,'team','old'),/cleared/i);
});

test('transition refuses another team target and active-event selection is shared across devices',()=>{
 const db=fixture();assert.equal(transitions.activeEvent(db,'team').id,'old');
 assert.throws(()=>transitions.previewTransition(db,'team','foreign'),/event/i);
 assert.throws(()=>transitions.applyTransition(db,{teamId:'team',nextEventId:'next',expected:'wrong',deleteForms:false}),/changed/i);
 assert.throws(()=>transitions.applyTransition(db,{teamId:'team',nextEventId:'next',deleteForms:false}),/changed/i);
 assert.throws(()=>transitions.applyTransition(db,{teamId:'team',nextEventId:'next',expected:transitions.previewTransition(db,'team','next').fingerprint,deleteForms:'yes'}),/forms/i);
});
