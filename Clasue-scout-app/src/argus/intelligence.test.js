import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAnalytics,evidenceConfidence} from './analytics.js';
import {presentationSnapshot} from './presentation-model.js';
import {starterTemplates,copyStarterTemplate} from './starter-templates.js';
import {trainingScenarios,trainingFeedback} from './training-scenarios.js';
import {reviewAnswers} from './scouting-review.js';

const questions=[{id:'outcome',text:'Outcome',type:'select',options:['Yes','No','Unknown','No attempt']},{id:'count',text:'Measured count',type:'number'},{id:'note',type:'text',text:'Notes'}];
const forms=[{id:'f',team_id:'w',questions}];
const matches=Array.from({length:12},(_,i)=>({key:`e_qm${i+1}`,comp_level:'qm',match_number:i+1,actual_time:i+1,alliances:{red:{team_keys:['frc1'],score:1},blue:{team_keys:['frc2'],score:0}}}));
const config={'f:outcome':{phase:'auto',insight:{kind:'success_rate',outcomes:{Yes:'success',No:'failure',Unknown:'unknown','No attempt':'not_attempted'},strength:.8,concern:.5}},'f:count':{phase:'teleop',direction:'higher',insight:{kind:'mean',strength:10,concern:4}}};
const report=(n,outcome='Yes',count=10,extra={})=>({id:`r${n}`,team_id:'w',event_key:'e',form_id:'f',report_kind:'match',scouted_team:'1',match_key:`e_qm${n}`,questions_snapshot:questions,answers:{outcome,count,note:'Private context'},created_at:`2026-10-28T12:${String(n).padStart(2,'0')}:00Z`,...extra});
const build=(reports,options={})=>buildAnalytics({forms,reports,event:{event_key:'e',analytics_config:config},teams:[{team_number:1}],matches:matches.slice(0,Math.max(1,reports.length)),scope:{teamId:'w',eventKey:'e'},...options});

test('three distinct usable matches are required; unknowns and non-attempts never fail',()=>{
 const a=build([report(1),report(2),report(3,'Unknown'),report(4,'No attempt')]).teams[0];
 assert.equal(a.intelligence.strengths.some(row=>row.metricId==='f:outcome'),false);
 const outcome=a.intelligence.observations.find(row=>row.metricId==='f:outcome');
 assert.equal(outcome.value,1);assert.equal(outcome.denominator,2);
 assert.equal(build([report(1),report(2),report(3)]).teams[0].intelligence.strengths.length,2);
});
test('categorical disputes are excluded while numeric duplicates use one median and expose sources',()=>{
 const team=build([report(1,'Yes',0),report(1,'No',4,{id:'duplicate'}),report(2,'Yes',8),report(3,'Yes',12)]).teams[0];
 const outcome=team.intelligence.observations.find(row=>row.id==='f:outcome'),count=team.intelligence.observations.find(row=>row.id==='f:count');
 assert.equal(outcome.denominator,2);assert.equal(outcome.disagreements,1);
 assert.equal(count.values[0].value,2);assert.equal(count.matchCount,3);assert.deepEqual(count.values[0].sourceIds,['r1','duplicate']);
 assert.ok(count.confidence.reasons.some(reason=>reason.includes('disagreements')));
});
test('confidence bands, penalties, caps and unknown evidence are exact',()=>{
 for(const [n,label] of [[0,'Insufficient information'],[1,'Preliminary'],[2,'Preliminary'],[3,'Limited'],[4,'Limited'],[5,'Moderate'],[7,'Moderate'],[8,'Strong']])assert.equal(evidenceConfidence({n}).label,label);
 assert.equal(evidenceConfidence({n:8,missingRate:.2}).label,'Strong');
 assert.equal(evidenceConfidence({n:8,missingRate:.21,disagreements:1,staleMatches:2}).label,'Preliminary');
 assert.equal(evidenceConfidence({n:8,subjective:true}).label,'Moderate');
 assert.equal(evidenceConfidence({n:8,knownSchedule:false}).label,'Moderate');
});
test('threshold boundaries, invalid values and duplicate missing answers cannot invent concerns',()=>{
 const good=build([report(1),report(2),report(3),report(4),report(5,'No')]).teams[0].intelligence.observations.find(row=>row.id==='f:outcome');
 assert.equal(good.value,.8);assert.equal(good.classification,'strength');
 const half=build([report(1,'No'),report(2),report(3,'No'),report(4)]).teams[0].intelligence.observations.find(row=>row.id==='f:outcome');assert.equal(half.classification,'observation');
 const rows=[report(1),report(2),report(3),report(3,'Yes',10,{id:'blank',answers:{}})];
 const metric=build(rows).teams[0].intelligence.observations.find(row=>row.id==='f:count');assert.equal(metric.missingMatches,0);assert.equal(metric.matchCount,3);
 const bad=build([report(1,'Yes','bad'),report(2,'Yes',''),report(3,'Yes',null)]).teams[0].intelligence.observations.find(row=>row.id==='f:count');assert.equal(bad.value,null);assert.equal(bad.classification,'observation');
});
test('last match follows schedule rather than late upload; comparisons exclude the selected match',()=>{
 const rows=[report(4,'Yes',16),report(2,'Yes',8,{created_at:'2099-01-01'}),report(1,'Yes',4),report(3,'Yes',12)];
 const intel=build(rows).teams[0].intelligence;
 assert.equal(intel.lastMatch.matchKey,'e_qm4');
 const trend=intel.observations.find(row=>row.id==='f:count').trend;
 assert.equal(trend.previousCount,3);assert.equal(trend.previousMean,8);assert.equal(trend.delta,8);assert.equal(trend.eventMean,10);assert.equal(trend.preliminary,false);
});
test('pit, legacy, quarantined and foreign evidence never increases usable match counts',()=>{
 const rows=[report(1),report(2),report(3,'No',0,{report_kind:'pit'}),report(4,'No',0,{event_key:null}),report(5,'No',0,{quality_review_required:true}),report(6,'No',0,{team_id:'other'})];
 const intel=build(rows).teams[0].intelligence;assert.equal(intel.observations.find(row=>row.id==='f:outcome').matchCount,2);assert.equal(intel.strengths.length,0);
});
test('presentation snapshots omit identities, photos and notes by default and never mutate analytics',()=>{
 const a=build([report(1,'Yes',10,{submitted_by:'PRIVATE_SCOUT',user_id:'private-id',answers:{outcome:'Yes',count:10,note:'PRIVATE_NOTE',photo:'data:image/png;base64,PRIVATE_PHOTO'}})]);
 const snapshot=presentationSnapshot(a),text=JSON.stringify(snapshot);
 for(const secret of ['PRIVATE_SCOUT','private-id','PRIVATE_NOTE','PRIVATE_PHOTO'])assert.ok(!text.includes(secret),secret);
 assert.ok(JSON.stringify(a).includes('PRIVATE_NOTE'));
 assert.ok(JSON.stringify(presentationSnapshot(a,{includeNotes:true})).includes('PRIVATE_NOTE'));
});
test('starter copies are independent, season-neutral and do not overwrite template IDs',()=>{
 for(const template of starterTemplates){const first=copyStarterTemplate(template,'w'),second=copyStarterTemplate(template,'w');assert.notEqual(first.id,second.id);assert.ok(first.questions.every((q,i)=>q.id!==template.questions[i].id&&q.id!==second.questions[i].id));first.questions[0].text='Changed';assert.notEqual(template.questions[0].text,'Changed');assert.equal(first.guidance_mode,'guided');}
});
test('guided feedback uses known answers and review respects zero and explicit comparisons',()=>{
 const scenario=trainingScenarios[0];assert.ok(trainingFeedback(scenario,{}).every(row=>!row.answered));assert.ok(trainingFeedback(scenario,Object.fromEntries(scenario.questions.map(q=>[q.id,q.answer]))).every(row=>row.correct));
 const qs=[{id:'a',type:'number',text:'Attempts'},{id:'b',type:'number',text:'Successes',review_greater_than:'a'}];assert.equal(reviewAnswers(qs,{a:0,b:0}).length,0);assert.match(reviewAnswers(qs,{a:1,b:2})[0],/exceeds/);
});

test('snapshot numeric ranges apply consistently to statistics and intelligence, without guessing match chronology',()=>{
 const snapshot=[{id:'count',text:'Count',type:'number',min:0,max:10}];
 const a=build([report(1,'Yes',50,{questions_snapshot:snapshot}),report(2,'Yes',0,{questions_snapshot:snapshot}),report(3,'Yes',2,{questions_snapshot:snapshot})]);
 assert.equal(a.teams[0].metrics['f:count'].mean,1);assert.equal(a.teams[0].metrics['f:count'].invalid,1);
 assert.equal(a.teams[0].intelligence.observations.find(row=>row.id==='f:count').value,1);
 const unknown=build([report(1,'Yes',10,{created_at:null})],{matches:[]});assert.equal(unknown.teams[0].intelligence.lastMatch,null);
});
