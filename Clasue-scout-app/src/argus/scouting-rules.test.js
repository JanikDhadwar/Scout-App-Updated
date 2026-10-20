import test from 'node:test';
import assert from 'node:assert/strict';
import rules from '../../scouting-rules.cjs';
import {assignmentReports} from './workspace-model.js';
const event={id:'e',team_id:'w',event_key:'2026e',event_teams:Array.from({length:11},(_,i)=>({team_number:i+1})),matches:[1,2].map(i=>({key:`2026e_qm${i}`,match_number:i,alliances:{red:{team_keys:['frc1','frc2','frc3'],score:-1},blue:{team_keys:['frc4','frc5','frc6'],score:-1}}}))};
test('random pit assignments balance teams, preserve existing rows, and fill only gaps',()=>{
 const added=rules.generateAssignments({event,scoutIds:['a','b','c'],kind:'pit',formId:'p'});
 assert.equal(added.length,11);assert.equal(new Set(added.map(row=>row.team_number)).size,11);
 const loads=['a','b','c'].map(id=>added.filter(row=>row.scout_user_id===id).length);assert.ok(Math.max(...loads)-Math.min(...loads)<=1);
 assert.equal(rules.generateAssignments({event,scoutIds:['a','b','c'],kind:'pit',formId:'p',existing:added}).length,0);
 assert.ok(added.every(row=>row.report_kind==='pit'&&row.match_key===null));
});
test('match assignments avoid simultaneous robots per scout and exclude completed matches',()=>{
 assert.throws(()=>rules.generateAssignments({event,scoutIds:['a'],kind:'match',formId:'m'}),/enough scouts/);
 const added=rules.generateAssignments({event,scoutIds:['a','b','c','d','e','f'],kind:'match',formId:'m'});assert.equal(added.length,12);
 for(const match of event.matches)assert.equal(new Set(added.filter(row=>row.match_key===match.key).map(row=>row.scout_user_id)).size,6);
 assert.equal(rules.generateAssignments({event:{...event,matches:event.matches.map(row=>({...row,actual_time:123}))},scoutIds:['a'],kind:'match',formId:'m'}).length,0);
});
test('submission limits apply across scouts but stay scoped to form, workspace and event',()=>{
 const form={id:'p',allow_team_select:true,max_submissions_per_team:1},report={id:'r',form_id:'p',team_id:'w',scouted_team:1,event_key:'e',user_id:'a'};
 assert.equal(rules.submissionError(form,report,[]),null);
 assert.match(rules.submissionError(form,{...report,user_id:'b'},[report]),/limit of 1/);
 for(const patch of [{form_id:'other'},{team_id:'other'},{event_key:'other'},{scouted_team:2}])assert.equal(rules.submissionError(form,report,[{...report,...patch}]),null);
 assert.match(rules.submissionError(form,{...report,scouted_team:null},[]),/Select/);
});
test('pit assignment completion requires a matching pit report',()=>{
 const a={team_id:'w',event_key:'e',scout_user_id:'a',team_number:1,report_kind:'pit',match_key:null};
 const report={team_id:'w',event_key:'e',user_id:'a',scouted_team:1,report_kind:'pit',match_key:null};
 assert.equal(assignmentReports(a,[report]).length,1);assert.equal(assignmentReports(a,[{...report,report_kind:'match'}]).length,0);
});
