const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('../scripts/qa-fixture.cjs');
test('live revision changes only for the selected team and never returns data or integration secrets',()=>{
 const {createRevision}=require('./live-scouting.cjs'),revision=createRevision(),db=fixture(),before=revision(db,'qa-workspace');
 assert.match(before,/^[a-f0-9]{64}$/);db.submissions.find(s=>s.team_id==='qa-other').answers.extra='foreign';assert.equal(revision(db,'qa-workspace'),before);
 db.users.find(u=>u.id==='qa-owner').password_hash='changed-secret';assert.equal(revision(db,'qa-workspace'),before);
 db.submissions.find(s=>s.team_id==='qa-workspace').answers.extra=2;assert.notEqual(revision(db,'qa-workspace'),before);
});
test('official match refresh coalesces callers, preserves intervening edits and handles upstream failures',async()=>{
 const {createMatchRefresh}=require('./live-scouting.cjs');let db=require('./database.cjs').migrate(fixture()),resolveFetch,calls=0,now=0;
 const event=db.scout_events[0],key=event.matches[0].key;event.matches[0].custom='preserved';
 const refresh=createMatchRefresh({readDB:()=>structuredClone(db),writeDB:value=>{db=value;},now:()=>now,fetchMatches:()=>{calls++;return new Promise(r=>{resolveFetch=r;});}});
 const a=refresh(event.id,'key'),b=refresh(event.id,'key');assert.equal(calls,1);db.scout_events[0].event_name='Concurrent edit';db.submissions.push({id:'new-report',team_id:event.team_id});
 resolveFetch([{key,alliances:{red:{score:45},blue:{score:30}}}]);const result=await a;await b;
 assert.equal(result.status,'live');assert.equal(db.scout_events[0].event_name,'Concurrent edit');assert.equal(db.scout_events[0].matches[0].custom,'preserved');assert.equal(db.scout_events[0].matches[0].alliances.red.score,45);assert.equal(db.submissions.at(-1).id,'new-report');
 await refresh(event.id,'key');assert.equal(calls,1);now=31000;const fail=refresh(event.id,'key');resolveFetch({bad:'response'});assert.equal((await fail).status,'unavailable');assert.equal(db.scout_events[0].matches[0].alliances.red.score,45);
});
test('an event switched while an official request is pending is not overwritten',async()=>{
 const {createMatchRefresh}=require('./live-scouting.cjs');let db=require('./database.cjs').migrate(fixture()),resolveFetch,writes=0;const event=db.scout_events[0];
 const refresh=createMatchRefresh({readDB:()=>structuredClone(db),writeDB:()=>writes++,fetchMatches:()=>new Promise(r=>{resolveFetch=r;})});
 const request=refresh(event.id,'key');db.teams[0].active_event_id='another-event';resolveFetch([]);assert.equal((await request).status,'unavailable');assert.equal(writes,0);
});
