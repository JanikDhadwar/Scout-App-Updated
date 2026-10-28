const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPasswordService}=require('./password-service.cjs');

test('password hashing yields the event loop, preserves salted format and verifies legacy credentials',async()=>{
 const passwords=createPasswordService();
 let turn=false;setImmediate(()=>{turn=true;});
 const hash=await passwords.hash('correct horse battery');
 assert.equal(turn,true,'Scouting requests must get an event-loop turn while hashing');
 assert.match(hash,/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
 assert.equal(await passwords.verify('correct horse battery',hash),true);
 assert.equal(await passwords.verify('wrong password',hash),false);
 assert.equal(await passwords.verify('a','61'),true);
 assert.equal(await passwords.verify('b','61'),false);
 assert.equal(await passwords.verify('anything','scrypt$invalid$bad'),false);
 assert.equal(await passwords.verify('anything',null),false);
 assert.notEqual(hash,await passwords.hash('correct horse battery'));
});

test('password work has bounded active and queued capacity and recovers after rejection',async()=>{
 const passwords=createPasswordService({concurrency:1,maxQueue:1});
 const first=passwords.hash('one password'),second=passwords.hash('two password');
 await assert.rejects(passwords.hash('overflow password'),error=>error.status===429);
 const [a,b]=await Promise.all([first,second]);
 assert.equal(await passwords.verify('one password',a),true);
 assert.equal(await passwords.verify('two password',b),true);
 assert.match(await passwords.hash('after overflow'),/^scrypt\$/);
});
