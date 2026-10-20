import test from 'node:test';
import assert from 'node:assert/strict';
import { matchTiming, scoutingPath } from './match-launch-model.js';
const match={key:'2026test_qm43',comp_level:'qm',match_number:43,time:1300,alliances:{red:{team_keys:['frc254','frc4915']},blue:{team_keys:['frc3540']}}};
test('match launch carries the selected robot, alliance, event and matching assignment',()=>{
 const path=scoutingPath({match,eventKey:'2026test',teamNumber:3540,userId:'scout',assignments:[{id:'mine',event_key:'2026test',match_key:match.key,team_number:3540,scout_user_id:'scout',form_id:'match-form'}]});
 const params=new URLSearchParams(path.split('?')[1]);assert.equal(params.get('alliance'),'blue');assert.equal(params.get('scouted_team'),'3540');assert.equal(params.get('match_number'),'43');assert.equal(params.get('assignment_id'),'mine');assert.equal(params.get('form_id'),'match-form');
 assert.throws(()=>scoutingPath({match,eventKey:'2026test',teamNumber:999}),/robot/i);
 const unassigned=scoutingPath({match,eventKey:'2026test',teamNumber:254,forms:[{id:'only-match-form',kind:'match'}]});
 assert.equal(new URLSearchParams(unassigned.split('?')[1]).get('form_id'),'only-match-form');
});
test('match timing distinguishes predictions, unknown time and elapsed schedules without claiming live play',()=>{
 assert.equal(matchTiming(match,1000000),'In 5 min');assert.equal(matchTiming({...match,predicted_time:1120},1000000),'Estimated in 2 min');
 assert.equal(matchTiming({...match,time:null},1000000),'Time unavailable');assert.equal(matchTiming(match,1400000),'Scheduled time passed');assert.equal(matchTiming({...match,actual_time:1000},1400000),'Completed');
});
