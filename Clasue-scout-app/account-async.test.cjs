const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {registerAccountSecurity}=require('./account-security.cjs');

const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
function harness({verifyPassword=async()=>true,passwordHash=async()=> 'new-hash'}={}){
 let db={users:[{id:'owner',username:'owner',password_hash:'old-hash'}],teams:[{id:'team',owner_id:'owner'}],memberships:[{user_id:'owner',team_id:'team',username:'owner',role:'owner'}],submissions:[]},validSession=true;
 const handlers=new Map(),app={post:(paths,handler)=>{for(const path of Array.isArray(paths)?paths:[paths])handlers.set(path,handler);}};
 const sessions={get:()=>validSession?{userId:'owner',expires:Date.now()+10000}:null,revoke:()=>{validSession=false;}};
 registerAccountSecurity(app,{readDB:()=>structuredClone(db),writeDB:next=>{db=structuredClone(next);},verifyPassword,passwordHash,publicUser:user=>({id:user.id,username:user.username}),publicTeam:(_db,team)=>team,sessions,limit:{take:()=>true}});
 const run=(path,body)=>{const res={statusCode:200,status(code){this.statusCode=code;return this;},json(data){this.data=data;return this;}};const pending=handlers.get(path)({path,body,user:{id:'owner'},ip:'127.0.0.1',sessionToken:'cookie'},res);return{res,pending};};
 return{run,read:()=>db,change:fn=>fn(db),revoke:()=>{validSession=false;}};
}

test('reauthentication waits for password verification and keeps unrelated writes made while hashing',async()=>{
 const gate=deferred(),entered=deferred();const h=harness({verifyPassword:()=>{entered.resolve();return gate.promise;}});
 const call=h.run('/api/auth/change-username',{username:'renamed',current_password:'password'});await entered.promise;
 assert.equal(call.res.data,undefined,'No privileged mutation before password verification resolves');
 h.change(db=>db.submissions.push({id:'confirmed-during-hash'}));gate.resolve(true);await call.pending;
 assert.equal(call.res.statusCode,200);assert.deepEqual(h.read().submissions,[{id:'confirmed-during-hash'}]);assert.equal(h.read().users[0].username,'renamed');
});

test('session revocation or password changes during reauthentication block the pending account mutation',async()=>{
 for(const invalidate of [h=>h.revoke(),h=>h.change(db=>{db.users[0].password_hash='reset-hash';})]){
  const gate=deferred(),entered=deferred(),h=harness({verifyPassword:()=>{entered.resolve();return gate.promise;}});
  const call=h.run('/api/auth/rotate-join-code',{team_id:'team',current_password:'password'});await entered.promise;invalidate(h);gate.resolve(true);await call.pending;
  assert.equal(call.res.statusCode,401);assert.equal(h.read().teams[0].password,undefined);
 }
});

test('simultaneous recovery consumes a code once and preserves reports committed during hashing',async()=>{
 const code='a'.repeat(48),gates=[deferred(),deferred()];let count=0;
 const h=harness({passwordHash:()=>gates[count++].promise});h.change(db=>{db.users[0].recovery_hash=crypto.createHash('sha256').update(code).digest('hex');});
 const first=h.run('/api/auth/reset-password',{username:'owner',recovery_code:code,new_password:'first password'});
 const second=h.run('/api/auth/reset-password',{username:'owner',recovery_code:code,new_password:'second password'});
 assert.equal(count,2);h.change(db=>db.submissions.push({id:'saved-after-reset-start'}));gates[0].resolve('first-hash');await first.pending;gates[1].resolve('second-hash');await second.pending;
 assert.equal(first.res.statusCode,200);assert.equal(second.res.statusCode,401);assert.equal(h.read().users[0].password_hash,'first-hash');assert.equal(h.read().users[0].recovery_hash,undefined);assert.deepEqual(h.read().submissions,[{id:'saved-after-reset-start'}]);
});
