const test=require('node:test');
const assert=require('node:assert/strict');
const {createAdmissionPolicy}=require('./admission-policy.cjs');
const fs=require('node:fs');const path=require('node:path');const net=require('node:net');const {spawn}=require('node:child_process');
const {createFixture}=require('../scripts/qa-fixture.cjs');

async function withServer(settings,run){
 const fixture=createFixture(),envFile=path.join(fixture.directory,'isolated.env');fs.writeFileSync(envFile,'');
 const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 const server=spawn(process.execPath,[path.join(__dirname,'server.cjs')],{env:{...process.env,DB_FILE:fixture.dbFile,ARGUS_ENV_FILE:envFile,APP_PORT:String(port),ARGUS_SIGNUP_ENABLED:'true',ARGUS_TEAM_CREATION_ENABLED:'true',ARGUS_MAX_USERS:'',ARGUS_MAX_TEAMS:'',...settings},stdio:'pipe',windowsHide:true});
 const base=`http://127.0.0.1:${port}`;
 try{await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Startup timeout')),10000);server.stdout.once('data',()=>{clearTimeout(timer);r();});server.once('error',j);});await run(base,fixture);}
 finally{server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));}
}

test('admission controls preserve default behavior and can pause only new registration or new workspaces',()=>{
 const open=createAdmissionPolicy({});assert.equal(open.signup({users:[]}),null);assert.equal(open.createTeam({teams:[]}),null);
 const paused=createAdmissionPolicy({ARGUS_SIGNUP_ENABLED:'false',ARGUS_TEAM_CREATION_ENABLED:'false'});
 assert.match(paused.signup({users:[]}),/registration.*paused/i);assert.match(paused.createTeam({teams:[]}),/workspace.*paused/i);
 const limited=createAdmissionPolicy({ARGUS_MAX_USERS:'2',ARGUS_MAX_TEAMS:'1'});
 assert.equal(limited.signup({users:[{}]}),null);assert.match(limited.signup({users:[{},{}]}),/capacity/i);
 assert.match(limited.createTeam({teams:[{archived_at:'retained'}]}),/capacity/i,'Archived data still consumes retained capacity');
});

test('invalid admission settings fail startup instead of silently changing policy',()=>{
 for(const env of [{ARGUS_SIGNUP_ENABLED:'maybe'},{ARGUS_TEAM_CREATION_ENABLED:'0'},{ARGUS_MAX_USERS:'0'},{ARGUS_MAX_USERS:'1.5'},{ARGUS_MAX_TEAMS:'-1'},{ARGUS_MAX_TEAMS:'100000000000000000000'}])assert.throws(()=>createAdmissionPolicy(env),/ARGUS_/);
});

test('server admission pause leaves existing sign-in, team join and report upload available',async()=>withServer({ARGUS_SIGNUP_ENABLED:'false',ARGUS_TEAM_CREATION_ENABLED:'false'},async(base,fixture)=>{
 const post=(route,body,cookie)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 assert.equal((await post('/api/auth/signup',{username:'paused',password:'StrongPassword!'})).status,503);
 const login=await post('/api/auth/login',{username:fixture.username,password:fixture.password});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await post('/api/auth/create-team',{number:'12345',name:'Paused'},cookie)).status,503);
 assert.equal((await post('/api/auth/join-team',{number:'6390',password:'QA6390'},cookie)).status,200);
 assert.equal((await post('/api/submissions',{id:'admission-existing-upload',team_id:'qa-workspace',user_id:'qa-owner',submitted_by:'qa_owner',form_id:'qa-pit-form',event_key:'2026qa',report_kind:'pit',scouted_team:'254',answers:{notes:'Synthetic existing-user report'}},cookie)).status,200);
 const db=JSON.parse(fs.readFileSync(fixture.dbFile));assert.equal(db.users.length,5);assert.equal(db.teams.length,2);assert.ok(db.submissions.some(r=>r.id==='admission-existing-upload'));
}));

test('concurrent signup cannot exceed the configured retained-user cap',async()=>withServer({ARGUS_MAX_USERS:'6'},async(base,fixture)=>{
 const results=await Promise.all(['cap-one','cap-two'].map(username=>fetch(base+'/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'StrongPassword!'})})));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,503]);assert.equal(JSON.parse(fs.readFileSync(fixture.dbFile)).users.length,6);
}));
