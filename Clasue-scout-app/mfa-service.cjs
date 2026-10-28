const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buffer){let bits=0,value=0,result='';for(const byte of buffer){value=(value<<8)|byte;bits+=8;while(bits>=5){result+=alphabet[(value>>>(bits-=5))&31];}}if(bits)result+=alphabet[(value<<(5-bits))&31];return result;}
function decode32(value){let bits=0,current=0,bytes=[];for(const char of value.replace(/=+$/,'').toUpperCase()){const index=alphabet.indexOf(char);if(index<0)throw Error('Invalid TOTP secret.');current=(current<<5)|index;bits+=5;if(bits>=8)bytes.push((current>>>(bits-=8))&255);}return Buffer.from(bytes);}
function hotp(secret,counter){const value=Buffer.alloc(8);value.writeBigUInt64BE(BigInt(counter));const digest=crypto.createHmac('sha1',decode32(secret)).update(value).digest(),offset=digest[19]&15;return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');}
const same=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);};

function createMfaService(filename,keyValue=process.env.ARGUS_MFA_KEY,{now=()=>Date.now()}={}){
 const exists=fs.existsSync(filename),key=keyValue?Buffer.from(keyValue,'base64'):null;
 if(exists&&fs.lstatSync(filename).isSymbolicLink())throw Error('MFA private file must not be a symbolic link.');
 if(keyValue&&(!/^[A-Za-z0-9+/]{43}=$/.test(keyValue)||!key||key.length!==32||key.toString('base64')!==keyValue))throw Error('ARGUS_MFA_KEY must be a canonical base64-encoded 32-byte key.');
 if(exists&&!key)throw Error('MFA records exist but ARGUS_MFA_KEY is unavailable. Refusing to bypass enrolled accounts.');
 let state={version:1,users:{}};
 if(exists){state=JSON.parse(fs.readFileSync(filename,'utf8'));if(state.version!==1||!state.users||typeof state.users!=='object')throw Error('Invalid MFA private file. Existing file was preserved.');}
 const pending=new Map(),challenges=new Map();
 const digest=(userId,code)=>crypto.createHash('sha256').update(`${userId}:${String(code).toLowerCase()}`).digest('hex');
 const seal=secret=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);return{iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};};
 const open=value=>{const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(value.iv,'base64'));decipher.setAuthTag(Buffer.from(value.tag,'base64'));return Buffer.concat([decipher.update(Buffer.from(value.data,'base64')),decipher.final()]).toString('utf8');};
 function save(){fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});if(fs.existsSync(filename)&&fs.lstatSync(filename).isSymbolicLink())throw Error('MFA private file must not be a symbolic link.');const temporary=`${filename}.${process.pid}.${crypto.randomUUID()}.tmp`;let descriptor;try{descriptor=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(descriptor,JSON.stringify(state));fs.fsyncSync(descriptor);fs.closeSync(descriptor);descriptor=undefined;fs.renameSync(temporary,filename);fs.chmodSync(filename,0o600);}finally{if(descriptor!==undefined)fs.closeSync(descriptor);if(fs.existsSync(temporary))fs.unlinkSync(temporary);}}
 function recovery(userId){const codes=Array.from({length:10},()=>crypto.randomBytes(10).toString('hex'));return{codes,hashes:codes.map(code=>digest(userId,code))};}
 function steps(secret,code){const step=Math.floor(now()/30000),matches=[];for(const offset of [-1,0,1])if(same(hotp(secret,step+offset),code))matches.push(step+offset);return matches;}
 return {
  available:!!key,
  enrolled:userId=>!!state.users[userId],
  status:userId=>({available:!!key,enrolled:!!state.users[userId],recovery_codes_remaining:state.users[userId]?.recovery_hashes?.length||0}),
  begin(userId,label){if(!key)throw Object.assign(Error('MFA encryption is not configured on this server.'),{status:503});const secret=base32(crypto.randomBytes(20)),id=crypto.randomBytes(24).toString('hex');pending.set(id,{userId,secret,expires:now()+10*60*1000});return{enrollment_id:id,secret,otpauth_url:`otpauth://totp/${encodeURIComponent(`Argus:${label}`)}?secret=${secret}&issuer=Argus&algorithm=SHA1&digits=6&period=30`,expires_in:600};},
  confirm(userId,id,code){const value=pending.get(id);if(!value||value.userId!==userId||value.expires<=now())throw Object.assign(Error('MFA enrollment expired. Start again.'),{status:409});const matched=steps(value.secret,code);if(!matched.length)throw Object.assign(Error('Authenticator code is incorrect.'),{status:401});const generated=recovery(userId);state.users[userId]={secret:seal(value.secret),recovery_hashes:generated.hashes,last_step:Math.max(...matched),enrolled_at:new Date(now()).toISOString()};save();pending.delete(id);return{recovery_codes:generated.codes};},
  startLogin(userId){if(!state.users[userId])throw Error('MFA is not enrolled.');const challenge=crypto.randomBytes(24).toString('hex');challenges.set(challenge,{userId,expires:now()+5*60*1000});return{mfa_required:true,challenge_id:challenge,expires_in:300};},
  verify(challenge,code){const value=challenges.get(challenge),record=value&&state.users[value.userId];if(!value||value.expires<=now()||!record)throw Object.assign(Error('MFA challenge expired. Sign in again.'),{status:401});const normalized=String(code||'').replace(/[\s-]/g,'').toLowerCase();let accepted=false;
   if(/^\d{6}$/.test(normalized)){const matched=steps(open(record.secret),normalized).filter(step=>step>Number(record.last_step||0));if(matched.length){record.last_step=Math.max(...matched);accepted=true;}}
   else {const hashed=digest(value.userId,normalized),index=record.recovery_hashes.findIndex(item=>same(item,hashed));if(index>=0){record.recovery_hashes.splice(index,1);accepted=true;}}
   if(!accepted)throw Object.assign(Error('Authenticator or recovery code is incorrect.'),{status:401});save();challenges.delete(challenge);return value.userId;},
  regenerate(userId){if(!state.users[userId])throw Object.assign(Error('MFA is not enrolled.'),{status:409});const generated=recovery(userId);state.users[userId].recovery_hashes=generated.hashes;save();return{recovery_codes:generated.codes};},
  disable(userId){if(!state.users[userId])return false;delete state.users[userId];save();return true;},
  _code(userId,time=now()){const record=state.users[userId];return hotp(open(record.secret),Math.floor(time/30000));}
 };
}
module.exports={createMfaService,base32,hotp};
