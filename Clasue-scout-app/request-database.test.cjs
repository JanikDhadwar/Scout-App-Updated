const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createDatabase,migrate}=require('./database.cjs');
const {createRequestDatabase}=require('./request-database.cjs');

function setup(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'argus-request-db-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const filename=path.join(directory,'db.json'),database=createDatabase(filename);
 database.write(migrate({submissions:[{id:'confirmed'}],unknown:{keep:true}}));
 let reads=0;
 const scoped=createRequestDatabase({read(){reads++;return database.read();},write:database.write},filename);
 return {scoped,database,filename,reads:()=>reads};
}
test('only repeated synchronous reads within one request reuse parsing; other requests and awaits reread',async t=>{
 const {scoped,reads}=setup(t);
 await scoped.run(async()=>{
  const first=scoped.read();assert.equal(scoped.read(),first);assert.equal(reads(),1);
  scoped.run(()=>assert.notEqual(scoped.read(),first));assert.equal(reads(),2);
  await Promise.resolve();assert.notEqual(scoped.read(),first);assert.equal(reads(),3);
 });
 scoped.read();scoped.read();assert.equal(reads(),5,'Reads outside request scopes are never cached');
});
test('failed request mutations never leak into another request, including overlapping async requests',async t=>{
 const {scoped}=setup(t);let release;
 const waiting=scoped.run(async()=>{const snapshot=scoped.read();snapshot.submissions.push({id:'uncommitted'});await new Promise(resolve=>{release=resolve;});assert.equal(scoped.read().submissions.length,1);});
 scoped.run(()=>assert.equal(scoped.read().submissions.length,1));release();await waiting;
});
test('confirmed and failed writes invalidate snapshots in every request scope',t=>{
 const {scoped}=setup(t);
 scoped.run(()=>{
  const first=scoped.read();
  scoped.run(()=>{const next=scoped.read();next.submissions.push({id:'second'});scoped.write(next);});
  assert.notEqual(scoped.read(),first);assert.equal(scoped.read().submissions.length,2);
  const dirty=scoped.read();dirty.submissions.push({id:'uncommitted'});dirty.users={};
  assert.throws(()=>scoped.write(dirty));assert.equal(scoped.read().submissions.length,2);
 });
});
test('external replacement, corruption and disappearance are observed before reusing a snapshot',t=>{
 const {scoped,filename}=setup(t);
 scoped.run(()=>{
  const previous=scoped.read(),replacement=`${filename}.external`;
  fs.writeFileSync(replacement,JSON.stringify(migrate({submissions:[{id:'external'}]})));fs.renameSync(replacement,filename);
  assert.notEqual(scoped.read(),previous);assert.equal(scoped.read().submissions[0].id,'external');
  fs.writeFileSync(filename,'{broken');assert.throws(()=>scoped.read());
  fs.unlinkSync(filename);assert.throws(()=>scoped.read(),/missing|unavailable/i);
 });
});
