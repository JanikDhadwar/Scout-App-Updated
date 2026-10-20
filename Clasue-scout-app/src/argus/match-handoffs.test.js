import test from 'node:test';
import assert from 'node:assert/strict';
import handoffs from '../../match-handoffs.cjs';
import {assignedRobots} from './match-access.js';
const now=1000000,isOnline=()=>true;
function fixture(){return {users:['a','b','idle','foreign'].map(id=>({id,username:id})),memberships:['a','b','idle'].map(id=>({user_id:id,team_id:'team'})),teams:[{id:'team',active_event_id:'event'}],scout_events:[{id:'event',team_id:'team',event_key:'e',assignment:{a:{teams:[1,2]},b:{teams:[3]}},matches:[1,2].map(n=>({key:`e_qm${n}`,match_number:n,time:2000,alliances:{red:{team_keys:['frc1','frc2'],score:-1},blue:{team_keys:['frc3'],score:-1}}}))}],assignments:[],submissions:[]};}
const context=(db,userId='a')=>handoffs.handoffContext(db,{teamId:'team',eventId:'event',matchKey:'e_qm1',userId,now,isOnline});
function offer(db,teamNumber='1',id='request'){const mine=context(db).mine.find(row=>row.teamNumber===teamNumber);return handoffs.createHandoff(db,{id,teamId:'team',eventId:'event',matchKey:'e_qm1',teamNumber,toUserId:'idle',ownerRevision:mine.ownerRevision,userId:'a',now,isOnline});}
test('accept transfers exactly one robot for one match and retries cannot transfer it twice',()=>{
 const db=fixture();assert.deepEqual(context(db).eligible.map(row=>row.id),['idle']);const request=offer(db);
 assert.equal(assignedRobots({event:db.scout_events[0],match:db.scout_events[0].matches[0],assignments:db.assignments,userId:'idle'}).length,0);
 const accepted=handoffs.respondHandoff(db,{id:request.id,userId:'idle',action:'accept',revision:1,now,isOnline});assert.equal(accepted.status,'accepted');
 assert.deepEqual(assignedRobots({event:db.scout_events[0],match:db.scout_events[0].matches[0],assignments:db.assignments,userId:'a'}).map(row=>row.teamNumber),['2']);
 assert.equal(assignedRobots({event:db.scout_events[0],match:db.scout_events[0].matches[1],assignments:db.assignments,userId:'a'}).length,2);
 handoffs.respondHandoff(db,{id:request.id,userId:'idle',action:'accept',revision:1,now,isOnline});assert.equal(db.assignments.length,1);
});
test('decline and cancellation keep original coverage; another scout cannot respond',()=>{
 for(const [action,userId] of [['decline','idle'],['cancel','a']]){const db=fixture(),request=offer(db);assert.throws(()=>handoffs.respondHandoff(db,{id:request.id,userId:'b',action:'accept',revision:1,now,isOnline}),/another scout/);handoffs.respondHandoff(db,{id:request.id,userId,action,revision:1,now,isOnline});assert.equal(db.assignments.length,0);}
});
test('offline peers, started matches, stale ownership, foreign scouts and simultaneous acceptances are rejected',()=>{
 const db=fixture(),first=offer(db,'1','first'),second=offer(db,'2','second');
 assert.throws(()=>handoffs.respondHandoff(db,{id:first.id,userId:'idle',action:'accept',revision:1,now,isOnline:()=>false}),/offline/);
 assert.throws(()=>handoffs.respondHandoff(db,{id:first.id,userId:'idle',action:'accept',revision:1,now:3000000,isOnline}),/expired|started/);
 handoffs.respondHandoff(db,{id:first.id,userId:'idle',action:'accept',revision:1,now,isOnline});
 assert.throws(()=>handoffs.respondHandoff(db,{id:second.id,userId:'idle',action:'accept',revision:1,now,isOnline}),/already have/);
 const stale=fixture(),request=offer(stale);stale.scout_events[0].assignment.a.teams=[2];assert.throws(()=>handoffs.respondHandoff(stale,{id:request.id,userId:'idle',action:'accept',revision:1,now,isOnline}),/changed/);
 assert.throws(()=>context(db,'foreign'),/membership/);
});
test('accepted handoff keeps the event form when several match forms exist',()=>{
 const db=fixture();db.forms=['m1','m2'].map(id=>({id,team_id:'team',kind:'match'}));
 db.assignments=[{id:'x',team_id:'team',event_key:'e',match_key:'e_qm2',team_number:3,scout_user_id:'b',report_kind:'match',form_id:'m2',revision:1}];
 const request=offer(db);handoffs.respondHandoff(db,{id:request.id,userId:'idle',action:'accept',revision:1,now,isOnline});
 assert.equal(db.assignments.find(row=>row.handoff_id===request.id).form_id,'m2');
 const unclear=fixture();unclear.forms=db.forms;const second=offer(unclear,'1','second');handoffs.respondHandoff(unclear,{id:second.id,userId:'idle',action:'accept',revision:1,now,isOnline});
 assert.equal(unclear.assignments.find(row=>row.handoff_id===second.id).form_id,'');
});
