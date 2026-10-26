const crypto=require('node:crypto');
function registerAccountSecurity(app,{readDB,writeDB,verifyPassword,passwordHash,publicUser,publicTeam,sessions,limit}){
 const digest=code=>crypto.createHash('sha256').update(code).digest('hex');
 const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
 const fail=(res,status,error)=>res.status(status).json({error});
 app.post('/api/auth/reset-password',(req,res)=>{
  if(!limit.take(`reset-ip:${req.ip}`,30)||!limit.take('reset-global',500))return fail(res,429,'Too many attempts. Try again in 15 minutes.');
  const {username,recovery_code,new_password}=req.body||{};
  if(typeof username!=='string'||username.length>80||typeof recovery_code!=='string'||!/^[a-f0-9]{48}$/.test(recovery_code)||typeof new_password!=='string'||new_password.length<8||new_password.length>1024||!new_password.trim())return fail(res,400,'Enter your username, saved recovery code, and a password of at least 8 characters.');
  const db=readDB(),user=db.users.find(u=>typeof u.username==='string'&&u.username.toLowerCase()===username.trim().toLowerCase());
  if(!user||user.disabled||user.disabled_at||!same(user.recovery_hash,digest(recovery_code)))return fail(res,401,'Username or recovery code is incorrect, or the code has already been used.');
  user.password_hash=passwordHash(new_password);delete user.recovery_hash;delete user.recovery_created_at;
  writeDB(db);sessions.revoke(user.id);res.json({ok:true});
 });
 app.post(['/api/auth/recovery-code','/api/auth/change-username','/api/auth/rotate-join-code'],(req,res)=>{
  if(!req.user)return fail(res,401,'Sign in required');
  if(!limit.take(`account:${req.user.id}`,20)||!limit.take(`account-ip:${req.ip}`,200))return fail(res,429,'Too many attempts. Try again in 15 minutes.');
  const {current_password,username}=req.body||{},db=readDB(),user=db.users.find(u=>u.id===req.user.id);
  if(typeof current_password!=='string'||current_password.length>1024||!verifyPassword(current_password,user.password_hash))return fail(res,401,'Current password is incorrect.');
  if(req.path.endsWith('/rotate-join-code')){
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
