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
const { submissionError } = require('./scouting-rules.cjs');
const {activeEvent,previewTransition,applyTransition}=require('./event-transition.cjs');
const {matchReportError}=require('./src/argus/match-access.js');
const handoffs=require('./match-handoffs.cjs');
const { createDatabase } = require('./database.cjs');
const { createSessions } = require('./private-sessions.cjs');
const domain = require('./domain.cjs');
const assignmentsService = require('./assignment-service.cjs');
const submissionService = require('./submission-service.cjs');
const { registerUpgradeRoutes } = require('./upgrade-routes.cjs');
const scoutPresence=new Map();
const match13=require('./match13-service.cjs').createMatch13Client(),match13Requests=new Map();
const statbotics=require('./statbotics-service.cjs').createStatboticsClient(),statboticsRequests=new Map();
const app = express();
app.disable('x-powered-by');
app.disable('etag');
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'db.json');
const DIST_DIR = path.join(__dirname, 'dist');
const integrations=createIntegrationStore(path.join(path.dirname(DB_FILE),'argus-integrations.private.json'));
function integrationKey(req,name,workspaceId=req.headers['x-argus-workspace']){return (typeof workspaceId==='string'&&membership(readDB(),req.user.id,workspaceId)?integrations.key(workspaceId,name):undefined)||process.env[name];}
const STORES = ['users','teams','memberships','forms','submissions','announcements','scout_events','pit_scouts','assignments','picklists','team_allocations'];
const database = createDatabase(DB_FILE);
const sessions = createSessions(path.join(path.dirname(DB_FILE), 'argus-sessions.private.json')), attempts = new Map();
function readDB() {
  return database.read();
}
function writeDB(db) {
  database.write(db);
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
  res.cookie('argus_session',token,{httpOnly:true,sameSite:'strict',secure:req.secure || process.env.COOKIE_SECURE==='true' || process.env.NODE_ENV==='production',maxAge:7*86400000,path:'/'});
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
  writeDB(db);sessions.revoke(req.user.id);
  res.clearCookie('argus_session',{path:'/',httpOnly:true,sameSite:'strict'});res.json({ok:true});
});
registerUpgradeRoutes(app, { readDB, writeDB, verifyPassword, publicTeam, dbFile:DB_FILE });
app.get('/api/integrations/status',(req,res)=>{const {workspaceId}=req.query;if(typeof workspaceId!=='string'||!membership(readDB(),req.user.id,workspaceId))return fail(res,403,'Workspace permission required');res.json({tbaConfigured:!!integrationKey(req,'TBA_API_KEY',workspaceId),groqConfigured:!!integrationKey(req,'GROQ_API_KEY',workspaceId),match13Configured:!!integrationKey(req,'MATCH13_API_KEY',workspaceId)});});
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
    const { analyticsForUser } = require('./shared-analytics.cjs');
    const analytics=await analyticsForUser(db,event,req.user.id);
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
app.get('/api/match13/:resource',async(req,res)=>{
 const {workspaceId,team,year,event}=req.query;
 if(typeof workspaceId!=='string'||!membership(readDB(),req.user.id,workspaceId))return fail(res,403,'Team membership required.');
 const now=Date.now(),previous=match13Requests.get(req.user.id),bucket=previous?.until>now?previous:{count:0,until:now+60000};
 if(bucket.count>=30)return fail(res,429,'Wait a minute before requesting more Match13 data.');
 if(match13Requests.size>1000)for(const [id,value]of match13Requests)if(value.until<now)match13Requests.delete(id);
 bucket.count++;match13Requests.set(req.user.id,bucket);
 const key=integrationKey(req,'MATCH13_API_KEY',workspaceId);
 try{
  if(req.params.resource==='rating')return res.json({rating:await match13.rating(team,year,key),source:'Match13',fetched_at:new Date().toISOString()});
  if(req.params.resource==='rankings')return res.json(await match13.rankings(req.query,key));
  if(req.params.resource==='predictions')return res.json(await match13.predictions(event,key));
  if(req.params.resource==='regions')return res.json(await match13.regions(team,year,key,integrationKey(req,'TBA_API_KEY',workspaceId)));
  return fail(res,404,'Match13 resource not found.');
 }catch(error){return fail(res,error.status||502,error.status?error.message:'Match13 data is temporarily unavailable. Try again later.');}
});
app.get('/api/statbotics/rankings',async(req,res)=>{
 const now=Date.now(),previous=statboticsRequests.get(req.user.id),bucket=previous?.until>now?previous:{count:0,until:now+60000};
 if(bucket.count>=30)return fail(res,429,'Wait a minute before loading more global rankings.');
 if(statboticsRequests.size>1000)for(const [id,value]of statboticsRequests)if(value.until<now)statboticsRequests.delete(id);
 bucket.count++;statboticsRequests.set(req.user.id,bucket);
 try{res.json(await statbotics.rankings(req.query));}
 catch(error){return fail(res,error.status||502,error.status?error.message:'Statbotics is temporarily unavailable or returned an unexpected format. Try again later.');}
});
app.get('/api/form-submission-counts/:formId',(req,res)=>{
  const db=readDB(),form=rows(db,'forms').find(row=>row.id===req.params.formId);
  if(!form||!membership(db,req.user.id,form.team_id))return fail(res,404,'Form not found');
  const counts={};for(const report of domain.realReports(db))if(report.team_id===form.team_id&&report.form_id===form.id&&(report.event_key||'')===(req.query.event_key||'')&&/^\d+$/.test(String(report.scouted_team)))counts[report.scouted_team]=(counts[report.scouted_team]||0)+1;
  res.json(counts);
});
app.get('/api/handoffs',(req,res)=>{
 const teamId=req.query.team_id,db=readDB();if(!membership(db,req.user.id,teamId))return fail(res,403,'Team membership required');
 const now=Date.now();scoutPresence.set(`${teamId}:${req.user.id}`,now);
 for(const [key,time] of scoutPresence)if(time<now-60000)scoutPresence.delete(key);
 if(handoffs.refreshStates(db,now))writeDB(db);
 const result=rows(db,'match_handoffs').filter(row=>row.team_id===teamId&&(row.from_user_id===req.user.id||row.to_user_id===req.user.id)).slice(-80).reverse().map(row=>({...row,from_username:rows(db,'users').find(user=>user.id===row.from_user_id)?.username||'Scout',to_username:rows(db,'users').find(user=>user.id===row.to_user_id)?.username||'Scout'}));
 res.json(result);
});
app.get('/api/handoffs/context',(req,res)=>{
 const {team_id,event_id,match_key}=req.query,db=readDB();
 try{res.json(handoffs.handoffContext(db,{teamId:team_id,eventId:event_id,matchKey:match_key,userId:req.user.id,isOnline:id=>Date.now()-(scoutPresence.get(`${team_id}:${id}`)||0)<45000}));}catch(error){if(!error.status)throw error;fail(res,error.status,error.message);}
});
app.post('/api/handoffs',(req,res)=>{
 const {id,team_id,event_id,match_key,team_number,to_user_id,owner_revision}=req.body||{},db=readDB();
 try{const row=handoffs.createHandoff(db,{id,teamId:team_id,eventId:event_id,matchKey:match_key,teamNumber:team_number,toUserId:to_user_id,ownerRevision:owner_revision,userId:req.user.id,isOnline:uid=>Date.now()-(scoutPresence.get(`${team_id}:${uid}`)||0)<45000});writeDB(db);res.json(row);}catch(error){if(!error.status)throw error;fail(res,error.status,error.message);}
});
app.post('/api/handoffs/:id/respond',(req,res)=>{
 const {action,revision}=req.body||{},db=readDB();
 try{const row=handoffs.respondHandoff(db,{id:req.params.id,userId:req.user.id,action,revision,isOnline:uid=>{const handoff=rows(db,'match_handoffs').find(row=>row.id===req.params.id);return Date.now()-(scoutPresence.get(`${handoff.team_id}:${uid}`)||0)<45000;}});writeDB(db);res.json(row);}catch(error){if(!error.status)throw error;fail(res,error.status,error.message);}
});
app.get('/api/event-transition/preview',(req,res)=>{
 const {team_id,next_event_id}=req.query,db=readDB();
 if(!admin(db,req.user.id,team_id))return fail(res,403,'Team administrator permission required');
 try{res.json(previewTransition(db,team_id,next_event_id));}catch(error){fail(res,error.status||500,error.message);}
});
app.post('/api/event-transition',(req,res)=>{
 const {team_id,next_event_id,expected,preserve_history}=req.body||{},db=readDB();
 if(!admin(db,req.user.id,team_id))return fail(res,403,'Team administrator permission required');
 try{const result=applyTransition(db,{teamId:team_id,nextEventId:next_event_id,expected,preserveHistory:preserve_history});domain.audit(db,{teamId:team_id,actorId:req.user.id,action:'event.activate',targetId:next_event_id});writeDB(db);res.json({...result,team:publicTeam(db,result.team,req.user.id)});}catch(error){if(!error.status)throw error;fail(res,error.status,error.message);}
});
function visible(db,store,row,uid) {
  if(store==='users')return row.id===uid||rows(db,'memberships').some(m=>m.user_id===row.id&&membership(db,uid,m.team_id));
  const tid=store==='teams'?row.id:row.team_id;
  if(!membership(db,uid,tid))return false;
  return store!=='submissions'||row.user_id===uid||admin(db,uid,tid);
}
app.get('/api/:store{/:id}',(req,res)=>{
  const {store,id}=req.params;if(!STORES.includes(store))return fail(res,store==='session'?403:404,'Collection is unavailable');
  const db=readDB();let result=rows(db,store).filter(r=>visible(db,store,r,req.user.id)&&(store!=='submissions'||!domain.reportRemoved(db,r.id)));
  for(const [key,value]of Object.entries(req.query)){if(['password','password_hash'].includes(key))return fail(res,400,'Private field filters are not supported');result=result.filter(r=>String(r[key])===String(value));}
  result=result.map(r=>store==='users'?publicUser(r):store==='teams'?publicTeam(db,r,req.user.id):store==='submissions'&&rows(db,'submission_states').some(s=>s.id===r.id&&s.review_required)?{...r,quality_review_required:true}:r);
  if(id){const row=result.find(r=>r.id===id);return row?res.json(row):fail(res,404,'Record not found');}res.json(result);
});
app.all('/api/:store{/:id}',(req,res,next)=>{
  if(!['POST','PATCH','DELETE'].includes(req.method))return next();
  const {store,id}=req.params;if(!STORES.includes(store)||store==='users')return fail(res,403,'Collection cannot be changed here');
  if(store==='team_allocations')return fail(res,403,'Use the ownership editor to change team allocations');
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
    if(store!=='submissions'&&team?.active_event_id&&row.event_key&&row.event_key!==current?.event_key)return fail(res,409,'Only the active event accepts new operational changes. Your local copy is preserved.');
  }
  if(store==='submissions') {
    if(req.method!=='POST')return fail(res,409,'Reports are immutable. Preserve the original and submit a new correction.');
    if(row.user_id!==req.user.id)return fail(res,403,'Report identity must match your account');
    if(!rows(db,'forms').some(f=>f.id===row.form_id&&f.team_id===tid))return fail(res,400,'Choose a form in this workspace');
    row.submitted_by=req.user.username;
    if(domain.reportRemoved(db,key))return fail(res,409,'This report was removed by an administrator. Its ID remains reserved.');
    if(original)return isDeepStrictEqual(original,{...body,submitted_by:req.user.username})?res.json(original):fail(res,409,'A different report already uses this ID. Your local copy is preserved.');
    const form=rows(db,'forms').find(form=>form.id===row.form_id);
    const validationError=submissionService.validateReport(db,form,row);if(validationError)return fail(res,400,validationError);
    if(form.kind&&row.report_kind&&form.kind!==row.report_kind)return fail(res,400,'Use the report type configured for this form.');
    if((form.kind||'match')!=='pit'){
      const event=rows(db,'scout_events').find(event=>event.team_id===tid&&event.event_key===row.event_key);
      const accessError=matchReportError({event,assignments:rows(db,'assignments'),userId:req.user.id,report:row});
      const pastDuty=rows(db,'responsibility_history').some(change=>change.team_id===tid&&change.event_key===row.event_key&&change.assignment_id===row.assignment_id&&(change.to_user_id===req.user.id||change.from_user_id===req.user.id));
      const duty=rows(db,'assignments').find(a=>a.id===row.assignment_id&&a.team_id===tid&&a.event_key===row.event_key&&a.match_key===row.match_key&&String(a.team_number)===String(row.scouted_team)&&a.form_id===row.form_id);
      if(accessError&&!(pastDuty&&duty))return fail(res,403,accessError);
    }
    const limitError=submissionError(rows(db,'forms').find(f=>f.id===row.form_id),row,domain.realReports(db));
    if(limitError)return fail(res,409,limitError);
  } else if(store==='pit_scouts') {
    if(row.user_id!==req.user.id&&!admin(db,req.user.id,tid))return fail(res,403,'Permission denied');
    if(original&&row.user_id!==original.user_id)return fail(res,400,'Scout identity cannot be changed');
  } else if(store==='memberships') {
    if(req.method==='DELETE'&&original?.user_id===req.user.id&&original.role!=='owner') { /* Members may leave. */ }
    else if(role(db,req.user.id,tid)!=='owner')return fail(res,403,'Use Admin member management for ordinary members');
    if(!original)return fail(res,403,'Join a team through the join-team endpoint');
    if(row.user_id!==original.user_id||row.team_id!==original.team_id||row.username!==original.username)return fail(res,400,'Membership identity cannot be changed');
    if(original.role==='owner'||row.role==='owner')return fail(res,409,'Use transfer-ownership before changing the owner');
    if(!['admin','member'].includes(row.role))return fail(res,400,'Invalid role');
  } else if(store==='teams') {
    if(role(db,req.user.id,tid)!=='owner')return fail(res,403,'Owner permission required');
    if(req.method==='DELETE')return fail(res,409,'Team deletion would orphan scouting records. Archive the workspace instead.');
    if(!original||row.owner_id!==original.owner_id||row.number!==original.number)return fail(res,400,'Team identity cannot be changed');
    if(Object.hasOwn(body,'active_event_id')&&body.active_event_id!==original.active_event_id||Object.hasOwn(body,'event_transition')&&!isDeepStrictEqual(body.event_transition,original.event_transition))return fail(res,409,'Use Change event to switch events and retain history.');
  } else if(!admin(db,req.user.id,tid))return fail(res,403,'Administrator permission required');
  if(req.method==='DELETE'&&['forms','scout_events'].includes(store))return fail(res,409,'Archive this record instead. Scouting evidence and unfinished drafts must be retained.');
  if(store==='forms'&&req.method!=='DELETE'&&row.max_submissions_per_team!=null&&(!Number.isInteger(row.max_submissions_per_team)||row.max_submissions_per_team<1||!row.allow_team_select))return fail(res,400,'Submission limits require team selection and a positive whole number');
  if(store==='forms'&&req.method!=='DELETE'){
    const invalid=submissionService.validateForm(row);if(invalid)return fail(res,400,invalid);
    if(original)db.form_versions=[...rows(db,'form_versions'),{id:crypto.randomUUID(),form_id:original.id,team_id:tid,questions:original.questions||[],revision:original.revision||0}];
    row.revision=(original?.revision||0)+1;
  }
  if(store==='scout_events') {
    if(original?.data_cleared_at)return fail(res,409,'This event was cleared and cannot be changed.');
    if(Object.hasOwn(body,'data_cleared_at'))return fail(res,400,'Event clearing is managed by Change event.');
    if(original&&row.event_key!==original.event_key)return fail(res,409,'Use Change event instead of replacing an event key.');
    if(Object.hasOwn(body,'assignment_revision'))return fail(res,400,'Assignment revisions are managed by assignment writes');
    if(original&&(Object.hasOwn(body,'assignment')||Object.hasOwn(body,'excluded')))return fail(res,409,'Use the permanent team ownership editor');
    if(original&&Object.hasOwn(body,'shared_summary_policy'))return fail(res,409,'Use the approved summaries editor');
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
      if(original&&['event_key','match_key','team_number','report_kind'].some(field=>String(row[field]||'')!==String(original[field]||'')))return fail(res,409,'Assignment identity cannot change. Create a separate duty instead.');
      if(original&&(row.scout_user_id!==original.scout_user_id||row.form_id!==original.form_id)&&(!body.admin_reason||typeof body.admin_reason!=='string'||body.admin_reason.length>500))return fail(res,400,'Enter a reason for changing responsibility or form.');
      row.primary_scout_user_id=original?.primary_scout_user_id||original?.scout_user_id||row.scout_user_id;
      row.allocation_id=original?.allocation_id||null;
      row.handoff_id=original?.handoff_id||null;
      row.source=original?.source||'manual';
      if(original&&(row.scout_user_id!==original.scout_user_id||row.form_id!==original.form_id)){row.source='manual';row.handoff_id=null;}
      const event=rows(db,'scout_events').find(event=>event.team_id===tid&&event.event_key===row.event_key);
      const form=rows(db,'forms').find(form=>form.team_id===tid&&form.id===row.form_id&&!form.archived&&!form.archived_at);
      if(!event||!form||(form.kind||'match')!==(row.report_kind||'match')||!/^\d+$/.test(String(row.team_number)))return fail(res,400,'Choose an event, team and matching form for this assignment');
      if(row.report_kind!=='pit'&&!row.match_key)return fail(res,400,'Choose a match for this assignment');
      if(row.report_kind!=='pit'){
        const match=event.matches?.find(match=>match.key===row.match_key);
        if(!match||!['red','blue'].some(color=>match.alliances?.[color]?.team_keys?.includes(`frc${row.team_number}`)))return fail(res,400,'Choose a robot playing in this match.');
        if(!row.archived_at&&rows(db,'assignments').some(other=>other.id!==key&&other.team_id===tid&&other.event_key===row.event_key&&other.match_key===row.match_key&&String(other.team_number)===String(row.team_number)&&other.report_kind!=='pit'&&!other.archived_at))return fail(res,409,'This robot already has a scout for this match. Edit the existing assignment or request a handoff.');
      }
    }
    row.revision=(original?.revision||0)+1;
    if(store==='assignments'){
      const event=rows(db,'scout_events').find(event=>event.team_id===tid&&event.event_key===row.event_key);
      if(event)event.assignment_revision=(event.assignment_revision||0)+1;
    }
  }
  if(req.method==='DELETE')db[store]=rows(db,store).filter(r=>r.id!==key);
  else {db[store]=rows(db,store);const index=db[store].findIndex(r=>r.id===key);if(index<0)db[store].push(row);else db[store][index]=row;}
  if(store==='assignments')assignmentsService.history(db,row,original?.scout_user_id||null,req.user.id,req.method==='DELETE'?'removed':'manual');
  if(store==='submissions'&&body.questions_snapshot){const form=rows(db,'forms').find(f=>f.id===body.form_id);if(!isDeepStrictEqual(body.questions_snapshot,form.questions||[])&&!rows(db,'form_versions').some(v=>v.form_id===form.id&&isDeepStrictEqual(v.questions,body.questions_snapshot)))db.submission_states=[...rows(db,'submission_states'),{id:key,team_id:tid,review_required:true,revision:0,removed:false}];}
  if(store==='scout_events'&&original&&Object.hasOwn(body,'matches'))assignmentsService.reconcile(db,row,req.user.id);
  if(['forms','memberships','assignments','scout_events','picklists'].includes(store))domain.audit(db,{teamId:tid,eventKey:row.event_key,actorId:req.user.id,action:`${store}.${req.method.toLowerCase()}`,targetId:key,detail:store==='assignments'?{reason:body.admin_reason||null}:undefined});
  if(store==='submissions')handoffs.refreshStates(db);
  writeDB(db);res.json(req.method==='DELETE'?{ok:true}:row);
});
app.use('/api',(_req,res)=>fail(res,404,'Unknown API route'));
// Removed unprefixed collection aliases; they must never bypass authentication.
app.use((req,res,next)=>STORES.includes(req.path.split('/')[1])||req.path.startsWith('/session')?fail(res,404,'Unknown route'):next());
app.use(express.static(DIST_DIR,{etag:false,lastModified:false,cacheControl:false}));
app.use((req,res,next)=>{if(req.method!=='GET')return next();const index=path.join(DIST_DIR,'index.html');if(!fs.existsSync(index))return res.status(503).send('App build not found. Run npm run build first.');res.set('Cache-Control','no-store, max-age=0');res.sendFile(index,{etag:false,lastModified:false,cacheControl:false});});
app.use((err,_req,res,_next)=>{console.error(err.message);fail(res,err.status||500,'Request failed. Please try again.');});
app.listen(Number(process.env.APP_PORT||3001),()=>{console.log(`Argus DB server running`);console.log(`Data file: ${DB_FILE}`);});
