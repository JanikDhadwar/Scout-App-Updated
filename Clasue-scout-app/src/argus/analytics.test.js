import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnalytics, answerQuestion, presentationSections, eventMetricDistribution } from './analytics.js';

const forms = [{id:'f',team_id:'w',title:'Match',questions:[{id:'n',text:'Pieces',type:'number'},{id:'b',text:'Climbed',type:'boolean'},{id:'conditional',text:'Detail',type:'number',visibility:{rules:[{questionId:'b',operator:'equals',value:'Yes'}]}}]}];
const event = {event_key:'e',event_name:'Event',event_teams:[{team_number:254,nickname:'Test'}],analytics_config:{'f:n':{phase:'auto',unit:'pieces',direction:'higher'}}};
const report=(id,answers,extra={})=>({id,team_id:'w',form_id:'f',scouted_team:254,event_key:'e',created_at:'2026-01-01T00:00:00Z',answers,...extra});
const build=(reports,extra={})=>buildAnalytics({forms,reports,event,scope:{teamId:'w',eventKey:'e'},asOf:'2026-01-02T00:00:00Z',...extra});

test('dashboard distribution has numeric bounds and only linked match medians, including zero',()=>{
 const analytics=build([report('zero',{n:0},{match_key:'e_qm1'}),report('five',{n:5},{match_key:'e_qm2'}),report('pit',{n:100},{report_kind:'pit',match_key:'e_qm3'}),report('unlinked',{n:999})]);
 const distribution=eventMetricDistribution(analytics,'f:n');assert.equal(distribution.min,0);assert.equal(distribution.max,5);assert.equal(distribution.values.length,2);assert.deepEqual(distribution.values.flatMap(row=>row.sourceIds),['zero','five']);
});
test('scope excludes other workspaces and keeps legacy evidence separate',()=>{
 const a=build([report('a',{n:0}),report('legacy',{n:100},{event_key:null}),report('foreign',{n:999},{team_id:'other'}),report('other-event',{n:50},{event_key:'other'})]);
 const t=a.teams[0];assert.equal(t.reportCount,1);assert.equal(t.unlinkedReportCount,1);assert.equal(t.metrics['f:n'].mean,0);assert.deepEqual(t.metrics['f:n'].sourceIds,['a']);
});
test('missing, invalid and conditional inapplicability never become zero',()=>{
 const t=build([report('a',{n:0,b:'No'}),report('b',{n:'2',b:'Yes',conditional:4}),report('c',{n:'bad',b:'No'}),report('d',{n:'',b:'No'})]).teams[0];
 assert.equal(t.metrics['f:n'].mean,1);assert.equal(t.metrics['f:n'].n,2);assert.equal(t.metrics['f:n'].invalid,1);assert.equal(t.metrics['f:n'].missing,1);assert.equal(t.metrics['f:conditional'].eligible,1);assert.equal(t.metrics['f:conditional'].mean,4);
});
test('match coverage uses completed team schedule and disagreement exposes duplicated observations',()=>{
 const matches=[{key:'e_qm1',actual_time:1,alliances:{red:{team_keys:['frc254']},blue:{team_keys:[]}}},{key:'e_qm2',actual_time:2,alliances:{red:{team_keys:['frc254']}}},{key:'e_qm3',alliances:{red:{team_keys:['frc254']}}}];
 const t=build([report('a',{n:2},{match_key:'e_qm1'}),report('b',{n:4},{match_key:'e_qm1'})],{matches}).teams[0];
 assert.equal(t.matchCount,1);assert.equal(t.confidence.expectedMatches,2);assert.equal(t.confidence.coveragePercent,50);assert.equal(t.confidence.disagreements.length,1);assert.equal(t.metrics['f:n'].mean,3);assert.equal(t.metrics['f:n'].n,1);assert.equal(t.metrics['f:n'].observationCount,2);
});
test('unknown schedule produces unknown coverage and no invented phase points',()=>{
 const a=build([report('a',{n:3})]);const t=a.teams[0];assert.equal(t.confidence.coveragePercent,null);assert.equal(t.matchCount,0);assert.equal(a.metrics.find(m=>m.id==='f:b').phase,null);assert.equal(presentationSections(a,t).length,7);
});
test('analyst returns deterministic evidence and insufficient-data answers',()=>{
 const a=build([report('a',{n:3})]);const answer=answerQuestion('Summarize team 254',a);assert.ok(answer.sourceIds.includes('a'));assert.match(answer.text,/254/);assert.equal(answerQuestion('Who will win the world championship?',a).kind,'insufficient');
});

test('match trends follow the official schedule instead of report upload order',()=>{
 const matches=[{key:'e_qm1',match_number:1,comp_level:'qm',predicted_time:100,alliances:{red:{team_keys:['frc254']}}},{key:'e_qm2',match_number:2,comp_level:'qm',predicted_time:200,alliances:{red:{team_keys:['frc254']}}}];
 const t=build([report('late',{n:1},{match_key:'e_qm1',created_at:'2026-01-03'}),report('early',{n:8},{match_key:'e_qm2',created_at:'2026-01-01'})],{matches}).teams[0];
 assert.deepEqual(t.metrics['f:n'].values.map(v=>v.matchKey),['e_qm1','e_qm2']);
});

test('snapshot questions remain usable after a template is removed and media stays out of analyst text',()=>{
 const a=build([report('photo',{n:4,photo:'data:image/png;base64,private',notes:'Check chain tension'},{questions_snapshot:[{id:'n',type:'number',text:'Pieces'},{id:'photo',type:'photo',text:'Robot photo'},{id:'notes',type:'text',text:'Scout notes'}]})],{forms:[]});
 assert.equal(a.teams[0].metrics['f:n'].mean,4);
 assert.ok(presentationSections(a,a.teams[0]).some(section=>section.lines.some(line=>line.includes('Check chain tension'))));
 assert.ok(!JSON.stringify(answerQuestion('Summarize team 254',a)).includes('base64'));
});

test('confidence and presentation use separate missing and invalid counts with no fabricated best score',()=>{
 const a=build([report('a',{n:'bad'}),report('b',{})]);const t=a.teams[0];
 assert.equal(t.metrics['f:n'].n,0);assert.equal(t.metrics['f:n'].mean,null);
 assert.equal(t.confidence.invalidObservations,1);
 assert.ok(presentationSections(a,t).every(section=>section.sourceIds.every(id=>['a','b'].includes(id))));
});

test('pit reports never inflate match coverage or performance, while retaining their capabilities and notes',()=>{
 const questions_snapshot=[...forms[0].questions,{id:'note',type:'text',text:'Pit notes'},{id:'photo',type:'photo',text:'Robot photo'}];
 const matches=[{key:'e_qm1',actual_time:1,alliances:{red:{team_keys:['frc254']}}},{key:'e_qm2',actual_time:2,alliances:{red:{team_keys:['frc254']}}}];
 const a=build([report('pit',{n:900,b:'Yes',note:'Swerve confirmed',photo:'data:image/png;base64,robot'},{report_kind:'pit',match_key:'e_qm1',questions_snapshot}),report('match',{n:2},{report_kind:'match',match_key:'e_qm2'})],{matches});
 const t=a.teams[0];assert.equal(t.reportCount,2);assert.equal(t.pitReportCount,1);assert.equal(t.matchCount,1);assert.equal(t.matchedReportCount,1);assert.equal(t.confidence.coveragePercent,50);
 assert.equal(t.metrics['f:n'].mean,2);assert.deepEqual(t.metrics['f:n'].sourceIds,['match']);assert.equal(t.pitMetrics['f:n'].mean,900);assert.equal(t.pitMetrics['f:n'].values[0].matchKey,null);
 assert.deepEqual(t.pitMetrics['f:b'].counts,[{value:'Yes',count:1}]);assert.ok(t.notes.some(note=>note.value==='Swerve confirmed' && note.reportKind==='pit'));assert.equal(t.pitMetrics['f:photo'].observations.length,1);
 assert.match(presentationSections(a,t)[0].lines.join(' '),/1 pit report/);
});

test('pit-only scouting leaves completed-match coverage at zero and numeric match averages unavailable',()=>{
 const matches=[{key:'e_qm1',actual_time:1,alliances:{red:{team_keys:['frc254']}}}];
 const t=build([report('pit',{n:100},{report_kind:'pit',match_key:'e_qm1'})],{matches}).teams[0];
 assert.equal(t.metrics['f:n'].mean,null);assert.equal(t.matchCount,0);assert.equal(t.confidence.coveragePercent,0);assert.equal(t.pitMetrics['f:n'].mean,100);
});
