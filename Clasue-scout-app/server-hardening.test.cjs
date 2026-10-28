const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {createFixture}=require('../scripts/qa-fixture.cjs');

test('auth bodies are bounded, errors are safe JSON and concurrent signup preserves every committed user',async()=>{
 const fixture=createFixture(),reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const envFile=path.join(fixture.directory,'isolated.env');fs.writeFileSync(envFile,'');fs.writeFileSync(path.join(fixture.directory,'argus.env'),'ARGUS_TRUST_PROXY=not-a-trusted-proxy\n');
 const server=spawn(process.execPath,[path.join(__dirname,'server.cjs')],{env:{...process.env,ARGUS_ENV_FILE:envFile,DB_FILE:fixture.dbFile,APP_PORT:String(port)},stdio:'pipe',windowsHide:true});
 const base=`http://127.0.0.1:${port}`;
 const send=(route,body)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Startup timeout')),10000);server.stdout.once('data',()=>{clearTimeout(timer);r();});server.once('error',j);});
  const huge=await send('/api/auth/signup',{username:'oversized',password:'secret password',unused:'x'.repeat(17000)});
  assert.equal(huge.status,413);assert.deepEqual(await huge.json(),{error:'Request is too large.'});
  const malformed=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"broken":'});
  assert.equal(malformed.status,400);assert.deepEqual(await malformed.json(),{error:'Invalid JSON request.'});
  const before=JSON.parse(fs.readFileSync(fixture.dbFile));
  const results=await Promise.all(Array.from({length:6},(_,n)=>send('/api/auth/signup',{username:`concurrent-${n}`,password:'LongEnough2026!'})));
  assert.deepEqual(results.map(r=>r.status),[200,200,200,200,200,200]);
  const after=JSON.parse(fs.readFileSync(fixture.dbFile));assert.equal(after.users.length,before.users.length+6);assert.deepEqual(after.submissions,before.submissions);
  const dupe=await Promise.all([send('/api/auth/signup',{username:'same-name',password:'LongEnough2026!'}),send('/api/auth/signup',{username:'SAME-NAME',password:'LongEnough2026!'})]);
  assert.deepEqual(dupe.map(r=>r.status).sort(),[200,409]);
  const health=await fetch(base+'/api/health');assert.equal(health.headers.get('x-content-type-options'),'nosniff');assert.equal(health.headers.get('permissions-policy'),'geolocation=(), microphone=()');
  assert.match(health.headers.get('content-security-policy')||'',/object-src 'none'/);assert.match(health.headers.get('content-security-policy')||'',/script-src 'self'/);
  assert.equal(health.headers.get('strict-transport-security'),null,'Plain HTTP development must not set HSTS');
  const login=await send('/api/auth/login',{username:fixture.username,password:fixture.password}),cookie=login.headers.get('set-cookie').split(';')[0];
  const authorized=(route,body)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
  assert.equal((await authorized('/api/auth/transfer-ownership',{team_id:'qa-workspace',user_id:'qa-member',password:'incorrect'})).status,403);
  assert.equal((await authorized('/api/auth/change-username',{username:'renamed owner',current_password:fixture.password})).status,200);
  const original=before.submissions.find(r=>r.id==='qa-zero');
  const retried=await authorized('/api/submissions',original);assert.equal(retried.status,200,'Lost-ack retry survives username changes');assert.deepEqual(await retried.json(),original);
  assert.equal((await authorized('/api/submissions',{...original,answers:{auto:900}})).status,409,'Renaming does not allow same-ID report replacement');
 }finally{server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));}
});
