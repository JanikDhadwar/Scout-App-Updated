import test from 'node:test';
import assert from 'node:assert/strict';
import {assignedRobots,matchReportError} from './match-access.js';
const match={key:'e_qm1',match_number:1,alliances:{red:{team_keys:['frc1','frc2']},blue:{team_keys:['frc3']}}};
const event={id:'event',team_id:'team',event_key:'e',matches:[match],assignment:{a:{teams:[1,2,99]},b:{teams:[3]}}};
const report={id:'report',team_id:'team',event_key:'e',match_key:'e_qm1',scouted_team:'1',report_kind:'match',form_id:'form',alliance:'red',match_number:1};
test('a scout sees only allocated robots playing this match and one-match overrides leave other matches alone',()=>{
 assert.deepEqual(assignedRobots({event,match,userId:'a',assignments:[]}).map(row=>row.teamNumber),['1','2']);
 const assignments=[{id:'handoff',team_id:'team',event_key:'e',match_key:match.key,team_number:1,scout_user_id:'c',form_id:'form'}];
 assert.deepEqual(assignedRobots({event,match,userId:'a',assignments}).map(row=>row.teamNumber),['2']);
 assert.deepEqual(assignedRobots({event,match,userId:'c',assignments}).map(row=>row.teamNumber),['1']);
 assert.deepEqual(assignedRobots({event,match:{...match,key:'e_qm2'},userId:'a',assignments}).map(row=>row.teamNumber),['1','2']);
});
test('report authorization rejects unassigned, foreign, absent and conflicting robot allocations',()=>{
 assert.equal(matchReportError({event,assignments:[],userId:'a',report}),null);
 assert.match(matchReportError({event,assignments:[],userId:'b',report}),/assigned/i);
 assert.match(matchReportError({event,assignments:[],userId:'a',report:{...report,scouted_team:99}}),/playing/i);
 assert.match(matchReportError({event:null,assignments:[],userId:'a',report}),/event/i);
 const assignments=['a','b'].map(id=>({id,team_id:'team',event_key:'e',match_key:match.key,team_number:1,scout_user_id:id}));
 assert.match(matchReportError({event,assignments,userId:'a',report}),/conflict/i);
 assert.match(matchReportError({event,assignments:[],userId:'a',report:{...report,team_id:'other'}}),/event/i);
});
