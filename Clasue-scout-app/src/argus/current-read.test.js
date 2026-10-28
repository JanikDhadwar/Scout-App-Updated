import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {createOfflineStore} from '../offline-store.js';
import {createOfflineClient,RequestError} from '../offline-client.js';
import {readCurrent} from './current-read.js';

const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const response=data=>({ok:true,status:200,json:async()=>data});

test('a release-invalidated read refetches current authorized data rather than surfacing a stale startup error',async()=>{
 const started=deferred(),gate=deferred();let reads=0;
 const storage=createOfflineStore('current-release-read',new IDBFactory());
 const client=createOfflineClient({storage,fetcher:async()=>{if(++reads===1){started.resolve();await gate.promise;return response([{id:'old-private'}]);}return response([{id:'current-authorized'}]);}});
 await client.setScope({userId:'scout',teamId:'team'});
 const request=readCurrent(client.api,'/assignments');await started.promise;await client.invalidateForRelease('new-build');gate.resolve();
 assert.deepEqual(await request,[{id:'current-authorized'}]);assert.equal(reads,2);
 assert.deepEqual((await storage.all('cache')).map(row=>row.data),[[{id:'current-authorized'}]]);
});

test('role-invalidated in-flight evidence is discarded and permission denials are never retried',async()=>{
 const started=deferred(),gate=deferred();let reads=0;
 const storage=createOfflineStore('current-role-read',new IDBFactory());
 const client=createOfflineClient({storage,fetcher:async()=>{if(++reads===1){started.resolve();await gate.promise;return response([{id:'owner-only'}]);}return{ok:false,status:403,json:async()=>({error:'Member permission only'})};}});
 await client.setScope({userId:'scout',teamId:'team'});
 const request=readCurrent(client.api,'/submissions');await started.promise;await client.invalidateReadCache();gate.resolve();
 await assert.rejects(request,error=>error.status===403);assert.equal(reads,2);assert.deepEqual(await storage.all('cache'),[]);
 let denied=0;await assert.rejects(readCurrent(async()=>{denied++;throw new RequestError('Permission denied',403);},'/submissions'),error=>error.status===403);assert.equal(denied,1);
});

test('ordinary conflicts are not retried and repeated access invalidation stops after one fresh attempt',async()=>{
 let ordinary=0;await assert.rejects(readCurrent(async()=>{ordinary++;throw new RequestError('Record changed',409);},'/assignments'),/Record changed/);assert.equal(ordinary,1);
 let invalidations=0;await assert.rejects(readCurrent(async()=>{invalidations++;throw Object.assign(new RequestError('Read access changed. Reload data for your current role.',409),{code:'READ_ACCESS_CHANGED'});},'/assignments'),error=>error.code==='READ_ACCESS_CHANGED');assert.equal(invalidations,2);
});

test('an invalidated read cannot retry in another account or workspace scope',async()=>{
 const started=deferred(),gate=deferred();let reads=0;
 const client=createOfflineClient({storage:createOfflineStore('current-scope-read',new IDBFactory()),fetcher:async()=>{reads++;started.resolve();await gate.promise;return response([{id:'old-account'}]);}});
 await client.setScope({userId:'original',teamId:'team'});const request=readCurrent(client.api,'/submissions');await started.promise;await client.invalidateReadCache();await client.setScope({userId:'different',teamId:'other'});gate.resolve();
 await assert.rejects(request,error=>error.code==='READ_SCOPE_CHANGED');assert.equal(reads,1);
});
