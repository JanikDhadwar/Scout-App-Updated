const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const APP_VERSION = require('./package.json').version;
// Keep local integration credentials outside source and browser build files.
const privateEnv = process.env.ARGUS_ENV_FILE || (process.env.DB_FILE ? path.join(path.dirname(path.resolve(process.env.DB_FILE)), 'argus.env') : null);
for (const file of [privateEnv,path.join(__dirname,'.env')].filter(Boolean)) if(fs.existsSync(file))process.loadEnvFile(file);
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { askGroq, DEFAULT_MODEL } = require('./analyst-service.cjs');
const { createIntegrationStore } = require('./integration-store.cjs');
const { checkConnections } = require('./connection-check.cjs');
const { generateAssignments, submissionError } = require('./scouting-rules.cjs');
const {activeEvent,previewTransition,applyTransition}=require('./event-transition.cjs');
const app = express();
app.disable('x-powered-by');
app.disable('etag');
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'db.json');
const DIST_DIR = path.join(__dirname, 'dist');
const integrations=createIntegrationStore(path.join(path.dirname(DB_FILE),'argus-integrations.private.json'));
function integrationKey(req,name,workspaceId=req.headers['x-argus-workspace']){return (typeof workspaceId==='string'&&membership(readDB(),req.user.id,workspaceId)?integrations.key(workspaceId,name):undefined)||process.env[name];}
const STORES = ['users','teams','memberships','forms','submissions','announcements','scout_events','pit_scouts','assignments','picklists'];
const sessions = new Map(), attempts = new Map();
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
function readDB() {
  if (!fs.existsSync(DB_FILE)) return { ...Object.fromEntries(STORES.map(s=>[s,[]])), session:{} };
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDB(db) {
  fs.mkdirSync(path.dirname(DB_FILE), {recursive:true});
  fs.writeFileSync(`${DB_FILE}.tmp`, JSON.stringify(db,null,2), {mode:0o600});
  fs.renameSync(`${DB_FILE}.tmp`, DB_FILE);
}
function rows(db, store) { return Array.isArray(db[store]) ? db[store] : []; }
function publicUser(u) { return {id:u.id, username:u.username, created_at:u.created_at}; }
function legacyHash(s) {let h=0; for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return h.toString(16);}
function passwordHash(password) {const salt=crypto.randomBytes(16).toString('hex'); return `scrypt$${salt}$${crypto.scryptSync(password,salt,64).toString('hex')}`;}
function equal(a,b) {const x=Buffer.from(String(a)), y=Buffer.from(String(b));return x.length===y.length && crypto.timingSafeEqual(x,y);}
function verifyPassword(password, hash) {
  if(typeof hash!=='string')return false;
  if(!hash.startsWith('scrypt$')) return equal(legacyHash(password),hash);
  const [,salt,digest]=hash.split('$');
  return !!salt && !!digest && equal(crypto.scryptSync(password,salt,64).toString('hex'),digest);
}
function membership(db, uid, tid) {return rows(db,'memberships').find(m=>m.user_id===uid && m.team_id===tid);}
function role(db,uid,tid) {return membership(db,uid,tid)?.role;}
function admin(db,uid,tid) {return ['owner','admin'].includes(role(db,uid,tid));}
function publicTeam(db,t,uid) {const {password,password_hash,...safe}=t;safe.active_event_id=activeEvent(db,t.id)?.id||null;if(role(db,uid,t.id)==='owner' && password)safe.password=password;return safe;}
function fail(res,status,message) {return res.status(status).json({error:message});}
function login(req,res,u) {
  if(req.authAttemptKey)attempts.delete(req.authAttemptKey);
  const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{userId:u.id,expires:Date.now()+7*86400000});
  res.cookie('argus_session',token,{httpOnly:true,sameSite:'strict',secure:req.secure || process.env.COOKIE_SECURE==='true',maxAge:7*86400000,path:'/'});
  return res.json(publicUser(u));
}
app.use((_req,res,next)=>{res.set({'Cache-Control':'no-store, max-age=0','CDN-Cache-Control':'no-store','Cloudflare-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin'});next();});
app.use(express.json({limit:'10mb'}));
app.use('/api',(req,res,next)=>{
  res.set('Cache-Control','no-store');
  // SameSite plus an origin check prevents writes through cross-origin browser requests.
  if(!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin) {
    try {if(new URL(req.headers.origin).host!==req.headers.host)return fail(res,403,'Cross-origin writes are not allowed');}catch{return fail(res,403,'Invalid origin');}
  }
  next();
});
app.get('/api/release',(_req,res)=>{try{const value=JSON.parse(fs.readFileSync(path.join(DIST_DIR,'release.json'),'utf8'));if(typeof value.buildId!=='string'||!/^[-a-zA-Z0-9]{1,100}$/.test(value.buildId))throw Error();res.json({version:value.version||null,buildId:value.buildId});}catch{fail(res,503,'Build version is unavailable.');}});
app.get('/api/health',(_req,res)=>{readDB();const ok=process.env.NODE_ENV!=='production'||fs.existsSync(path.join(DIST_DIR,'index.html'));res.status(ok?200:503).json({ok,version:APP_VERSION,release:path.basename(path.dirname(__dirname))});});
app.use('/api',(req,res,next)=>{
  const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('argus_session='))?.slice(14);
  const session=sessions.get(token);
  if(session && session.expires>Date.now())req.user=rows(readDB(),'users').find(u=>u.id===session.userId && !u.disabled && !u.disabled_at);
  else if(token)sessions.delete(token);
  req.sessionToken=token;next();
});
app.post(['/api/auth/login','/api/auth/signup'],(req,res)=>{
  const now=Date.now(),ip=`${req.ip}:${typeof req.body?.username==='string'?req.body.username.trim().toLowerCase().slice(0,80):''}`;
  req.authAttemptKey=ip;
  if(attempts.size>10000)for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
  const bucket=attempts.get(ip);if(bucket?.until>now && bucket.count>=20)return fail(res,429,'Too many attempts. Try again in 15 minutes.');
  attempts.set(ip,{count:bucket?.until>now?bucket.count+1:1,until:bucket?.until>now?bucket.until:now+900000});
  const {username,password}=req.body||{};
  if(typeof username!=='string'||!username.trim()||username.length>80||typeof password!=='string'||password.length>1024||!password.trim())return fail(res,400,'Username and password are required');
  const db=readDB(),found=rows(db,'users').find(u=>typeof u?.username==='string'&&u.username.toLowerCase()===username.trim().toLowerCase());
  if(req.path.endsWith('/signup')) {
    if(found)return fail(res,409,'Username is already registered');
    if(password.length<8)return fail(res,400,'Use at least 8 characters for your password');
    const user={id:crypto.randomUUID(),username:username.trim(),password_hash:passwordHash(password),created_at:new Date().toISOString()};
    db.users=[...rows(db,'users'),user];writeDB(db);return login(req,res,user);
  }
  if(!found||found.disabled||found.disabled_at||!verifyPassword(password,found.password_hash))return fail(res,401,'Invalid username or password');
  if(!found.password_hash.startsWith('scrypt$')){found.password_hash=passwordHash(password);writeDB(db);}
  return login(req,res,found);
});
app.use('/api',(req,res,next)=>req.user?next():fail(res,401,'Sign in required'));
app.get('/api/auth/me',(req,res)=>res.json(publicUser(req.user)));
app.post('/api/auth/logout',(req,res)=>{sessions.delete(req.sessionToken);res.clearCookie('argus_session',{path:'/',httpOnly:true,sameSite:'strict'});res.json({ok:true});});
app.post('/api/auth/create-team',(req,res)=>{
  const {number,name,password}=req.body||{};
  if(!/^\d{1,6}$/.test(String(number))||typeof name!=='string'||!name.trim()||name.length>120)return fail(res,400,'A team number and name are required');
  const db=readDB();if(rows(db,'teams').some(t=>String(t.number)===String(number)))return fail(res,409,'Team number is already registered');
  const joinPassword=typeof password==='string'&&password.trim()?password.trim().toUpperCase():crypto.randomBytes(6).toString('hex').toUpperCase();
  const team={id:crypto.randomUUID(),number:String(number),name:name.trim(),password:joinPassword,owner_id:req.user.id,created_at:new Date().toISOString()};
  const mem={id:crypto.randomUUID(),team_id:team.id,user_id:req.user.id,username:req.user.username,role:'owner'};
  db.teams=[...rows(db,'teams'),team];db.memberships=[...rows(db,'memberships'),mem];writeDB(db);res.json({team,mem});
});
app.post('/api/auth/join-team',(req,res)=>{
  const {number,password}=req.body||{},db=readDB();
  const team=rows(db,'teams').find(t=>String(t.number)===String(number));
  if(!team||typeof password!=='string'||!equal(password.trim().toUpperCase(),team.password))return fail(res,403,'Invalid team number or join password');
  let mem=membership(db,req.user.id,team.id);
  if(!mem){mem={id:crypto.randomUUID(),team_id:team.id,user_id:req.user.id,username:req.user.username,role:'member'};db.memberships=[...rows(db,'memberships'),mem];writeDB(db);}
  const {password:secret,...safe}=team;res.json({team:safe,mem});
});
app.post(['/api/auth/archive-team','/api/auth/restore-team'],(req,res)=>{
  const {team_id}=req.body||{},db=readDB();
  if(role(db,req.user.id,team_id)!=='owner')return fail(res,403,'Owner permission required');
  const team=rows(db,'teams').find(t=>t.id===team_id);if(!team)return fail(res,404,'Workspace not found');
  team.archived_at=req.path.endsWith('/restore-team')?null:new Date().toISOString();writeDB(db);res.json({team:publicTeam(db,team,req.user.id)});
});
app.post('/api/auth/deactivate-account',(req,res)=>{
  const db=readDB();
  if(rows(db,'teams').some(t=>t.owner_id===req.user.id&&!t.archived_at))return fail(res,409,'Transfer ownership or archive your active workspaces before deactivating your account');
  rows(db,'users').find(u=>u.id===req.user.id).disabled_at=new Date().toISOString();
  db.memberships=rows(db,'memberships').filter(m=>m.user_id!==req.user.id);
  writeDB(db);for(const [token,session] of sessions)if(session.userId===req.user.id)sessions.delete(token);
  res.clearCookie('argus_session',{path:'/',httpOnly:true,sameSite:'strict'});res.json({ok:true});
});
app.post('/api/auth/transfer-ownership',(req,res)=>{
  const {team_id,user_id}=req.body||{},db=readDB();
  if(role(db,req.user.id,team_id)!=='owner')return fail(res,403,'Owner permission required');
  const target=membership(db,user_id,team_id);if(!target)return fail(res,400,'Choose a member of this team');
  membership(db,req.user.id,team_id).role='admin';target.role='owner';rows(db,'teams').find(t=>t.id===team_id).owner_id=user_id;
  writeDB(db);res.json({ok:true});
});
app.get('/api/integrations/status',(req,res)=>{const {workspaceId}=req.query;if(typeof workspaceId!=='string'||!membership(readDB(),req.user.id,workspaceId))return fail(res,403,'Workspace permission required');res.json({tbaConfigured:!!integrationKey(req,'TBA_API_KEY',workspaceId),groqConfigured:!!integrationKey(req,'GROQ_API_KEY',workspaceId)});});
app.post('/api/integrations/configure',(req,res)=>{const {workspaceId,...values}=req.body||{};if(typeof workspaceId!=='string'||role(readDB(),req.user.id,workspaceId)!=='owner')return fail(res,403,'Workspace owner permission required');try{res.json(integrations.save(workspaceId,values));}catch{fail(res,400,'Could not save private settings. Check the key format and server storage permissions.');}});
const connectionChecks=new Map();
app.post('/api/integrations/check',async(req,res)=>{
  const {workspaceId}=req.body||{};
  if(typeof workspaceId!=='string'||!membership(readDB(),req.user.id,workspaceId))return fail(res,403,'Workspace permission required');
  const bucket=`${req.user.id}:${workspaceId}`,now=Date.now();
  if(connectionChecks.get(bucket)>now-30000)return fail(res,429,'Wait 30 seconds before checking again.');
  if(connectionChecks.size>1000)for(const [key,time]of connectionChecks)if(time<now-30000)connectionChecks.delete(key);
  connectionChecks.set(bucket,now);
  res.json(await checkConnections({tbaKey:integrationKey(req,'TBA_API_KEY',workspaceId),groqKey:integrationKey(req,'GROQ_API_KEY',workspaceId),model:integrationKey(req,'GROQ_MODEL',workspaceId)||DEFAULT_MODEL}));
});
const analystRequests=new Map();
app.get('/api/analyst/status',(_req,res)=>res.json({provider:'groq',configured:!!integrationKey(_req,'GROQ_API_KEY'),model:integrationKey(_req,'GROQ_MODEL')||DEFAULT_MODEL}));
app.post('/api/analyst/ask',async(req,res)=>{
  const {workspaceId,eventKey,question}=req.body||{};
  if(typeof workspaceId!=='string'||typeof eventKey!=='string'||typeof question!=='string'||!question.trim()||question.length>1000)return fail(res,400,'Choose a workspace and event, and enter a question under 1,000 characters.');
  const db=readDB();
  if(!membership(db,req.user.id,workspaceId))return fail(res,403,'Workspace permission required');
  const event=rows(db,'scout_events').find(row=>row.team_id===workspaceId&&row.event_key===eventKey);
  if(!event)return fail(res,404,'Select an event in this workspace.');
  if(!integrationKey(req,'GROQ_API_KEY',workspaceId))return fail(res,503,'The workspace owner can connect Groq in Settings. Import the private connection file or enter an API key.');
  const now=Date.now(),previous=analystRequests.get(req.user.id),count=previous?.until>now?previous.count:0;
  if(count>=10)return fail(res,429,'Wait a minute before asking Groq again. The local analyst is still available.');
  if(analystRequests.size>1000)for(const [id,bucket]of analystRequests)if(bucket.until<now)analystRequests.delete(id);
  analystRequests.set(req.user.id,{count:count+1,until:previous?.until>now?previous.until:now+60000});
  try{
    const {analyticsForData}=await import('./src/argus/analytics.js');
    const data={forms:rows(db,'forms').filter(row=>row.team_id===workspaceId),submissions:rows(db,'submissions').filter(row=>row.team_id===workspaceId&&visible(db,'submissions',row,req.user.id)),matches:event.matches||[]};
    const analytics=analyticsForData(data,{id:workspaceId},event);
    const answer=await askGroq({analytics,question:question.trim(),key:integrationKey(req,'GROQ_API_KEY',workspaceId),model:integrationKey(req,'GROQ_MODEL',workspaceId)||DEFAULT_MODEL});
    res.json(answer);
  }catch(error){return fail(res,502,error.name==='TimeoutError'?'Groq took too long. Try the local analyst.':error.message?.startsWith('Groq')?error.message:'The AI service could not answer. Try the local analyst.');}
});
app.get('/api/tba/*path',async(req,res)=>{
  const route=req.params.path.join('/');
  if(!/^(event\/\w+(?:\/(?:teams\/simple|matches(?:\/simple)?|rankings))?|events\/\d{4}\/simple|team\/frc\d+(?:\/simple|\/events\/\d{4}\/simple|\/event\/\w+\/status)?)$/.test(route))return fail(res,400,'Unsupported official data request');
  if(!integrationKey(req,'TBA_API_KEY'))return fail(res,503,'Official data needs an API key. Ask the workspace owner to connect event data in Settings.');
  try {const result=await fetch(`https://www.thebluealliance.com/api/v3/${route}`,{headers:{'X-TBA-Auth-Key':integrationKey(req,'TBA_API_KEY'),'User-Agent':'Argus-Scouting/2.0'},signal:AbortSignal.timeout(10000)});if(!result.ok)return fail(res,result.status===404?404:502,'Official data request failed');res.json(await result.json());}catch{return fail(res,502,'Official data is temporarily unreachable');}
});
app.get('/api/form-submission-counts/:formId',(req,res)=>{
  const db=readDB(),form=rows(db,'forms').find(row=>row.id===req.params.formId);
  if(!form||!membership(db,req.user.id,form.team_id))return fail(res,404,'Form not found');
  const counts={};for(const report of rows(db,'submissions'))if(report.team_id===form.team_id&&report.form_id===form.id&&(report.event_key||'')===(req.query.event_key||'')&&/^\d+$/.test(String(report.scouted_team)))counts[report.scouted_team]=(counts[report.scouted_team]||0)+1;
  res.json(counts);
});
app.post('/api/assignments/generate',(req,res)=>{
  const {event_id,report_kind,form_id,pit_form_id,match_form_id,assignment_revision}=req.body||{},db=readDB();
  const event=rows(db,'scout_events').find(row=>row.id===event_id);
  if(!event||!admin(db,req.user.id,event.team_id))return fail(res,403,'Administrator permission required for this event');
  if(event.archived_at)return fail(res,409,'Restore this event before generating assignments.');
  const activeTeam=rows(db,'teams').find(team=>team.id===event.team_id);
  if(activeTeam?.active_event_id&&activeTeam.active_event_id!==event.id)return fail(res,409,'Generate assignments for the active event only.');
  if(assignment_revision!==(event.assignment_revision||0))return fail(res,409,'Assignments changed. Refresh before generating again.');
  const scoutIds=req.body.scout_ids===undefined?rows(db,'memberships').filter(row=>row.team_id===event.team_id).map(row=>row.user_id):req.body.scout_ids;
  if(!['pit','match','both'].includes(report_kind)||!Array.isArray(scoutIds)||!scoutIds.length||scoutIds.some(id=>!membership(db,id,event.team_id)))return fail(res,400,'Select workspace scouts and a report type');
  const kinds=report_kind==='both'?['pit','match']:[report_kind];
  const plans=kinds.map(kind=>({kind,form:rows(db,'forms').find(row=>row.id===(report_kind==='both'?(kind==='pit'?pit_form_id:match_form_id):form_id)&&row.team_id===event.team_id&&!row.archived&&!row.archived_at&&(row.kind||'match')===kind)}));
  if(plans.some(plan=>!plan.form))return fail(res,400,'Choose an active form for each report type');
  if(plans.some(plan=>plan.kind==='pit')&&!event.event_teams?.length)return fail(res,400,'Download event teams before assigning pit scouting.');
  if(plans.some(plan=>plan.kind==='match')&&!event.matches?.length)return fail(res,400,'Download the match schedule before assigning match scouting.');
  try{
    const added=[],counts={};
    for(const plan of plans){const generated=generateAssignments({event,scoutIds,kind:plan.kind,formId:plan.form.id,existing:[...rows(db,'assignments'),...added]});added.push(...generated);counts[plan.kind]=generated.length;}
    db.assignments=[...rows(db,'assignments'),...added];event.excluded=rows(db,'memberships').filter(row=>row.team_id===event.team_id&&!scoutIds.includes(row.user_id)).map(row=>row.user_id);event.assignment_revision=(event.assignment_revision||0)+1;writeDB(db);
    res.json({added:added.length,counts,assignment_revision:event.assignment_revision});
  }catch(error){fail(res,400,error.message);}
});

app.get('/api/event-transition/preview',(req,res)=>{
 const {team_id,next_event_id}=req.query,db=readDB();
 if(!admin(db,req.user.id,team_id))return fail(res,403,'Team administrator permission required');
 try{res.json(previewTransition(db,team_id,next_event_id));}catch(error){fail(res,error.status||500,error.message);}
});
app.post('/api/event-transition',(req,res)=>{
 const {team_id,next_event_id,expected,delete_forms}=req.body||{},db=readDB();
 if(!admin(db,req.user.id,team_id))return fail(res,403,'Team administrator permission required');
 try{const result=applyTransition(db,{teamId:team_id,nextEventId:next_event_id,expected,deleteForms:delete_forms});writeDB(db);res.json({...result,team:publicTeam(db,result.team,req.user.id)});}catch(error){if(!error.status)throw error;fail(res,error.status,error.message);}
});
function visible(db,store,row,uid) {
  if(store==='users')return row.id===uid||rows(db,'memberships').some(m=>m.user_id===row.id&&membership(db,uid,m.team_id));
  const tid=store==='teams'?row.id:row.team_id;
  if(!membership(db,uid,tid))return false;
  return store!=='submissions'||row.user_id===uid||admin(db,uid,tid);
}
app.get('/api/:store{/:id}',(req,res)=>{
  const {store,id}=req.params;if(!STORES.includes(store))return fail(res,store==='session'?403:404,'Collection is unavailable');
  const db=readDB();let result=rows(db,store).filter(r=>visible(db,store,r,req.user.id));
  for(const [key,value]of Object.entries(req.query)){if(['password','password_hash'].includes(key))return fail(res,400,'Private field filters are not supported');result=result.filter(r=>String(r[key])===String(value));}
  result=result.map(r=>store==='users'?publicUser(r):store==='teams'?publicTeam(db,r,req.user.id):r);
  if(id){const row=result.find(r=>r.id===id);return row?res.json(row):fail(res,404,'Record not found');}res.json(result);
});
app.all('/api/:store{/:id}',(req,res,next)=>{
  if(!['POST','PATCH','DELETE'].includes(req.method))return next();
  const {store,id}=req.params;if(!STORES.includes(store)||store==='users')return fail(res,403,'Collection cannot be changed here');
  const body=req.body||{},db=readDB(),key=id||body.id;
  if(typeof key!=='string'||!key||key.length>200||['__proto__','prototype','constructor'].includes(key))return fail(res,400,'A valid record id is required');
  const original=rows(db,store).find(r=>r.id===key);
  if(id&&!original)return fail(res,404,'Record not found');
  if(req.method!=='DELETE'&&(typeof body!=='object'||Array.isArray(body)))return fail(res,400,'Expected a JSON object');
  const row={...(original||{}),...body,id:key};
  const tid=store==='teams'?key:row.team_id;
  if(original && !visible(db,store,original,req.user.id))return fail(res,403,'Permission denied');
  if(original && store!=='teams' && row.team_id!==original.team_id)return fail(res,400,'Workspace cannot be changed');
  if(!membership(db,req.user.id,tid))return fail(res,403,'Workspace permission required');
  if(['submissions','pit_scouts','assignments','picklists'].includes(store)&&req.method!=='DELETE'){
    if(rows(db,'scout_events').some(event=>event.team_id===tid&&event.event_key===row.event_key&&event.data_cleared_at))return fail(res,409,'This event was cleared. Your local report is preserved; export it from Device and sync.');
    if(store==='submissions'&&rows(db,'report_tombstones').some(report=>report.id===key&&report.team_id===tid))return fail(res,409,'This report ID belongs to a cleared event. Your local copy is preserved.');
    const team=rows(db,'teams').find(team=>team.id===tid),current=activeEvent(db,tid);
    if(team?.active_event_id&&row.event_key&&row.event_key!==current?.event_key)return fail(res,409,'Only the active event accepts new data. Your local copy is preserved.');
  }
  if(store==='submissions') {
    if(req.method!=='POST')return fail(res,409,'Reports are immutable. Preserve the original and submit a new correction.');
    if(row.user_id!==req.user.id)return fail(res,403,'Report identity must match your account');
    if(!rows(db,'forms').some(f=>f.id===row.form_id&&f.team_id===tid))return fail(res,400,'Choose a form in this workspace');
    row.submitted_by=req.user.username;
    if(original)return isDeepStrictEqual(original,{...body,submitted_by:req.user.username})?res.json(original):fail(res,409,'A different report already uses this ID. Your local copy is preserved.');
    const limitError=submissionError(rows(db,'forms').find(f=>f.id===row.form_id),row,rows(db,'submissions'));
    if(limitError)return fail(res,409,limitError);
  } else if(store==='pit_scouts') {
    if(row.user_id!==req.user.id&&!admin(db,req.user.id,tid))return fail(res,403,'Permission denied');
    if(original&&row.user_id!==original.user_id)return fail(res,400,'Scout identity cannot be changed');
  } else if(store==='memberships') {
    if(req.method==='DELETE'&&original?.user_id===req.user.id&&original.role!=='owner') { /* Members may leave. */ }
    else if(role(db,req.user.id,tid)!=='owner')return fail(res,403,'Owner permission required');
    if(!original)return fail(res,403,'Join a team through the join-team endpoint');
    if(row.user_id!==original.user_id||row.team_id!==original.team_id||row.username!==original.username)return fail(res,400,'Membership identity cannot be changed');
    if(original.role==='owner'||row.role==='owner')return fail(res,409,'Use transfer-ownership before changing the owner');
    if(!['admin','member'].includes(row.role))return fail(res,400,'Invalid role');
  } else if(store==='teams') {
    if(role(db,req.user.id,tid)!=='owner')return fail(res,403,'Owner permission required');
    if(req.method==='DELETE')return fail(res,409,'Team deletion would orphan scouting records. Archive the workspace instead.');
    if(!original||row.owner_id!==original.owner_id||row.number!==original.number)return fail(res,400,'Team identity cannot be changed');
    if(Object.hasOwn(body,'active_event_id')||Object.hasOwn(body,'event_transition'))return fail(res,409,'Use Change event to switch events and review outgoing data.');
  } else if(!admin(db,req.user.id,tid))return fail(res,403,'Administrator permission required');
  if(req.method==='DELETE'&&['forms','scout_events'].includes(store))return fail(res,409,'Archive this record instead. Scouting evidence and unfinished drafts must be retained.');
  if(store==='forms'&&req.method!=='DELETE'&&row.max_submissions_per_team!=null&&(!Number.isInteger(row.max_submissions_per_team)||row.max_submissions_per_team<1||!row.allow_team_select))return fail(res,400,'Submission limits require team selection and a positive whole number');
  if(store==='scout_events') {
    if(original?.data_cleared_at)return fail(res,409,'This event was cleared and cannot be changed.');
    if(Object.hasOwn(body,'data_cleared_at'))return fail(res,400,'Event clearing is managed by Change event.');
    if(original&&row.event_key!==original.event_key)return fail(res,409,'Use Change event instead of replacing an event key.');
    if(Object.hasOwn(body,'assignment_revision'))return fail(res,400,'Assignment revisions are managed by assignment writes');
    if(Object.hasOwn(body,'analytics_config')) {
      const expected=body.analytics_revision ?? 0,current=original?.analytics_revision ?? 0;
      if(!Number.isInteger(expected)||expected!==current)return fail(res,409,'Metric definitions changed. Reload the current definitions before saving; your edits were not overwritten.');
      if(!body.analytics_config||typeof body.analytics_config!=='object'||Array.isArray(body.analytics_config))return fail(res,400,'Metric definitions must be an object');
      row.analytics_revision=current+1;
    } else if(Object.hasOwn(body,'analytics_revision'))return fail(res,400,'Metric revision can only change with metric definitions');
  }
  if(['assignments','picklists'].includes(store)) {
    if(!Number.isInteger(body.revision)||body.revision!==(original?.revision||0))return fail(res,409,'This record changed. Reload before saving; your edit was not overwritten.');
    if(store==='assignments'&&req.method!=='DELETE'&&!membership(db,row.scout_user_id,tid))return fail(res,400,'Assign a scout who belongs to this workspace');
    if(store==='assignments'&&req.method!=='DELETE'){
      const event=rows(db,'scout_events').find(event=>event.team_id===tid&&event.event_key===row.event_key);
      const form=rows(db,'forms').find(form=>form.team_id===tid&&form.id===row.form_id&&!form.archived&&!form.archived_at);
      if(!event||!form||(form.kind||'match')!==(row.report_kind||'match')||!/^\d+$/.test(String(row.team_number)))return fail(res,400,'Choose an event, team and matching form for this assignment');
      if(row.report_kind!=='pit'&&!row.match_key)return fail(res,400,'Choose a match for this assignment');
    }
    row.revision=(original?.revision||0)+1;
    if(store==='assignments'){
      const event=rows(db,'scout_events').find(event=>event.team_id===tid&&event.event_key===row.event_key);
      if(event)event.assignment_revision=(event.assignment_revision||0)+1;
    }
  }
  if(req.method==='DELETE')db[store]=rows(db,store).filter(r=>r.id!==key);
  else {db[store]=rows(db,store);const index=db[store].findIndex(r=>r.id===key);if(index<0)db[store].push(row);else db[store][index]=row;}
  writeDB(db);res.json(req.method==='DELETE'?{ok:true}:row);
});
app.use('/api',(_req,res)=>fail(res,404,'Unknown API route'));
// Removed unprefixed collection aliases; they must never bypass authentication.
app.use((req,res,next)=>STORES.includes(req.path.split('/')[1])||req.path.startsWith('/session')?fail(res,404,'Unknown route'):next());
app.use(express.static(DIST_DIR,{etag:false,lastModified:false,cacheControl:false}));
app.use((req,res,next)=>{if(req.method!=='GET')return next();const index=path.join(DIST_DIR,'index.html');if(!fs.existsSync(index))return res.status(503).send('App build not found. Run npm run build first.');res.set('Cache-Control','no-store, max-age=0');res.sendFile(index,{etag:false,lastModified:false,cacheControl:false});});
app.use((err,_req,res,_next)=>{console.error(err.message);fail(res,err.status||500,'Request failed. Please try again.');});
app.listen(Number(process.env.APP_PORT||3001),()=>{console.log(`Argus DB server running`);console.log(`Data file: ${DB_FILE}`);});
