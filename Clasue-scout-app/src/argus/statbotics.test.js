import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStatboticsTeam } from './analytics.js';
import service from '../../statbotics-service.cjs';

const row={team:254,year:2026,name:'Example',epa:{total_points:42.5,ranks:{total:{rank:3,team_count:4000}}},record:{count:20,wins:15,losses:5,ties:0}};
test('external season ratings preserve missing values, zero, and upstream ranks',()=>{
 assert.deepEqual(normalizeStatboticsTeam(row),{team:254,year:2026,name:'Example',epa:42.5,rank:3,total:4000,matches:20,wins:15,losses:5,ties:0});
 assert.equal(normalizeStatboticsTeam({...row,epa:{total_points:{mean:0}}}).epa,0);
 assert.equal(normalizeStatboticsTeam({...row,epa:{total_points:null}}).epa,null);
 assert.equal(normalizeStatboticsTeam({...row,team:'invalid'}),null);
});
test('rankings requests are bounded, cached, coalesced, and never fabricate data on failure',async()=>{
 let calls=0,url;const client=service.createStatboticsClient({fetcher:async value=>{calls++;url=value;return {ok:true,json:async()=>[row]};}});
 const [a,b]=await Promise.all([client.rankings({year:'2026',offset:'0'}),client.rankings({year:'2026',offset:'0'})]);
 assert.equal(calls,1);assert.deepEqual(a,b);assert.equal(a.rows[0].rank,3);assert.match(url,/metric=epa/);assert.match(url,/limit=50/);
 await client.rankings({year:'2026'});assert.equal(calls,1);
 for(const query of [{year:'bad'},{year:'2026',offset:'-1'},{year:'2026',team:'https://evil.test'}])await assert.rejects(()=>client.rankings(query),/valid/);
 const failed=service.createStatboticsClient({fetcher:async()=>({ok:false,status:500})});await assert.rejects(()=>failed.rankings({year:'2026'}),/unavailable/);
 const malformed=service.createStatboticsClient({fetcher:async()=>({ok:true,json:async()=>({})})});await assert.rejects(()=>malformed.rankings({year:'2026'}),/format/);
});
