const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {createFixture}=require('../scripts/qa-fixture.cjs');
test('account recovery is single-use, revokes sessions, preserves reports, and rename preserves identity',async()=>{
 const fixture=createFixture(),reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const server=spawn(process.execPath,[path.join(__dirname,'server.cjs')],{env:{...process.env,DB_FILE:fixture.dbFile,APP_PORT:String(port)},stdio:'pipe'});
 const request=async(route,body,cookie='')=>{const res=await fetch(`http://127.0.0.1:${port}/api/auth/${route}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});return{status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};};
 try{
 await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Startup timeout')),10000);server.stdout.once('data',()=>{clearTimeout(timer);r();});server.once('error',j);});
 const login=await request('login',{username:fixture.username,password:fixture.password}),cookie=login.cookie;
 const reports=JSON.parse(fs.readFileSync(fixture.dbFile)).submissions;
 assert.equal((await request('rotate-join-code',{team_id:'qa-other',current_password:fixture.password},cookie)).status,403);
 const rotated=await request('rotate-join-code',{team_id:'qa-workspace',current_password:fixture.password},cookie);assert.equal(rotated.status,200);assert.match(rotated.data.team.password,/^[A-F0-9]{24}$/);
 const joiner=await request('login',{username:'qa_outsider',password:fixture.password});assert.equal((await request('join-team',{number:'6390',password:'QA6390'},joiner.cookie)).status,403);assert.equal((await request('join-team',{number:'6390',password:rotated.data.team.password},joiner.cookie)).status,200);
 assert.equal((await request('recovery-code',{current_password:'wrong'},cookie)).status,401);
 const code=await request('recovery-code',{current_password:fixture.password},cookie);assert.equal(code.status,200);assert.match(code.data.recovery_code,/^[a-f0-9]{48}$/);
 assert.ok(!fs.readFileSync(fixture.dbFile,'utf8').includes(code.data.recovery_code));
 assert.equal((await request('change-username',{username:'qa_admin',current_password:fixture.password},cookie)).status,409);
 const rename=await request('change-username',{username:'New owner name',current_password:fixture.password},cookie);assert.equal(rename.status,200);assert.equal(rename.data.id,login.data.id);assert.equal(rename.data.username,'New owner name');assert.deepEqual(Object.keys(rename.data).sort(),['created_at','id','username']);
 assert.equal((await request('login',{username:fixture.username,password:fixture.password})).status,401);
 const second=await request('login',{username:'New owner name',password:fixture.password});assert.equal(second.status,200);
 assert.equal((await request('reset-password',{username:'New owner name',recovery_code:'0'.repeat(48),new_password:'NewSecret2026!'})).status,401);
 assert.equal((await request('reset-password',{username:'New owner name',recovery_code:code.data.recovery_code,new_password:'NewSecret2026!'})).status,200);
 assert.equal((await request('me',null,cookie)).status,401);assert.equal((await request('me',null,second.cookie)).status,401);
 assert.equal((await request('reset-password',{username:'New owner name',recovery_code:code.data.recovery_code,new_password:'OtherSecret2026!'})).status,401);
 assert.equal((await request('login',{username:'New owner name',password:fixture.password})).status,401);
 const fresh=await request('login',{username:'New owner name',password:'NewSecret2026!'});assert.equal(fresh.status,200);
 const db=JSON.parse(fs.readFileSync(fixture.dbFile));assert.deepEqual(db.submissions,reports);assert.equal(db.memberships.find(m=>m.user_id===login.data.id).username,'New owner name');
 const a=await request('recovery-code',{current_password:'NewSecret2026!'},fresh.cookie),b=await request('recovery-code',{current_password:'NewSecret2026!'},fresh.cookie);
 assert.notEqual(a.data.recovery_code,b.data.recovery_code);assert.equal((await request('reset-password',{username:'New owner name',recovery_code:a.data.recovery_code,new_password:'NewSecretAgain!'})).status,401);
 for(let i=0;i<20;i++)assert.equal((await request('join-team',{number:'6390',password:`wrong-${i}`},fresh.cookie)).status,403);
 assert.equal((await request('join-team',{number:'6390',password:'wrong-again'},fresh.cookie)).status,429);
 // Successful account creation must not reset the aggregate signup limit.
 for(let i=0;i<60;i++)assert.equal((await request('signup',{username:`rotating-${i}`,password:'AnotherSecret!'})).status,200);
 assert.equal((await request('signup',{username:'rotating-final',password:'AnotherSecret!'})).status,429);
 }finally{server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));}
});
test('bounded request limiter resists new usernames and expires without unbounded keys',()=>{
 const {createLimiter}=require('./auth-limits.cjs');let now=0;const limit=createLimiter({maxKeys:2,now:()=>now});
 assert.equal(limit.take('one',2,100),true);assert.equal(limit.take('one',2,100),true);assert.equal(limit.take('one',2,100),false);
 assert.equal(limit.take('two',2,100),true);assert.equal(limit.take('three',2,100),false);now=101;assert.equal(limit.take('three',2,100),true);
});
test('assignment optimization rejects oversized schedules before scoring without changing data',()=>{
 const {fixture}=require('../scripts/qa-fixture.cjs'),db=fixture(),event=db.scout_events[0];event.matches=Array.from({length:401},()=>event.matches[0]);const before=JSON.stringify(db);
 assert.throws(()=>require('./assignment-service.cjs').previewPlan(db,{event_id:event.id,scout_ids:['qa-owner'],pit_form_id:'qa-pit-form',match_form_id:'qa-match-form'},'qa-owner'),/128 teams|400 matches/);
 assert.equal(JSON.stringify(db),before);
});
test('forwarded addresses cannot bypass default limits; trusted loopback proxy uses the closest external address',async()=>{
 for(const trusted of [false,true]){
  const fixture=createFixture(),reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
  const server=spawn(process.execPath,[path.join(__dirname,'server.cjs')],{env:{...process.env,ARGUS_TRUST_PROXY:trusted?'loopback':'',DB_FILE:fixture.dbFile,APP_PORT:String(port)},stdio:'pipe'});
  try{
   await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Startup timeout')),10000);server.stdout.once('data',()=>{clearTimeout(timer);r();});server.once('error',j);});
   const login=async forwarded=>(await fetch(`http://127.0.0.1:${port}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':forwarded},body:JSON.stringify({username:'not-an-account',password:'wrong-password'})})).status;
   for(let i=0;i<20;i++)assert.equal(await login(`198.51.100.${i+1}, 203.0.113.5`),401);
   assert.equal(await login('198.51.100.100, 203.0.113.5'),429,'Untrusted extra addresses cannot reset failure buckets');
   assert.equal(await login('198.51.100.100, 203.0.113.6'),trusted?401:429,'Only an explicitly trusted proxy can identify a different external client');
  }finally{server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));}
 }
});
