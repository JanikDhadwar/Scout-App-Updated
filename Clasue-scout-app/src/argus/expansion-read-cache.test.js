import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {createOfflineStore} from '../offline-store.js';
import {createOfflineClient} from '../offline-client.js';

const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
test('forecasts survive reload and provider outages only within their original account scope',async()=>{
 const storage=createOfflineStore('forecasts-v1',new IDBFactory()),owner={userId:'u',teamId:'w'};
 const forecast={event:'2026qa',fetched_at:'2026-10-28T12:00:00Z',matches:[{key:'2026qa_qm1',redScore:0}],alliance_snapshot:{'2026qa_qm1':[['frc1'],['frc2']]}};
 const path='/match13/predictions?workspaceId=w&event=2026qa';
 const online=createOfflineClient({storage,fetcher:async()=>response(forecast)});await online.setScope(owner);await online.api('GET',path);
 const offline=createOfflineClient({storage,fetcher:async()=>response({error:'Provider unavailable'},503)});await offline.setScope(owner);
 const cached=await offline.api('GET',path);assert.equal(cached.cached,true);assert.equal(cached.fetched_at,forecast.fetched_at);assert.equal(cached.matches[0].redScore,0);
 await offline.setScope({userId:'other',teamId:'w'});await assert.rejects(offline.api('GET',path),/not downloaded/);
});
test('clearing downloaded views retains drafts, queue, receipts and other accounts',async()=>{
 const storage=createOfflineStore('clear-views-v1',new IDBFactory()),client=createOfflineClient({storage,fetcher:async()=>{throw new TypeError('offline');}});
 await client.setScope({userId:'u',teamId:'w'});
 for(const scope of ['u:w:','u:another:','other:w:'])await storage.put('cache',{key:`${scope}/submissions`,scope,data:[]});
 await storage.put('meta',{key:'u:w:prepared',at:'now'});
 await storage.put('drafts',{key:'u:w:f',value:{answers:{n:0}}});
 await storage.put('queue',{key:'pending',userId:'u',teamId:'w',store:'submissions',row:{id:'pending'}});
 await storage.put('receipts',{key:'confirmed',userId:'u',teamId:'w',row:{id:'confirmed'}});
 await client.clearDownloadedReadData();
 assert.deepEqual((await storage.all('cache')).map(row=>row.key),['other:w:/submissions']);
 for(const store of ['drafts','queue','receipts'])assert.equal((await storage.all(store)).length,1);
 assert.equal(client.getState().readyAt,null);assert.equal(client.getState().pending,1);
});
