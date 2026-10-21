import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentRoster } from './assignment-roster.js';

test('roster scopes event ownership, includes idle scouts, and distinguishes missing and conflicting owners',()=>{
 const event={team_id:'w',event_key:'2026e',event_teams:[{team_number:1,nickname:'One'},{team_number:2},{team_number:3}],assignment:{a:{teams:[2]}}};
 const data={memberships:[{team_id:'w',user_id:'a',username:'Alex'},{team_id:'w',user_id:'idle',username:'Sam'},{team_id:'other',user_id:'foreign',username:'Other'}],team_allocations:[{id:'a1',team_id:'w',event_key:'2026e',team_number:1,owner_user_id:'a',locked:true},{team_id:'other',event_key:'2026e',team_number:3,owner_user_id:'foreign'},{team_id:'w',event_key:'old',team_number:3,owner_user_id:'a'}]};
 const roster=assignmentRoster(data,event);
 assert.deepEqual(roster.scouts.map(s=>[s.name,s.teams.map(t=>t.number)]),[['Alex',[1,2]],['Sam',[]]]);
 assert.equal(roster.teams[0].locked,true);assert.equal(roster.teams[1].legacy,true);assert.equal(roster.teams[2].ownerName,'Unassigned');
 data.team_allocations.push({...data.team_allocations[0],id:'conflict',owner_user_id:'idle'});
 assert.equal(assignmentRoster(data,event).teams[0].ownerName,'Conflicting assignments');
 assert.equal(assignmentRoster(data,event).scouts[0].teams.some(t=>t.number===1),false);
 event.assignment.bad={teams:'unknown legacy value'};
 assert.equal(assignmentRoster(data,event).teams.length,3);
});
