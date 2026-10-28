const crypto=require('node:crypto');
function registerAccountSecurity(app,{readDB,writeDB,verifyPassword,passwordHash,publicUser,publicTeam,sessions,limit,requireSensitiveMfa=()=>{}}){
 const digest=code=>crypto.createHash('sha256').update(code).digest('hex');
 const same=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y);};
 const fail=(res,status,error)=>res.status(status).json({error});
 app.post('/api/auth/reset-password',async(req,res)=>{
  if(!limit.take(`reset-ip:${req.ip}`,30)||!limit.take('reset-global',500))return fail(res,429,'Too many attempts. Try again in 15 minutes.');
  const {username,recovery_code,new_password}=req.body||{};
  if(typeof username!=='string'||username.length>80||typeof recovery_code!=='string'||!/^[a-f0-9]{48}$/.test(recovery_code)||typeof new_password!=='string'||new_password.length<8||new_password.length>1024||!new_password.trim())return fail(res,400,'Enter your username, saved recovery code, and a password of at least 8 characters.');
  const db=readDB(),user=db.users.find(u=>typeof u.username==='string'&&u.username.toLowerCase()===username.trim().toLowerCase());
  if(!user||user.disabled||user.disabled_at||!same(user.recovery_hash,digest(recovery_code)))return fail(res,401,'Username or recovery code is incorrect, or the code has already been used.');
  const hash=await passwordHash(new_password),current=readDB(),fresh=current.users.find(u=>u.id===user.id);
  if(!fresh||fresh.disabled||fresh.disabled_at||fresh.username!==user.username||fresh.password_hash!==user.password_hash||!same(fresh.recovery_hash,digest(recovery_code)))return fail(res,401,'Username or recovery code is incorrect, or the code has already been used.');
  fresh.password_hash=hash;delete fresh.recovery_hash;delete fresh.recovery_created_at;
  writeDB(current);sessions.revoke(fresh.id);res.json({ok:true});
 });
 app.post(['/api/auth/recovery-code','/api/auth/change-username','/api/auth/rotate-join-code'],async(req,res)=>{
  if(!req.user)return fail(res,401,'Sign in required');
  if(!limit.take(`account:${req.user.id}`,20)||!limit.take(`account-ip:${req.ip}`,200))return fail(res,429,'Too many attempts. Try again in 15 minutes.');
  const {current_password,username}=req.body||{},snapshot=readDB().users.find(u=>u.id===req.user.id);
  if(!snapshot||snapshot.disabled||snapshot.disabled_at||typeof current_password!=='string'||current_password.length>1024||!await verifyPassword(current_password,snapshot.password_hash))return fail(res,401,'Current password is incorrect.');
  const db=readDB(),user=db.users.find(u=>u.id===req.user.id),session=sessions.get(req.sessionToken);
  if(!user||user.disabled||user.disabled_at||user.password_hash!==snapshot.password_hash||!session||session.userId!==user.id||session.expires<=Date.now())return fail(res,401,'Account changed. Sign in again.');
  if(req.path.endsWith('/rotate-join-code')){
   try{requireSensitiveMfa(req);}catch(error){return fail(res,error.status||403,error.message);}
   const team=db.teams.find(t=>t.id===req.body.team_id);
   if(!team||team.owner_id!==user.id)return fail(res,403,'Team owner permission required.');
   team.password=crypto.randomBytes(12).toString('hex').toUpperCase();writeDB(db);return res.json({team:publicTeam(db,team,user.id)});
  }
  if(req.path.endsWith('/recovery-code')){
   const code=crypto.randomBytes(24).toString('hex');user.recovery_hash=digest(code);user.recovery_created_at=new Date().toISOString();writeDB(db);return res.json({recovery_code:code});
  }
  if(typeof username!=='string'||!username.trim()||username.length>80)return fail(res,400,'Enter a username of 1 to 80 characters.');
  if(db.users.some(u=>u.id!==user.id&&typeof u.username==='string'&&u.username.toLowerCase()===username.trim().toLowerCase()))return fail(res,409,'Username is already registered.');
  user.username=username.trim();for(const membership of db.memberships)if(membership.user_id===user.id)membership.username=user.username;
  writeDB(db);res.json(publicUser(user));
 });
}
module.exports={registerAccountSecurity};
