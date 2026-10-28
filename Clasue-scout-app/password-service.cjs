const crypto=require('node:crypto');
function createPasswordService({concurrency=2,maxQueue=16}={}){
 if(!Number.isInteger(concurrency)||concurrency<1||!Number.isInteger(maxQueue)||maxQueue<0)throw Error('Invalid password work limits.');
 let active=0;const queue=[];
 const run=work=>new Promise((resolve,reject)=>{
  const start=()=>{active++;work().then(resolve,reject).finally(()=>{active--;queue.shift()?.();});};
  if(active<concurrency)start();
  else if(queue.length<maxQueue)queue.push(start);
  else reject(Object.assign(Error('Authentication is busy. Try again shortly.'),{status:429}));
 });
 const derive=(password,salt)=>run(()=>new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,(error,key)=>error?reject(error):resolve(key.toString('hex')))));
 const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y);};
 return {
  async hash(password){const salt=crypto.randomBytes(16).toString('hex');return `scrypt$${salt}$${await derive(password,salt)}`;},
  async verify(password,hash){
   if(typeof password!=='string'||password.length>1024||typeof hash!=='string')return false;
   if(!hash.startsWith('scrypt$')){let value=0;for(let i=0;i<password.length;i++){value=((value<<5)-value)+password.charCodeAt(i);value|=0;}return equal(value.toString(16),hash);}
   const match=/^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(hash);
   return !!match&&equal(await derive(password,match[1]),match[2]);
  }
 };
}
module.exports={createPasswordService};
