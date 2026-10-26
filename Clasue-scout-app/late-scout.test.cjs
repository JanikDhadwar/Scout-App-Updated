const {test}=require('node:test');
const assert=require('node:assert/strict');
const {migrate}=require('./database.cjs');
const {fixture}=require('../scripts/qa-fixture.cjs');
const service=require('./assignment-service.cjs');
function setup(){
 const db=migrate(fixture());db.team_allocations=[];db.assignments=[];db.submissions=[];const event=db.scout_events[0];event.assignment={};
 event.event_teams=Array.from({length:12},(_,i)=>({team_number:100+i}));event.matches=[{key:'future',match_number:1,time:Date.now()/1000+3600,alliances:{red:{team_keys:['frc100','frc101','frc102'],score:-1},blue:{team_keys:['frc103','frc104','frc105'],score:-1}}}];
 const input={event_id:event.id,scout_ids:['qa-owner','qa-admin','qa-member'],pit_form_id:'qa-pit-form',match_form_id:'qa-match-form',mode:'rerandomize',seed:'late-join'};
 const initial=service.previewPlan(db,input,'qa-owner');service.applyPlan(db,{...initial.input,fingerprint:initial.fingerprint,request_id:'initial'},'qa-owner');return{db,event};
}
const addition={event_id:'qa-event',mode:'add_scouts',new_scout_ids:['qa-idle'],seed:'new-scout'};
test('a late scout gets a fair share with the minimum transfers and no old-to-old reshuffle',()=>{
 const {db}=setup(),before=structuredClone(db.team_allocations),reports=structuredClone(db.submissions);
 const preview=service.previewPlan(db,addition,'qa-owner');assert.deepEqual(db.team_allocations,before,'preview is read-only');
 assert.equal(preview.allocations.filter(a=>a.owner_user_id==='qa-idle').length,3);
 assert.equal(preview.transfers.length,3);
 for(const a of preview.allocations){const old=before.find(b=>b.team_number===a.team_number);if(a.owner_user_id!==old.owner_user_id)assert.equal(a.owner_user_id,'qa-idle');assert.equal(a.id,old.id);}
 const result=service.applyPlan(db,{...preview.input,fingerprint:preview.fingerprint,request_id:'addition'},'qa-owner');
 assert.deepEqual(preview.loads.map(l=>l.teams).sort(),[3,3,3,3]);assert.equal(result.allocations.filter(a=>a.owner_user_id==='qa-idle').length,3);assert.deepEqual(db.submissions,reports);
 assert.equal(service.applyPlan(db,{...preview.input,fingerprint:preview.fingerprint,request_id:'addition'},'qa-owner').replayed,true);
});
test('unowned teams go to the newcomer before any existing team moves',()=>{
 const {db,event}=setup();event.event_teams.push(...[112,113,114].map(team_number=>({team_number})));
 const preview=service.previewPlan(db,addition,'qa-owner');assert.equal(preview.transfers.length,0);
 assert.deepEqual(preview.allocations.filter(a=>a.owner_user_id==='qa-idle').map(a=>a.team_number),[112,113,114]);
});
test('a member who joins after the first plan keeps the existing forms and participant choices',()=>{
 const {db,event}=setup();db.users.push({id:'late-arrival',username:'Late arrival'});db.memberships.push({id:'late-membership',team_id:event.team_id,user_id:'late-arrival',role:'member'});
 db.forms.push({...db.forms.find(f=>f.id==='qa-match-form'),id:'another-match-form'});
 const preview=service.previewPlan(db,{...addition,new_scout_ids:['late-arrival'],match_form_id:'another-match-form'},'qa-owner');
 assert.equal(preview.input.match_form_id,'qa-match-form');assert.deepEqual(preview.input.scout_ids,['qa-owner','qa-admin','qa-member','late-arrival']);assert.equal(preview.transfers.length,3);
});
test('locks, completed report duties and accepted match handoffs survive the addition',()=>{
 const {db,event}=setup();for(const a of db.team_allocations.filter(a=>a.owner_user_id==='qa-owner'))a.locked=true;
 const locked=structuredClone(db.team_allocations.filter(a=>a.locked));const duties=db.assignments.filter(a=>a.report_kind==='match');
 duties[0].handoff_id='accepted-cover';duties[0].scout_user_id='qa-member';const handoff=structuredClone(duties[0]);
 const completed=duties.find(d=>!d.handoff_id);db.submissions.push({id:'completed',team_id:event.team_id,event_key:event.event_key,scouted_team:String(completed.team_number),user_id:completed.scout_user_id,form_id:completed.form_id,report_kind:'match',match_key:completed.match_key,answers:{teleop:5}});const done=structuredClone(completed);
 const preview=service.previewPlan(db,addition,'qa-owner');service.applyPlan(db,{...preview.input,fingerprint:preview.fingerprint,request_id:'protected'},'qa-owner');
 for(const a of locked)assert.equal(db.team_allocations.find(b=>b.id===a.id).owner_user_id,a.owner_user_id);
 assert.deepEqual(db.assignments.find(a=>a.id===handoff.id),handoff);assert.deepEqual(db.assignments.find(a=>a.id===done.id),done);
 assert.equal(db.submissions[0].id,'completed');
});
test('fully locked plans explain why no teams can move; permissions and stale membership are checked',()=>{
 const {db}=setup();db.team_allocations.forEach(a=>a.locked=true);const preview=service.previewPlan(db,addition,'qa-owner');
 assert.equal(preview.transfers.length,0);assert.ok(preview.warnings.some(w=>/unlocked/i.test(w)));
 assert.throws(()=>service.previewPlan(db,addition,'qa-member'),/Administrator/);
 assert.throws(()=>service.previewPlan(db,{...addition,new_scout_ids:['qa-outsider']},'qa-owner'),/active|member/i);
 assert.throws(()=>service.previewPlan(db,{...addition,new_scout_ids:['qa-owner']},'qa-owner'),/already/i);
 db.memberships.push({id:'joined-after-preview',team_id:'qa-workspace',user_id:'qa-extra',role:'member'});
 assert.throws(()=>service.applyPlan(db,{...preview.input,fingerprint:preview.fingerprint,request_id:'stale-add'},'qa-owner'),/changed/);
});
