import test from 'node:test';
import assert from 'node:assert/strict';
import {assignedTeamNumbers,filterReports,reportQuestions,reportsCsv} from './history-model.js';
import {summarizeReportFields} from './analytics.js';
const forms=[{id:'f',title:'Match',questions:[{id:'n',text:'Pieces',type:'number'},{id:'note',text:'Notes',type:'text'},{id:'photo',text:'Photo',type:'photo'},{id:'choice',text:'Mode',type:'select'}]}];
const report=(id,patch={})=>({id,form_id:'f',form_title:'Match',team_id:'w',event_key:'e',match_key:'e_qm1',scouted_team:1,report_kind:'match',answers:{n:0,note:'Stable robot',photo:'data:image/png;base64,private',choice:'Fast'},...patch});
test('report browsing separates pit and match forms and preserves reports with no team',()=>{
 const rows=[report('match'),report('pit',{report_kind:'pit'}),report('unassigned',{scouted_team:null})];
 assert.deepEqual(filterReports(rows,{eventKey:'e',reportKind:'pit'},forms).map(r=>r.id),['pit']);
 assert.deepEqual(filterReports(rows,{eventKey:'e',team:'__unassigned__'},forms).map(r=>r.id),['unassigned']);
});
test('old and new team assignments remain scoped, deduplicated and read-only',()=>{
 const event={team_id:'w',event_key:'e',assignment:{u:{username:'Scout',teams:[1,'2',2,'bad']},other:{teams:[9]}}};
 const before=JSON.stringify(event),data={assignments:[{team_id:'w',event_key:'e',scout_user_id:'u',team_number:3},{team_id:'w',event_key:'other',scout_user_id:'u',team_number:4},{team_id:'other',event_key:'e',scout_user_id:'u',team_number:5},{team_id:'w',event_key:'e',scout_user_id:'u',team_number:6,archived_at:'now'}]};
 assert.deepEqual(assignedTeamNumbers(data,event,'u'),['3','1','2']);assert.equal(JSON.stringify(event),before);
});
test('report filters restore answer/question/form/team search without searching media',()=>{
 const rows=[report('a'),report('b',{form_id:'other',scouted_team:2,answers:{note:'Other'}}),report('legacy',{event_key:null})];
 assert.deepEqual(filterReports(rows,{eventKey:'e',formId:'f',team:'1',question:'f:note',answer:'stable'},forms).map(row=>row.id),['a']);
 assert.equal(filterReports(rows,{eventKey:'e',answer:'private'},forms).length,0);
 assert.equal(filterReports(rows,{eventKey:'e',question:'other:note',answer:'stable'},forms).length,0);
 assert.equal(filterReports(rows,{scope:'event'},forms).length,0);
 assert.equal(filterReports(rows,{scope:'legacy'},forms)[0].id,'legacy');assert.equal(filterReports(rows,{scope:'all'},forms).length,3);
});
test('CSV keeps same-ID questions from different forms separate and escapes formulas',()=>{
 const rows=[report('a'),report('b',{form_id:'other',form_title:'Other',questions_snapshot:[{id:'n',text:'Speed',type:'number'}],answers:{n:'=BAD'}})];
 const csv=reportsCsv(rows,forms);assert.ok(csv.includes('Match: Pieces [f:n]'));assert.ok(csv.includes('Other: Speed [other:n]'));assert.ok(csv.includes("'=BAD"));assert.equal(reportQuestions(rows,forms).filter(q=>q.id==='n').length,2);
});
test('CSV neutralizes formulas after whitespace/control prefixes without losing original cell text',()=>{
 const inputs=[' =SUM(1,2)','\t@SUM(A1:A2)','\r\n+CMD','\u0000-2+3','\uFEFF=1+1','=HYPERLINK("https://example.invalid")'];
 for(const input of inputs){
  const csv=reportsCsv([report('formula',{answers:{note:input}})],forms);
  assert.ok(csv.includes(`"'${input.replaceAll('"','""')}"`),JSON.stringify(input));
 }
 for(const input of ['A robot note','42','0','false','line\nnext line']){
  assert.ok(reportsCsv([report('plain',{answers:{note:input}})],forms).includes(`"${input}"`));
 }
 assert.ok(reportsCsv([report('header',{form_title:'\t=BAD',questions_snapshot:[{id:'note',text:'Notes'}],answers:{note:'safe'}})],forms).includes('"\'\t=BAD: Notes [f:note]"'),'Question headers are cells too');
});
test('filtered summaries preserve zero, distinguish missing/invalid and separate pit evidence',()=>{
 const rows=[report('a'),report('b',{answers:{n:10,choice:'Slow'}}),report('c',{match_key:'e_qm2',answers:{n:'invalid'}}),report('d',{answers:{note:'Only notes'}}),report('pit',{report_kind:'pit',answers:{n:100}})];
 const summary=summarizeReportFields(rows,forms),numeric=summary.find(row=>row.questionId==='n'&&row.reportKind==='match');
 assert.equal(numeric.mean,5);assert.equal(numeric.n,1);assert.equal(numeric.missing,1);assert.equal(numeric.invalid,1);assert.equal(numeric.observationCount,2);
 assert.equal(summary.find(row=>row.questionId==='n'&&row.reportKind==='pit').mean,100);
 assert.deepEqual(summary.find(row=>row.questionId==='choice'&&row.reportKind==='match').counts.map(row=>row.percent),[50,50]);
 assert.equal(summarizeReportFields([report('legacy',{event_key:null}),report('legacy2',{event_key:null,answers:{n:10}})],forms).find(row=>row.questionId==='n').n,2,'Unlinked event evidence is never grouped into a fabricated match');
});
