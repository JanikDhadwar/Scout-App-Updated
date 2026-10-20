import test from 'node:test';
import assert from 'node:assert/strict';
import transitions from '../../event-transition.cjs';

function fixture(){return {teams:[{id:'team',active_event_id:'old'},{id:'other',active_event_id:'foreign'}],scout_events:[{id:'old',team_id:'team',event_key:'old',matches:[{key:'m'}],event_teams:[{team_number:1}],unknown:'retain'},{id:'next',team_id:'team',event_key:'next'},{id:'foreign',team_id:'other',event_key:'old'}],forms:[{id:'f',team_id:'team',questions:[]}],submissions:[{id:'r',team_id:'team',event_key:'old',answers:{q:0}}],pit_scouts:[{id:'v',team_id:'team',event_key:'old'}],assignments:[{id:'a',team_id:'team',event_key:'old'}],picklists:[{id:'p',team_id:'team',event_key:'old'}],match_handoffs:[{id:'h',team_id:'team',event_key:'old'}],unknown:{keep:true}};}
test('activation preserves every outgoing collection, definitions and unknown fields; retries keep next-event reports',()=>{
 const db=fixture(),before=structuredClone(db),preview=transitions.previewTransition(db,'team','next');
 const input={teamId:'team',nextEventId:'next',expected:preview.fingerprint,preserveHistory:true};
 transitions.applyTransition(db,input);assert.equal(db.teams[0].active_event_id,'next');
 for(const key of ['submissions','forms','pit_scouts','assignments','picklists','match_handoffs','scout_events','unknown'])assert.deepEqual(db[key],before[key]);
 db.submissions.push({id:'new',team_id:'team',event_key:'next'});transitions.applyTransition(db,input);assert.equal(db.submissions.length,2);
 assert.equal(db.report_tombstones,undefined);
});
test('stale activation, foreign targets and destructive old-client payloads cannot change data',()=>{
 const db=fixture(),preview=transitions.previewTransition(db,'team','next');
 assert.throws(()=>transitions.applyTransition(db,{teamId:'team',nextEventId:'next',expected:preview.fingerprint,deleteForms:true}),/preserve historical/);
 assert.throws(()=>transitions.previewTransition(db,'team','foreign'),/event/i);
 db.forms.push({id:'late',team_id:'team'});
 assert.throws(()=>transitions.applyTransition(db,{teamId:'team',nextEventId:'next',expected:preview.fingerprint,preserveHistory:true}),/changed/i);
 assert.equal(db.teams[0].active_event_id,'old');assert.equal(db.submissions.length,1);
});
test('no active event is explicit and never silently selects the next event',()=>{
 const db=fixture();db.teams[0].active_event_id=null;assert.equal(transitions.activeEvent(db,'team'),null);
 db.teams[0].active_event_id='missing';assert.equal(transitions.activeEvent(db,'team'),null);
});
