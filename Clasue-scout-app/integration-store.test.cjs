const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {createIntegrationStore}=require('./integration-store.cjs');
test('private event keys persist while retired AI settings are ignored and never advertised',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'argus-integrations-'));
 try{const filename=path.join(dir,'private.json');fs.writeFileSync(filename,JSON.stringify({'team-a':{GROQ_API_KEY:'old-private-key'}}));const store=createIntegrationStore(filename);
 store.save('team-a',{TBA_API_KEY:'private-tba',GROQ_API_KEY:'new-ignored-key'});
 assert.equal(store.key('team-a','GROQ_API_KEY'),'old-private-key','Preserve old private file fields without using them.');
 assert.equal(store.status('team-a').groqConfigured,false);assert.ok(!JSON.stringify(store.status('team-a')).includes('private'));
 assert.equal(createIntegrationStore(filename).key('team-a','TBA_API_KEY'),'private-tba');assert.equal(store.key('team-b','TBA_API_KEY'),undefined);
 assert.throws(()=>store.save('team-a',{TBA_API_KEY:'bad\nheader'}),/invalid/i);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
const {checkConnections}=require('./connection-check.cjs');
test('connection checks never contact AI even when a legacy key is supplied',async()=>{
 const calls=[];const result=await checkConnections({tbaKey:'private-tba',groqKey:'legacy',fetcher:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({current_season:2099})};}});
 assert.equal(calls.length,1);assert.ok(calls[0].url.startsWith('https://www.thebluealliance.com/'));assert.equal(result.tba.state,'working');assert.equal(result.groq.state,'disabled');assert.ok(!JSON.stringify(result).includes('private'));
 const missing=await checkConnections({groqKey:'legacy',fetcher:()=>assert.fail('No requests without an event key')});assert.equal(missing.tba.state,'missing');
 for(const status of [401,429,500])assert.equal((await checkConnections({tbaKey:'key',fetcher:async()=>({ok:false,status})})).tba.state,'failed');
 assert.equal((await checkConnections({tbaKey:'key',fetcher:async()=>({ok:true,json:async()=>({})})})).tba.state,'failed');
 const failed=await checkConnections({tbaKey:'key',fetcher:async()=>{throw Error('secret');}});assert.ok(!JSON.stringify(failed).includes('secret'));
});
