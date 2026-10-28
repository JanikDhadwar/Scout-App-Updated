import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraftPersistence} from './draft-persistence.js';

test('app update barrier waits for committed draft writes including edits queued while waiting',async()=>{
  const storage=createDraftPersistence(),committed=[];
  let releaseFirst,releaseSecond,startedFirst,startedSecond,updated=false;
  const firstStarted=new Promise(resolve=>{startedFirst=resolve;}),secondStarted=new Promise(resolve=>{startedSecond=resolve;});
  const first=storage.schedule('u:t:f',()=>new Promise(resolve=>{releaseFirst=()=>{committed.push('first');resolve();};startedFirst();}));
  await firstStarted;
  const update=storage.flush().then(()=>{updated=true;});
  const second=storage.schedule('u:t:f',()=>new Promise(resolve=>{releaseSecond=()=>{committed.push('second');resolve();};startedSecond();}));
  assert.equal(updated,false);
  releaseFirst();await first;await secondStarted;
  assert.equal(updated,false,'The later edit must commit before reload.');
  releaseSecond();await second;await update;
  assert.deepEqual(committed,['first','second']);assert.equal(updated,true);
});

test('failed draft storage blocks reload until explicit retry succeeds, preserving the last snapshot',async()=>{
  const storage=createDraftPersistence();let attempts=0,full=true;
  await assert.rejects(storage.schedule('u:t:f',async()=>{attempts++;if(full)throw Error('Quota exceeded');}),/Quota/);
  await assert.rejects(storage.flush(),/draft/i);assert.equal(attempts,1);
  await assert.rejects(storage.flush({retryFailed:true}),/draft/i);assert.equal(attempts,2);
  full=false;await storage.flush({retryFailed:true});assert.equal(attempts,3);
  await storage.flush();assert.equal(attempts,3,'Committed writes are not needlessly replayed.');
});

test('a later edit can recover a failed draft and another form failure still blocks reload',async()=>{
  const storage=createDraftPersistence(),saved=[];
  await assert.rejects(storage.schedule('old-account:team:form',async()=>{throw Error('Full');}));
  await storage.schedule('old-account:team:form',async()=>saved.push('corrected'));
  await assert.rejects(storage.schedule('other:team:form',async()=>{throw Error('Full');}));
  await assert.rejects(storage.flush(),/draft/i);
  await storage.schedule('other:team:form',async()=>saved.push('other'));
  await storage.flush();assert.deepEqual(saved,['corrected','other']);
});
