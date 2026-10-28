const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {runReadinessLoad}=require('../scripts/readiness-load.cjs');

test('readiness workload isolates teams and reconciles acknowledged retries using only its own disposable server',async()=>{
 const result=await runReadinessLoad({teams:2,scoutsPerTeam:2,reportsPerScout:3,seedReports:2,concurrency:3});
 assert.equal(result.workload.newReports,12);
 assert.equal(result.integrity.expectedReports,16);
 assert.equal(result.integrity.actualReports,16);
 assert.equal(result.integrity.duplicateIds,0);
 assert.equal(result.integrity.crossTeamLeaks,0);
 assert.equal(result.integrity.conflictsRejected,4);
 assert.equal(result.integrity.identicalRetriesConfirmed,4);
 assert.equal(result.errors.length,0);
 assert.equal(result.environment.synthetic,true);
 assert.match(result.environment.baseURL,/^http:\/\/127\.0\.0\.1:\d+$/);
 assert.equal(JSON.parse(fs.readFileSync(result.artifactFile,'utf8')).integrity.actualReports,16);
});

test('readiness workload refuses caller-supplied targets and unbounded workloads before spawning',async()=>{
 for(const options of [{baseURL:'https://6390scout.app'},{dbFile:'db.json'},{output:'db.json'},{teams:10001},{concurrency:0},{reportsPerScout:-1}]){
  await assert.rejects(()=>runReadinessLoad(options),/option|range|integer/i);
 }
});
