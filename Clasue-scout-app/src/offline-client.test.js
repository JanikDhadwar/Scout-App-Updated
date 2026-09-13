import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createOfflineStore } from './offline-store.js';
import { createOfflineClient } from './offline-client.js';

const owner={userId:'scouter',teamId:'6390'};
const report=(id='report-1')=>({id,user_id:owner.userId,team_id:owner.teamId,form_id:'form-1',answers:{score:0,photo:'data:image/png;base64,test',climb:'No'}});
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>structuredClone(data)});
async function setup() {
  const factory=new IDBFactory(),store=createOfflineStore('test',factory);
  const server=new Map();let mode='offline',calls=0;
  const fetcher=async(url,options)=>{
    if(mode==='offline')throw new TypeError('Failed to fetch');
    if(options.method==='GET')return response(url.endsWith('/health')?{ok:true}:[]);
    calls++;
    const row=JSON.parse(options.body);
    if(mode==='rejected')return response({error:'Report rejected'},422);
    if(mode==='server-error')return response({error:'Try later'},503);
    server.set(row.id,row);
    if(mode==='lost-ack'){mode='offline';throw new TypeError('Connection lost after write');}
    return response(row);
  };
  const client=createOfflineClient({storage:store,fetcher});await client.setScope(owner);
  return {client,store,factory,fetcher,server,setMode:value=>{mode=value;},calls:()=>calls};
}
test('reports and photos survive reload, then upload automatically without duplication',async()=>{
  const f=await setup();
  await f.store.put('drafts',{key:'draft',value:{answers:report().answers}});
  await f.client.enqueue(report(),'draft');await f.client.sync();
  assert.equal((await f.store.all('queue')).length,1);
  assert.equal(await f.store.get('drafts','draft'),undefined);
  const reopened=createOfflineStore('test',f.factory);
  const restarted=createOfflineClient({storage:reopened,fetcher:f.fetcher});await restarted.setScope(owner);
  assert.equal(restarted.getState().pending,1);
  f.setMode('online');await restarted.sync();await restarted.sync();
  assert.equal(f.server.size,1);assert.deepEqual(f.server.get('report-1').answers,report().answers);
  assert.equal(restarted.getState().pending,0);assert.equal(f.calls(),1);
});
test('a lost server acknowledgement retries the same ID and preserves data',async()=>{
  const f=await setup();await f.client.enqueue(report());await f.client.sync();
  f.setMode('lost-ack');await f.client.sync();assert.equal(f.server.size,1);assert.equal(f.client.getState().pending,1);
  f.setMode('online');await Promise.all([f.client.sync(),f.client.sync()]);
  assert.equal(f.server.size,1);assert.equal(f.calls(),2);assert.equal(f.client.getState().pending,0);
});
test('rejected and temporary server failures never discard queued reports',async()=>{
  const f=await setup();await f.client.enqueue(report());await f.client.sync();
  f.setMode('rejected');await f.client.sync();assert.match(f.client.getState().error,/rejected/);assert.equal(f.client.getState().pending,1);
  f.setMode('server-error');await f.client.sync();assert.equal(f.client.getState().pending,1);
  f.setMode('online');await f.client.sync();assert.equal(f.client.getState().pending,0);
});
test('offline cached collections answer filtered and item queries but never fabricate missing data',async()=>{
  const f=await setup();
  const forms=[{id:'form-1',team_id:'6390',title:'Pit report'},{id:'other',team_id:'other'}];
  await f.store.put('cache',{key:'scouter:6390:/forms',data:forms});
  assert.deepEqual(await f.client.api('GET','/forms?team_id=6390'),[forms[0]]);
  assert.deepEqual(await f.client.api('GET','/forms/form-1'),forms[0]);
  await assert.rejects(f.client.api('GET','/scout_events'),/not downloaded/);
  await assert.rejects(f.client.api('GET','/users'),/unreachable/);
});
test('reports stay scoped to the original user/team across sign-out and team changes',async()=>{
  const f=await setup();await f.client.enqueue(report());await f.client.sync();
  await f.client.setScope({userId:'other',teamId:'6390'});f.setMode('online');await f.client.sync();
  assert.equal(f.calls(),0);assert.equal(f.client.getState().pending,0);
  await assert.rejects(f.client.enqueue(report()),/Sign in/);
  await f.client.setScope(owner);await f.client.sync();assert.equal(f.server.size,1);
});
test('storage failures preserve the draft and never claim the report is saved',async()=>{
  const f=await setup();await f.store.put('drafts',{key:'draft',value:'keep me'});
  const broken={...f.store,enqueue:async()=>{throw new Error('Quota exceeded');}};
  const client=createOfflineClient({storage:broken,fetcher:f.fetcher});await client.setScope(owner);
  await assert.rejects(client.enqueue(report(),'draft'),/Quota/);
  assert.equal((await f.store.get('drafts','draft')).value,'keep me');assert.equal(f.server.size,0);
});
test('download preparation persists readiness and queued reports appear alongside cached submissions',async()=>{
  const f=await setup();f.setMode('online');await f.client.prepare();assert.ok(f.client.getState().readyAt);
  f.setMode('offline');await f.client.enqueue(report());await f.client.sync();
  assert.deepEqual(await f.client.api('GET','/submissions?form_id=form-1'),[report()]);
  assert.deepEqual(await f.client.api('GET','/submissions?form_id=other'),[]);
});
test('server rejection is not mistaken for an offline cache response',async()=>{
  const f=await setup();await f.store.put('cache',{key:'scouter:6390:/forms',data:[{id:'old'}]});
  const denied=createOfflineClient({storage:f.store,fetcher:async()=>response({error:'Access denied'},403)});await denied.setScope(owner);
  await assert.rejects(denied.api('GET','/forms'),/Access denied/);
});
