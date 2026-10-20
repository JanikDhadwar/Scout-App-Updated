import test from 'node:test';
import assert from 'node:assert/strict';
import { partnerShortlist, answerQuestion, buildAnalytics } from './analytics.js';
import { assignedTeamNumbers } from './history-model.js';
import { mainDestinations } from './workspace-model.js';

test('canonical ownership excludes temporary coverage from a scouts permanent team list',()=>{
 const event={id:'e',team_id:'w',event_key:'e',assignment:{u:{teams:[999]}}};
 const data={team_allocations:[{team_id:'w',event_key:'e',team_number:1,owner_user_id:'u'},{team_id:'w',event_key:'e',team_number:2,owner_user_id:'v'}],assignments:[{team_id:'w',event_key:'e',scout_user_id:'u',team_number:2,handoff_id:'coverage'}]};
 assert.deepEqual(assignedTeamNumbers(data,event,'u'),['1']);assert.equal(mainDestinations.length,5);assert.ok(mainDestinations.some(([id])=>id==='assignments'));
});
test('alliance shortlists use explicit metric direction and samples without inventing combined scores',()=>{
 const forms=[{id:'f',team_id:'w',questions:[{id:'q',text:'Pieces',type:'number'}]}];
 const event={event_key:'e',event_name:'Event',analytics_config:{'f:q':{unit:'pieces',direction:'higher'}}};
 const analytics=buildAnalytics({forms,event,scope:{teamId:'w',eventKey:'e'},reports:[{id:'r1',team_id:'w',event_key:'e',form_id:'f',scouted_team:1,report_kind:'match',answers:{q:0}},{id:'r2',team_id:'w',event_key:'e',form_id:'f',scouted_team:2,report_kind:'match',answers:{q:3}}]});
 assert.deepEqual(partnerShortlist(analytics,'f:q').map(t=>t.teamNumber),['2','1']);
 assert.match(answerQuestion('Review alliance partners by Pieces',analytics).text,/n=1/);
 assert.equal(answerQuestion('Predict alliance partners',analytics).kind,'insufficient');
});
