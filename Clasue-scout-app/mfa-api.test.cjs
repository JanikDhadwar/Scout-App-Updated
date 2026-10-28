const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const net=require('node:net');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {createFixture}=require('../scripts/qa-fixture.cjs');
const {hotp}=require('./mfa-service.cjs');

test('optional MFA enrolls, rotates the session and gates subsequent password logins',async()=>{
 const fixture=createFixture(),envFile=path.join(fixture.directory,'empty.env');fs.writeFileSync(envFile,'');
 const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const server=spawn(process.execPath,[path.join(__dirname,'server.cjs')],{env:{...process.env,DB_FILE:fixture.dbFile,ARGUS_ENV_FILE:envFile,APP_PORT:String(port),ARGUS_MFA_KEY:crypto.randomBytes(32).toString('base64'),NODE_ENV:'test'},stdio:'pipe'});
 const base=`http://127.0.0.1:${port}`,request=async(route,{body,cookie,method=body?'POST':'GET'}={})=>{const response=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
 try{
  for(let i=0;i<100;i++){try{if((await request('/api/health')).status===200)break;}catch{/* Disposable server is still starting. */}await new Promise(resolve=>setTimeout(resolve,20));}
  let login=await request('/api/auth/login',{body:{username:'qa_owner',password:'ArgusQA2026!'}});assert.equal(login.status,200);let cookie=login.cookie;
  const status=await request('/api/auth/mfa/status',{cookie});assert.deepEqual(status.data,{available:true,enrolled:false,recovery_codes_remaining:0});
  const start=await request('/api/auth/mfa/enroll/start',{cookie,body:{current_password:'ArgusQA2026!'}});assert.equal(start.status,200);
  const confirm=await request('/api/auth/mfa/enroll/confirm',{cookie,body:{enrollment_id:start.data.enrollment_id,code:hotp(start.data.secret,Math.floor(Date.now()/30000))}});assert.equal(confirm.status,200);assert.equal(confirm.data.recovery_codes.length,10);cookie=confirm.cookie;
  assert.equal((await request('/api/auth/me',{cookie})).status,200);
  await request('/api/auth/logout',{cookie,body:{}});
  login=await request('/api/auth/login',{body:{username:'qa_owner',password:'ArgusQA2026!'}});assert.equal(login.status,202);assert.equal(login.data.mfa_required,true);assert.equal(login.cookie,undefined);
  const verified=await request('/api/auth/mfa/verify',{body:{challenge_id:login.data.challenge_id,code:confirm.data.recovery_codes[0]}});assert.equal(verified.status,200);assert.ok(verified.cookie);
  const reused=await request('/api/auth/mfa/verify',{body:{challenge_id:login.data.challenge_id,code:confirm.data.recovery_codes[0]}});assert.equal(reused.status,401);
 }finally{server.kill();await new Promise(resolve=>server.once('exit',resolve));}
});
