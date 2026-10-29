import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createMatch13Client}=require('../../match13-service.cjs');
test('forecast cache retains actual retrieval time and its original ordered alliance binding',async()=>{
 let now=Date.parse('2026-10-28T12:00:00Z'),calls=0;
 const client=createMatch13Client({clock:()=>now,fetcher:async()=>{calls++;return{ok:true,json:async()=>({eventKey:'2026qa',matches:[{key:'2026qa_qm1',teams:{1:{},2:{}},pred:{redScore:0,blueScore:2,winProb:0}}]})};}});
 const schedule=[{key:'2026qa_qm1',alliances:{red:{team_keys:['frc1']},blue:{team_keys:['frc2']}}}];
 const first=await client.predictions('2026qa','key',schedule);now+=60000;
 const swapped=[{key:'2026qa_qm1',alliances:{red:{team_keys:['frc2']},blue:{team_keys:['frc1']}}}];
 const second=await client.predictions('2026qa','key',swapped);
 assert.equal(calls,1);assert.equal(first.fetched_at,second.fetched_at);assert.deepEqual(second.alliance_snapshot[first.matches[0].key],[['frc1'],['frc2']]);
 now+=60001;const third=await client.predictions('2026qa','key',swapped);assert.equal(calls,2);assert.notEqual(third.fetched_at,first.fetched_at);assert.deepEqual(third.alliance_snapshot[first.matches[0].key],[['frc2'],['frc1']]);
});

test('known exhausted quota windows and oversized provider bodies are respected without additional calls',async()=>{
 let now=Date.parse('2026-10-28T12:00:00Z'),calls=0;
 const client=createMatch13Client({clock:()=>now,fetcher:async()=>{calls++;return{ok:true,headers:{get:name=>name==='x-ratelimit-remaining'?'0,5,8':name==='x-ratelimit-reset'?'60,300,600':null},json:async()=>({teamNumber:1,year:2026,xp:0})};}});
 await client.rating(1,2026,'key');await assert.rejects(client.rating(2,2026,'key'),/usage limit/);assert.equal(calls,1);now+=60001;await client.rating(1,2026,'key');assert.equal(calls,1,'Valid cached data need not use provider quota');
 const oversized=createMatch13Client({fetcher:async()=>({ok:true,headers:{get:name=>name==='content-length'?'9999999':null},json:async()=>{throw Error('Must not decode oversized body');}})});
 await assert.rejects(oversized.rating(1,2026,'key'),/unexpected format/);
});
