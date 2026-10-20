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
  await assert.rejects(f.client.api('GET','/users'),/not downloaded/);
  const people=[{id:'scouter',username:'Scout'}];
  await f.store.put('cache',{key:'scouter:6390:/users',data:people});
  assert.deepEqual(await f.client.api('GET','/users'),people);
  await assert.rejects(f.client.api('GET','/auth/me'),/unreachable/);
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

test('conflicting local edits never replace an already queued report',async()=>{
  const f=await setup();await f.client.enqueue(report());await f.client.sync();
  await f.store.put('drafts',{key:'correction',value:'preserve correction'});
  await assert.rejects(f.client.enqueue({...report(),answers:{score:99}},'correction'),/already|conflict/i);
  assert.deepEqual((await f.store.get('queue','report-1')).row,report());
  assert.equal((await f.store.get('drafts','correction')).value,'preserve correction');
});

test('one conflicting queued report does not block other reports and conflicts survive reload',async()=>{
  const f=await setup();await f.client.enqueue(report('conflict'));await f.client.enqueue(report('valid'));await f.client.sync();
  const fetcher=async(url,options)=>options.method==='GET'?response({ok:true}):JSON.parse(options.body).id==='conflict'?response({error:'Conflicting report; inspect original'},409):response(JSON.parse(options.body));
  const client=createOfflineClient({storage:f.store,fetcher});await client.setScope(owner);await client.sync();
  assert.equal(client.getState().pending,1);assert.match(client.getState().error,/Conflicting/);
  assert.equal((await f.store.get('receipts','valid')).row.id,'valid');
  const restarted=createOfflineClient({storage:createOfflineStore('test',f.factory),fetcher});await restarted.setScope(owner);
  assert.equal(restarted.getState().pending,1);assert.match(restarted.getState().error,/Conflicting/);
});

test('acknowledgement storage failure retains the queued report and exposes an error',async()=>{
  const f=await setup();await f.client.enqueue(report());await f.client.sync();f.setMode('online');
  const client=createOfflineClient({storage:{...f.store,acknowledge:async()=>{throw new Error('Receipt storage unavailable');}},fetcher:f.fetcher});
  await client.setScope(owner);await client.sync();assert.equal(client.getState().pending,1);assert.match(client.getState().error,/storage/i);
});

test('new workspace collections cache offline and never cross account scopes',async()=>{
  const f=await setup();const client=createOfflineClient({storage:f.store,fetcher:async()=>response([{id:'a',team_id:'6390',revision:1}])});await client.setScope(owner);
  await client.api('GET','/assignments');await client.api('GET','/picklists');
  const offline=createOfflineClient({storage:f.store,fetcher:async()=>{throw new Error('Offline');}});await offline.setScope(owner);
  assert.equal((await offline.api('GET','/assignments'))[0].id,'a');assert.equal((await offline.api('GET','/picklists'))[0].revision,1);
  await offline.setScope({userId:'other',teamId:'6390'});await assert.rejects(offline.api('GET','/assignments'),/not downloaded/);
});

test('role cache invalidation removes only current read snapshots and readiness, preserving all reports and other scopes',async()=>{
 const f=await setup();f.setMode('online');await f.client.prepare();
 f.setMode('offline');await f.client.enqueue(report());await f.client.sync();
 await f.store.put('drafts',{key:'draft-keep',value:{answers:{score:9}}});
 await f.store.put('receipts',{key:'receipt-keep',userId:owner.userId,teamId:owner.teamId,store:'submissions',row:report('receipt-keep')});
 await f.store.put('cache',{key:'scouter:6390:/forms?kind=pit',scope:'scouter:6390:',store:'forms',data:[{id:'private'}]});
 await f.store.put('cache',{key:'scouter:6390:/legacy',data:[{id:'legacy-private'}]});
 await f.store.put('cache',{key:'other:6390:/forms',scope:'other:6390:',store:'forms',data:[{id:'other-user'}]});
 await f.store.put('cache',{key:'scouter:63900:/forms',scope:'scouter:63900:',store:'forms',data:[{id:'other-workspace'}]});
 await f.store.put('meta',{key:'other:6390:prepared',at:'other-ready'});
 await f.store.put('meta',{key:'scouter:6390:unrelated',value:'keep'});
 await f.client.invalidateReadCache();
 assert.equal(f.client.getState().readyAt,null);assert.equal(f.client.getState().pending,1);
 assert.deepEqual((await f.store.all('cache')).map(row=>row.key).sort(),['other:6390:/forms','scouter:63900:/forms']);
 assert.equal(await f.store.get('meta','scouter:6390:prepared'),undefined);
 assert.equal((await f.store.get('meta','other:6390:prepared')).at,'other-ready');
 assert.equal((await f.store.get('meta','scouter:6390:unrelated')).value,'keep');
 assert.deepEqual((await f.store.get('queue','report-1')).row,report());
 assert.equal((await f.store.get('receipts','receipt-keep')).row.id,'receipt-keep');
 assert.equal((await f.store.get('drafts','draft-keep')).value.answers.score,9);
 await assert.rejects(f.client.api('GET','/forms'),/not downloaded/);
 await f.client.setScope(null);await f.client.invalidateReadCache();
 assert.equal((await f.store.all('cache')).length,2);
});

test('a GET started before role invalidation cannot restore or return its old privileged data',async()=>{
 const f=await setup();let release;
 const client=createOfflineClient({storage:f.store,fetcher:()=>new Promise(resolve=>{release=()=>resolve(response([{id:'privileged'}]));})});await client.setScope(owner);
 const pendingRead=client.api('GET','/submissions');
 await client.invalidateReadCache();release();
 await assert.rejects(pendingRead,/changed|invalidated/i);
 assert.equal((await f.store.all('cache')).length,0);
});

test('a release change rejects uncached in-flight reads even after switching accounts',async()=>{
 const f=await setup();let release;
 const client=createOfflineClient({storage:f.store,fetcher:()=>new Promise(resolve=>{release=()=>resolve(response([{id:'old-release'}]));})});
 await client.setScope(owner);
 const pendingRead=client.api('GET','/submissions');
 await client.setScope({userId:'other',teamId:'42'});
 await client.invalidateForRelease('release-new');release();
 await assert.rejects(pendingRead,/changed|invalidated/i);
 assert.equal((await f.store.all('cache')).length,0);
});

test('download preparation started under an old role cannot recreate snapshots or readiness',async()=>{
 const f=await setup(),releases=[];
 const client=createOfflineClient({storage:f.store,fetcher:()=>new Promise(resolve=>{releases.push(()=>resolve(response([{id:'old-role-record'}])));})});await client.setScope(owner);
 const preparing=client.prepare();assert.ok(releases.length>0);
 await client.invalidateReadCache();releases.forEach(release=>release());await preparing;
 assert.equal((await f.store.all('cache')).length,0);
 assert.equal(await f.store.get('meta','scouter:6390:prepared'),undefined);
 assert.equal(client.getState().readyAt,null);
});

test('new releases invalidate all read snapshots and readiness but preserve drafts, uploads and receipts',async()=>{
 const f=await setup();
 await f.store.put('cache',{key:'scouter:6390:/forms',scope:'scouter:6390:',store:'forms',data:[{id:'old'}]});
 await f.store.put('cache',{key:'other:42:/forms',scope:'other:42:',store:'forms',data:[{id:'old-other'}]});
 await f.store.put('meta',{key:'scouter:6390:prepared',at:'old'});
 await f.store.put('drafts',{key:'keep-draft',value:{answers:{score:0}}});
 await f.client.enqueue(report('keep-queued'));
 await f.store.put('receipts',{key:'keep-receipt',row:report('keep-receipt'),userId:owner.userId,teamId:owner.teamId,store:'submissions'});
 assert.equal(await f.client.invalidateForRelease('release-a'),true);
 assert.equal((await f.store.all('cache')).length,0);assert.equal(await f.store.get('meta','scouter:6390:prepared'),undefined);
 assert.ok(await f.store.get('drafts','keep-draft'));assert.equal((await f.store.all('queue')).length,1);assert.equal((await f.store.all('receipts')).length,1);
 await f.store.put('cache',{key:'fresh',scope:'scouter:6390:',store:'forms',data:[]});
 assert.equal(await f.client.invalidateForRelease('release-a'),false);assert.ok(await f.store.get('cache','fresh'));
 assert.equal(await f.client.invalidateForRelease('release-b'),true);assert.equal((await f.store.all('cache')).length,0);
});
