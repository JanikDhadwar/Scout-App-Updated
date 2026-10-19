import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentReports, buildSearchIndex, searchIndex } from './workspace-model.js';

test('assignments complete only from matching submitted records, not unrelated or opened forms',()=>{
 const a={id:'a',team_id:'w',event_key:'e',match_key:'e_qm1',team_number:254,scout_user_id:'u'};
 const r={id:'r',team_id:'w',event_key:'e',match_key:'e_qm1',scouted_team:254,user_id:'u',report_kind:'match'};
 assert.equal(assignmentReports(a,[]).length,0);
 assert.equal(assignmentReports(a,[r,{...r,id:'foreign',team_id:'x'}]).length,1);
 for(const patch of [{event_key:'other'},{user_id:'other'},{scouted_team:1},{match_key:'e_qm2'},{report_kind:'pit'}])assert.equal(assignmentReports(a,[{...r,...patch}]).length,0);
});

test('search indexes only permitted workspace reports and bounds results',()=>{
 const data={submissions:[{id:'mine',team_id:'w',user_id:'u',scouted_team:254,form_title:'Match'},{id:'private',team_id:'w',user_id:'v',form_title:'Secret'},{id:'foreign',team_id:'x',user_id:'u',form_title:'Foreign'}],matches:[]};
 const member=buildSearchIndex({data,workspaceId:'w',userId:'u',role:'member'});
 assert.ok(member.some(item=>item.route==='/reports/mine'));
 assert.ok(!member.some(item=>item.route==='/reports/private'||item.route==='/reports/foreign'));
 assert.equal(searchIndex(member,'SECRET').length,0);
 assert.ok(searchIndex(member,'254').length>0);
 assert.equal(searchIndex(Array.from({length:100},()=>({text:'match',label:'match'})),'match').length,30);
});
