import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentReports, buildSearchIndex, searchIndex, isCompleted, mainDestinations, sidebarDestinations, navigationGroup, utilityDestinations, canSeeDestination } from './workspace-model.js';

test('one scouting destination and a visible presentation destination keep task context',()=>{
 assert.deepEqual(mainDestinations.map(([key])=>key),['dashboard','assignments','teams','present','more']);
 for(const section of ['match','pit','assignments'])assert.equal(navigationGroup(section),'assignments');
 for(const section of ['present','display'])assert.equal(navigationGroup(section),'present');
 for(const section of ['teams','analytics','compare','reports'])assert.equal(navigationGroup(section),'teams');
 assert.equal(navigationGroup('matches'),'matches');
 assert.equal(navigationGroup('strategy'),'strategy');
});

test('pit assignments and unavailable schedule rows have no completed match',()=>{assert.equal(isCompleted(undefined),false);assert.equal(isCompleted(null),false);assert.equal(isCompleted({}),false);});

test('visible task links are unique, secondary tools remain accessible and Admin is role scoped',()=>{
 assert.ok(sidebarDestinations.some(([key])=>key==='present'));
 assert.equal(new Set(sidebarDestinations.map(([key])=>key)).size,sidebarDestinations.length);
 for(const key of ['events','sync','history','practice','display','reports'])assert.ok(utilityDestinations.some(([route])=>route===key));
 assert.equal(canSeeDestination('admin','member'),false);
 assert.equal(canSeeDestination('admin','admin'),true);
 assert.equal(buildSearchIndex({role:'member'}).some(row=>['/admin','/analyst'].includes(row.route)),false);
 assert.ok(![...sidebarDestinations,...utilityDestinations].some(([key])=>key==='analyst'));
});

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
