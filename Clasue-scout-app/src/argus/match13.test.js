import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMatch13Team,normalizeMatch13Prediction,match13PredictionForMatch,match13RegionalRanks} from './analytics.js';
import service from '../../match13-service.cjs';
import integration from '../../integration-store.cjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
test('Match13 key stays in the private integration file, survives a new store and is never returned',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'match13-private-'));const filename=path.join(dir,'connections.json');const store=integration.createIntegrationStore(filename);
 const status=store.save('a',{MATCH13_API_KEY:'m13_live_private'});assert.equal(integration.createIntegrationStore(filename).key('a','MATCH13_API_KEY'),'m13_live_private');assert.equal(store.key('b','MATCH13_API_KEY'),undefined);assert.ok(!JSON.stringify(status).includes('m13_live_private'));
});
test('Match13 ratings retain zero, negative component estimates and unknown fields as missing',()=>{
 const row=normalizeMatch13Team({teamNumber:254,year:2026,xp:203.2,xAuto:0,xTele:202.5,xEnd:-0.2,rank:58});
 assert.equal(row.xp,203.2);assert.equal(row.auto,0);assert.equal(row.endgame,-0.2);assert.equal(row.epa,null);
});
test('Match13 predictions join official matches by key and exact participant set, with blue probability inverted',()=>{
 const row=normalizeMatch13Prediction({key:'2026e_qm1',teams:{1:{},2:{},3:{},4:{},5:{},6:{}},pred:{redScore:0,blueScore:50,winProb:0}});
 const match={key:row.key,alliances:{red:{team_keys:['frc1','frc2','frc3']},blue:{team_keys:['frc4','frc5','frc6']}}};
 assert.equal(match13PredictionForMatch([row],match,4).winProbability,1);
 assert.equal(match13PredictionForMatch([row],match,1).redScore,0);
 assert.equal(match13PredictionForMatch([row],match,99),null);
 assert.equal(match13PredictionForMatch([row],{...match,alliances:{...match.alliances,blue:{team_keys:['frc4','frc5','frc7']}}},4),null);
});
test('regional ranks use rated cohort counts and preserve ties; incomplete location data is labelled',()=>{
 const ratings=[{team:1,rank:1},{team:2,rank:1},{team:3,rank:3}];
 const metadata=[1,2,3].map(team_number=>({team_number,country:'USA',state_prov:team_number===3?'Oregon':'Washington'}));
 const ranks=match13RegionalRanks(ratings,metadata,2,[1,2],'Pacific Northwest');
 assert.equal(ranks.country.rank,1);assert.equal(ranks.country.total,3);assert.equal(ranks.state.total,2);assert.equal(ranks.district.total,2);
 assert.equal(match13RegionalRanks(ratings,metadata.slice(0,2),2).complete,false);
});
test('private Match13 requests use all scope, coalesce cache and never expose key or upstream error body',async()=>{
 let calls=0;const client=service.createMatch13Client({fetcher:async(url,options)=>{calls++;assert.match(url,/scope=all/);assert.equal(options.headers.Authorization,'Bearer private');return {ok:true,json:async()=>({year:2026,teamNumber:254,xp:0})};}});
 const [a,b]=await Promise.all([client.rating('254','2026','private'),client.rating('254','2026','private')]);assert.deepEqual(a,b);assert.equal(calls,1);assert.ok(!JSON.stringify(a).includes('private'));
 await assert.rejects(()=>client.rating('254','2026',''),/Settings/);
 await assert.rejects(()=>client.rating('bad','2026','private'),/valid/);
 const failed=service.createMatch13Client({fetcher:async()=>({ok:false,status:401,json:async()=>({detail:'private'})})});await assert.rejects(()=>failed.rating('254','2026','private'),e=>!e.message.includes('private'));
});
test('Match13 global pages, event forecasts and regional denominators validate complete provider data',async()=>{
 const source=[{teamNumber:1,year:2026,rank:1,xp:5},{teamNumber:2,year:2026,rank:2,xp:0}];
 const client=service.createMatch13Client({fetcher:async(url)=>({ok:true,json:async()=>{
  if(url.includes('/years/2026/teams'))return {year:2026,total:2,nextPage:null,teams:source};
  if(url.includes('/events/2026e/matches'))return {eventKey:'2026e',matches:[{key:'2026e_qm1',teams:{1:{},2:{}},pred:{winProb:0.5,redScore:5,blueScore:0}}]};
  if(url.includes('/teams/2026/0/simple'))return [{team_number:1,country:'USA',state_prov:'WA'},{team_number:2,country:'USA',state_prov:'WA'}];
  if(url.includes('/team/frc2/events/2026/simple'))return [{district:{key:'2026pnw',display_name:'Pacific Northwest'}}];
  if(url.includes('/district/2026pnw/teams/simple'))return [{team_number:2}];
  assert.fail('Unexpected external request');
 }})});
 assert.equal((await client.rankings({year:'2026'},'key')).rows[1].xp,0);
 assert.equal((await client.predictions('2026e','key')).matches[0].blueScore,0);
 const ranks=await client.regions('2','2026','key','tba');assert.equal(ranks.world.total,2);assert.equal(ranks.country.rank,2);assert.equal(ranks.district.total,1);
 const bad=service.createMatch13Client({fetcher:async()=>({ok:true,json:async()=>({year:2026,total:5,nextPage:null,teams:source})})});await assert.rejects(()=>bad.regions('2','2026','key',''),/full global/);
});
