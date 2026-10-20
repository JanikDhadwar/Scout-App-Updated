const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {createIntegrationStore}=require('./integration-store.cjs');
test('private integration settings persist by workspace and never return credentials in status',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'argus-integrations-'));try{const filename=path.join(dir,'argus-integrations.private.json');const store=createIntegrationStore(filename);store.save('team-a',{GROQ_API_KEY:'private-groq',TBA_API_KEY:'private-tba',GROQ_MODEL:'openai/gpt-oss-20b'});assert.equal(store.key('team-a','GROQ_API_KEY'),'private-groq');assert.equal(store.key('team-b','GROQ_API_KEY'),undefined);assert.equal(JSON.stringify(store.status('team-a')).includes('private-groq'),false);assert.equal(createIntegrationStore(filename).key('team-a','TBA_API_KEY'),'private-tba');store.save('team-a',{GROQ_API_KEY:''});assert.equal(store.key('team-a','GROQ_API_KEY'),'private-groq');assert.throws(()=>store.save('team-a',{GROQ_API_KEY:'bad\nheader'}),/invalid/i);assert.equal(store.key('team-a','GROQ_API_KEY'),'private-groq');}finally{fs.rmSync(dir,{recursive:true,force:true});}});

const {checkConnections}=require('./connection-check.cjs');
test('connection checks verify both providers without sending scouting data or leaking errors',async()=>{
 const calls=[];
 const result=await checkConnections({tbaKey:'private-tba',groqKey:'private-groq',fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('groq')?{choices:[{message:{content:'OK'}}]}:{current_season:2026}};}});
 assert.equal(result.tba.state,'working');assert.equal(result.groq.state,'working');assert.equal(calls.length,2);
 const payload=JSON.parse(calls.find(call=>call.url.includes('groq')).options.body);
 assert.equal(payload.messages[0].content,'Connection test. Reply OK.');assert.equal(payload.max_completion_tokens,128);
 assert.ok(!JSON.stringify(result).includes('private-'));
 let count=0;const missing=await checkConnections({fetcher:async()=>{count++;}});
 assert.equal(count,0);assert.equal(missing.tba.state,'missing');assert.equal(missing.groq.state,'missing');
 for(const status of [401,429,500]){const failed=await checkConnections({tbaKey:'key',groqKey:'key',fetcher:async()=>({ok:false,status})});assert.equal(failed.groq.state,'failed');assert.equal(failed.tba.state,'failed');}
 const invalid=await checkConnections({tbaKey:'key',groqKey:'key',fetcher:async()=>({ok:true,json:async()=>({})})});assert.equal(invalid.tba.state,'failed');assert.equal(invalid.groq.state,'failed');
 const unreachable=await checkConnections({tbaKey:'key',fetcher:async()=>{throw Error('private-key in error');}});assert.ok(!JSON.stringify(unreachable).includes('private-key'));
});
