const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');
const {createFixture}=require('../scripts/qa-fixture.cjs');

test('malformed requests have server-generated correlation IDs and never log raw body, cookies or caller IDs',async()=>{
 const fixture=createFixture(),envFile=path.join(fixture.directory,'isolated.env');fs.writeFileSync(envFile,'');
 const reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const server=spawn(process.execPath,[path.join(__dirname,'server.cjs')],{env:{...process.env,DB_FILE:fixture.dbFile,ARGUS_ENV_FILE:envFile,APP_PORT:String(port),TBA_API_KEY:'',GROQ_API_KEY:'',MATCH13_API_KEY:''},stdio:'pipe',windowsHide:true});
 let logs='';server.stderr.on('data',b=>{logs+=b;});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.once('error',reject);});
  const response=await fetch(`http://127.0.0.1:${port}/api/auth/login?secret=private-query`,{method:'POST',headers:{'Content-Type':'application/json','X-Request-ID':'caller-secret-id',Cookie:'argus_session=private-cookie'},body:'private-body-secret'});
  assert.equal(response.status,400);const id=response.headers.get('x-request-id');assert.match(id||'',/^[a-f0-9-]{36}$/);assert.notEqual(id,'caller-secret-id');
  assert.deepEqual(await response.json(),{error:'Invalid JSON request.'});
  const deadline=Date.now()+1000;while(!logs.includes(id)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
  assert.ok(logs.includes(id),'Support can correlate a failed request');
  for(const secret of ['private-body-secret','private-cookie','private-query','caller-secret-id'])assert.ok(!logs.includes(secret),secret);
  const event=logs.trim().split('\n').map(line=>JSON.parse(line)).find(value=>value.requestId===id);
  assert.equal(event.event,'request.failed');assert.equal(event.status,400);assert.equal(event.category,'invalid_json');
  const another=await fetch(`http://127.0.0.1:${port}/api/health`);assert.equal(another.status,200);assert.notEqual(another.headers.get('x-request-id'),id);
 }finally{server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));}
});
