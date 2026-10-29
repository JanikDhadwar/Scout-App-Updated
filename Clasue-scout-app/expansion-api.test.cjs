const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');
const {createFixture}=require('../scripts/qa-fixture.cjs');

test('new intelligence preserves direct API permissions, safe sessions and first-workspace onboarding',async()=>{
 const fixture=createFixture(),reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const envFile=path.join(fixture.directory,'isolated.env');fs.writeFileSync(envFile,'');
 const server=spawn(process.execPath,[path.join(__dirname,'server.cjs')],{env:{...process.env,DB_FILE:fixture.dbFile,ARGUS_ENV_FILE:envFile,APP_PORT:String(port),ARGUS_REQUIRE_PRIVILEGED_MFA:'false',NODE_ENV:'test'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 const base=`http://127.0.0.1:${port}`;
 const request=async(route,{body,cookie,method=body?'POST':'GET'}={})=>{const response=await fetch(base+'/api'+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Fixture startup timed out')),10000);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.once('exit',code=>{clearTimeout(timer);reject(Error(`Fixture exited: ${code}`));});});
  const owner=await request('/auth/login',{body:{username:'qa_owner',password:fixture.password}}),member=await request('/auth/login',{body:{username:'qa_member',password:fixture.password}}),outsider=await request('/auth/login',{body:{username:'qa_outsider',password:fixture.password}});
  const sessionFile=path.join(fixture.directory,'argus-sessions.private.json'),stamp=fs.statSync(sessionFile,{bigint:true}).mtimeNs;
  for(let i=0;i<3;i++)assert.equal((await request('/users',{cookie:`argus_session=unknown-${i}`})).status,401);
  assert.equal(fs.statSync(sessionFile,{bigint:true}).mtimeNs,stamp,'Unknown cookies must not rewrite sessions');
  assert.equal((await request('/events/qa-event/analytics',{cookie:outsider.cookie})).status,403);
  const original=await request('/scout_events/qa-event',{cookie:owner.cookie}),config={...original.data.analytics_config,'qa-match-form:climb':{phase:'endgame',insight:{kind:'success_rate',strength:.8,concern:.5,outcomes:{Yes:'success',No:'failure'}}}};
  assert.equal((await request('/scout_events/qa-event',{cookie:member.cookie,method:'PATCH',body:{analytics_config:config,analytics_revision:0}})).status,403);
  assert.equal((await request('/scout_events/qa-event',{cookie:owner.cookie,method:'PATCH',body:{analytics_config:config,analytics_revision:0}})).status,200);
  assert.equal((await request('/scout_events/qa-event',{cookie:owner.cookie,method:'PATCH',body:{analytics_config:config,analytics_revision:0}})).status,409);
  assert.equal((await request('/events/qa-event/sharing',{cookie:owner.cookie,method:'PATCH',body:{revision:0,metric_ids:['qa-match-form:climb']}})).status,200);
  const shared=await request('/events/qa-event/analytics',{cookie:member.cookie}),text=JSON.stringify(shared.data);
  assert.equal(shared.status,200);assert.equal(shared.data.metrics.length,1);assert.equal(shared.data.metrics[0].id,'qa-match-form:climb');assert.ok(shared.data.teams.every(team=>team.intelligence));
  for(const secret of ['Second independent observation','Foreign workspace','qa_owner','qa_admin','qa-member'])assert.ok(!text.includes(secret),secret);
  const evidence=await request('/events/qa-event/evidence/qa-zero',{cookie:member.cookie});assert.equal(evidence.status,200);assert.deepEqual(Object.keys(evidence.data.answers),['climb']);assert.equal(evidence.data.submitted_by,undefined);
  assert.equal((await request('/preferences?team_id=qa-workspace',{cookie:member.cookie})).data.onboarding_eligible,false);
  const signup=await request('/auth/signup',{body:{username:'new_scout',password:'NewScoutPass2026!'}});
  const joined=await request('/auth/join-team',{cookie:signup.cookie,body:{number:'6390',password:'QA6390'}});assert.equal(joined.status,200);
  assert.equal((await request('/preferences?team_id=qa-workspace',{cookie:signup.cookie})).data.onboarding_eligible,true);
  await request('/preferences',{cookie:signup.cookie,method:'PATCH',body:{team_id:'qa-workspace',guide_dismissed:true}});
  assert.equal((await request('/preferences?team_id=qa-workspace',{cookie:signup.cookie})).data.onboarding_eligible,false);
  await request('/auth/join-team',{cookie:signup.cookie,body:{number:'42',password:'OTHER42'}});
  assert.equal((await request('/preferences?team_id=qa-other',{cookie:signup.cookie})).data.onboarding_eligible,false);
  const stored=JSON.parse(fs.readFileSync(fixture.dbFile,'utf8'));assert.ok(stored.submissions.some(report=>report.id==='qa-private'));assert.equal(stored.submissions.length,8);
 }finally{server.kill();await new Promise(resolve=>server.exitCode!==null?resolve():server.once('exit',resolve));}
});
