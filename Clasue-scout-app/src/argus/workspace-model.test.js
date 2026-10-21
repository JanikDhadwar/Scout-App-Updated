import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentReports, buildSearchIndex, searchIndex, isCompleted, mainDestinations, sidebarDestinations, navigationGroup, sectionLinks } from './workspace-model.js';

test('five main destinations retain routes for related tools',()=>{
 assert.equal(mainDestinations.length,5);
 for(const section of ['match','pit','assignments'])assert.equal(navigationGroup(section),'match');
 for(const section of ['events','display','matches'])assert.equal(navigationGroup(section),'events');
 for(const section of ['teams','analytics','strategy','reports'])assert.equal(navigationGroup(section),'teams');
 assert.ok(sectionLinks.events.some(([key])=>key==='display'));
 assert.ok(sectionLinks.match.some(([key])=>key==='assignments'));
});

test('pit assignments and unavailable schedule rows have no completed match',()=>{assert.equal(isCompleted(undefined),false);assert.equal(isCompleted(null),false);assert.equal(isCompleted({}),false);});

test('sidebar contains only main areas while every secondary page remains in its section',()=>{
 assert.deepEqual(sidebarDestinations.map(([key])=>key),['dashboard','match','teams','events','settings']);
 for(const section of ['assignments','pit','matches','analytics','strategy','analyst','practice','help','history','reminders','admin','display']){
  const parent=navigationGroup(section);
  assert.ok(sectionLinks[parent]?.some(([key])=>key===section),`${section} stays accessible under ${parent}`);
  assert.ok(!sidebarDestinations.some(([key])=>key===section));
 }
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
