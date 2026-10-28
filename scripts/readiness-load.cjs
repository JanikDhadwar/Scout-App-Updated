// Disposable local workload only. No custom URL, database, credentials, or output
// path is accepted, so a copied command cannot stress a production server.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');
const {performance}=require('node:perf_hooks');
const {fixture}=require('./qa-fixture.cjs');
const appDirectory=path.resolve(__dirname,'../Clasue-scout-app');

function settings(options){
 const defaults={teams:8,scoutsPerTeam:3,reportsPerScout:12,seedReports:100,concurrency:8};
 for(const key of Object.keys(options))if(!Object.hasOwn(defaults,key))throw Error(`Unsupported option: ${key}`);
 const limits={teams:[2,100],scoutsPerTeam:[1,20],reportsPerScout:[1,200],seedReports:[0,10000],concurrency:[1,32]};
 const result={...defaults,...options};
 for(const [key,value]of Object.entries(result))if(!Number.isInteger(value)||value<limits[key][0]||value>limits[key][1])throw Error(`${key} must be an integer in range ${limits[key].join(' to ')}.`);
 if(result.teams*result.scoutsPerTeam>1000||result.teams*result.seedReports>100000||result.teams*result.scoutsPerTeam*result.reportsPerScout>20000)throw Error('Workload exceeds the bounded local option range.');
 return result;
}
function seed(config){
 const db=fixture(),baseUser=db.users[0];
 for(const key of Object.keys(db))if(Array.isArray(db[key]))db[key]=[];
 db.qa_fixture=true;db.readiness_fixture=true;db.unknown_legacy_field={preserve:true};
 const clients=[];
 for(let t=0;t<config.teams;t++){
  const teamId=`load-team-${t}`,eventKey=`2026load${t}`,formId=`load-form-${t}`;
  const ownerId=`load-user-${t}-0`;
  db.teams.push({id:teamId,number:String(10000+t),name:`Synthetic team ${t}`,owner_id:ownerId,password:`TEST-${t}-NOT-LIVE`,active_event_id:`load-event-${t}`});
  const questions=[{id:'count',text:'Observed pieces',type:'number'},{id:'note',text:'Synthetic note',type:'text'}];
  db.forms.push({id:formId,team_id:teamId,title:'Synthetic pit report',kind:'pit',allow_team_select:true,questions});
  db.scout_events.push({id:`load-event-${t}`,team_id:teamId,event_key:eventKey,event_name:'Synthetic load event',event_teams:[],matches:[]});
  for(let s=0;s<config.scoutsPerTeam;s++){
   const id=`load-user-${t}-${s}`,username=`load_${t}_${s}`;
   db.users.push({...baseUser,id,username});
   db.memberships.push({id:`load-member-${t}-${s}`,team_id:teamId,user_id:id,username,role:s===0?'owner':'member'});
   clients.push({id,username,teamId,eventKey,formId,questions,t,s});
  }
  for(let n=0;n<config.seedReports;n++)db.submissions.push({id:`seed-${t}-${n}`,team_id:teamId,user_id:ownerId,submitted_by:`load_${t}_0`,form_id:formId,report_kind:'pit',scouted_team:String(1+n%128),event_key:eventKey,questions_snapshot:questions,answers:{count:n%20,note:'Synthetic retained report'},created_at:'2026-01-01T00:00:00.000Z'});
 }
 return {db,clients};
}
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)]:null;
async function pool(items,concurrency,run){let next=0;await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{while(next<items.length){const index=next++;await run(items[index],index);}}));}
async function runReadinessLoad(options={}){
 const config=settings(options),{db,clients}=seed(config);
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'argus-readiness-load-'));
 const dbFile=path.join(directory,'db.json'),envFile=path.join(directory,'argus-test.env');
 fs.writeFileSync(dbFile,JSON.stringify(db),{mode:0o600});fs.writeFileSync(envFile,'',{mode:0o600});
 const reservation=net.createServer();
 await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve);});
 const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const baseURL=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,[path.join(appDirectory,'server.cjs')],{cwd:appDirectory,windowsHide:true,env:{...process.env,NODE_ENV:'test',APP_PORT:String(port),DB_FILE:dbFile,ARGUS_ENV_FILE:envFile,ARGUS_TRUST_PROXY:'',COOKIE_SECURE:'false',TBA_API_KEY:'',GROQ_API_KEY:'',MATCH13_API_KEY:''},stdio:['ignore','pipe','pipe']});
 let serverLog='',spawnError;
 server.stdout.on('data',b=>{serverLog+=b;});server.stderr.on('data',b=>{serverLog+=b;});server.on('error',e=>{spawnError=e;});
 const stopped=new Promise(resolve=>server.once('exit',resolve));
 const timings={},statuses={},errors=[];
 let result;
 const request=async(label,route,{method='GET',body,cookie}={})=>{
  const start=performance.now();
  const response=await fetch(baseURL+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}
  (timings[label]??=[]).push(performance.now()-start);statuses[response.status]=(statuses[response.status]||0)+1;
  return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 };
 const expect=(condition,message)=>{if(!condition)throw Error(message);};
 try{
  const deadline=Date.now()+15000;let ready=false;
  while(Date.now()<deadline){
   if(spawnError)throw spawnError;if(server.exitCode!==null)throw Error('Disposable server exited before readiness.');
   try{const r=await fetch(baseURL+'/api/health',{signal:AbortSignal.timeout(500)});if(r.ok){ready=true;break;}}catch{/* Await only this disposable process. */}
   await new Promise(resolve=>setTimeout(resolve,50));
  }
  expect(ready,'Disposable server did not become ready.');
  // Login setup is measured separately from the report/reconnect workload.
  await pool(clients,Math.min(config.concurrency,4),async client=>{
   const login=await request('login','/api/auth/login',{method:'POST',body:{username:client.username,password:'ArgusQA2026!'}});
   expect(login.status===200&&login.cookie,`Synthetic login failed (${login.status}).`);client.cookie=login.cookie;
  });
  const reports=clients.flatMap(client=>Array.from({length:config.reportsPerScout},(_,n)=>({client,body:{id:`upload-${client.t}-${client.s}-${n}`,team_id:client.teamId,user_id:client.id,submitted_by:client.username,form_id:client.formId,form_title:'Synthetic pit report',report_kind:'pit',scouted_team:String(1+n%128),event_key:client.eventKey,questions_snapshot:client.questions,answers:{count:n%20,note:'Synthetic reconnect queue'},created_at:'2026-01-01T00:00:00.000Z'}})));
  const started=performance.now();
  await pool(reports,config.concurrency,async({client,body},index)=>{
   try{
    const saved=await request('report','/api/submissions',{method:'POST',body,cookie:client.cookie});expect(saved.status===200&&saved.data.id===body.id,`Report acknowledgement failed (${saved.status}).`);
    if(index%4===0){const revision=await request('revision',`/api/live/revision?workspaceId=${client.teamId}`,{cookie:client.cookie});expect(revision.status===200&&typeof revision.data.revision==='string','Scoped revision polling failed.');}
    if(index%8===0){const health=await request('health','/api/health');expect(health.status===200,'Health request failed during writes.');}
   }catch(error){errors.push(error.message);}
  });
  const durationMs=performance.now()-started;
  let crossTeamLeaks=0,identicalRetriesConfirmed=0,conflictsRejected=0;
  for(const client of clients){
   const own=await request('scopedRead','/api/submissions',{cookie:client.cookie});
   expect(own.status===200&&Array.isArray(own.data),'Scoped report read failed.');
   crossTeamLeaks+=own.data.filter(row=>row.team_id!==client.teamId).length;
   const foreign=`load-team-${(client.t+1)%config.teams}`;
   const forbidden=await request('foreignRevision',`/api/live/revision?workspaceId=${foreign}`,{cookie:client.cookie});expect(forbidden.status===403,'Foreign revision was not rejected.');
   const foreignBody={...reports.find(r=>r.client===client).body,id:`foreign-${client.id}`,team_id:foreign};
   const rejected=await request('foreignWrite','/api/submissions',{method:'POST',body:foreignBody,cookie:client.cookie});expect(rejected.status===403,'Foreign write was not rejected.');
   const body=reports.find(r=>r.client===client).body;
   const retry=await request('identicalRetry','/api/submissions',{method:'POST',body,cookie:client.cookie});expect(retry.status===200,'Identical lost-ack retry failed.');identicalRetriesConfirmed++;
   const conflict=await request('conflictingRetry','/api/submissions',{method:'POST',body:{...body,answers:{count:999}},cookie:client.cookie});expect(conflict.status===409,'Conflicting retry replaced an immutable report.');conflictsRejected++;
  }
  const actual=JSON.parse(fs.readFileSync(dbFile,'utf8')),ids=actual.submissions.map(r=>r.id),expectedReports=db.submissions.length+reports.length;
  expect(actual.submissions.length===expectedReports,'Acknowledgement/record counts disagree.');
  expect(new Set(ids).size===ids.length,'Duplicate submission IDs found.');expect(crossTeamLeaks===0,'Cross-team report leak found.');
  expect(actual.unknown_legacy_field?.preserve===true,'Unknown legacy data was lost.');
  for(const {body}of reports){const row=actual.submissions.find(r=>r.id===body.id);expect(row&&JSON.stringify(row.answers)===JSON.stringify(body.answers),'Acknowledged report payload changed or disappeared.');}
  result={generatedAt:new Date().toISOString(),version:require('../Clasue-scout-app/package.json').version,environment:{synthetic:true,baseURL,node:process.version,platform:process.platform,architecture:process.arch,databaseBytes:fs.statSync(dbFile).size},workload:{...config,clients:clients.length,seededReports:db.submissions.length,newReports:reports.length,writePhaseMs:Math.round(durationMs),confirmedReportsPerSecond:Number((reports.length/(durationMs/1000)).toFixed(2))},latencyMs:Object.fromEntries(Object.entries(timings).map(([key,values])=>[key,{requests:values.length,p50:Number(percentile(values,.5).toFixed(2)),p95:Number(percentile(values,.95).toFixed(2)),p99:Number(percentile(values,.99).toFixed(2)),max:Number(Math.max(...values).toFixed(2))}])),statuses,integrity:{expectedReports,actualReports:actual.submissions.length,duplicateIds:ids.length-new Set(ids).size,crossTeamLeaks,identicalRetriesConfirmed,conflictsRejected,unknownLegacyPreserved:true},errors,limitations:['Short synthetic localhost run; no production capacity, internet latency, event-day soak, physical-device, media-volume, resource-usage, or legal readiness claim.','Intended 403/409 responses are negative checks, not service failures. Login is measured separately.','Retained fixtures and logs are synthetic. Never substitute a production target or private DB.']};
  result.artifactFile=path.join(directory,'result.json');fs.writeFileSync(result.artifactFile,JSON.stringify(result,null,2));
  return result;
 }finally{
  server.kill();await stopped;fs.writeFileSync(path.join(directory,'server.log'),serverLog);
 }
}
module.exports={runReadinessLoad};
if(require.main===module){
 const options={};
 try{for(const arg of process.argv.slice(2)){const match=/^--(teams|scoutsPerTeam|reportsPerScout|seedReports|concurrency)=(\d+)$/.exec(arg);if(!match)throw Error(`Unsupported option: ${arg}`);options[match[1]]=Number(match[2]);}}
 catch(error){console.error(error.message);process.exitCode=1;}
 if(!process.exitCode)runReadinessLoad(options).then(result=>{console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
