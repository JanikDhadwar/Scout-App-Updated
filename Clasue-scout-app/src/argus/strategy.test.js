import test from 'node:test';
import assert from 'node:assert/strict';
import { moveEntry, searchWorkspace, teamDirectory } from './strategy-model.js';

test('reordering preserves entries and rejects invalid indexes', () => {
  const entries=[{team_number:1,note:'first'},{team_number:2},{team_number:3}];
  assert.deepEqual(moveEntry(entries,0,2).map(x=>x.team_number),[2,3,1]);
  assert.equal(moveEntry(entries,-1,0),entries);
  assert.equal(entries[0].note,'first');
});
test('search never includes records from another workspace and labels legacy reports', () => {
  const data={submissions:[{id:'own',team_id:'a',scouted_team:254,form_title:'Drive report'}, {id:'private',team_id:'b',scouted_team:254}],scout_events:[],matches:[]};
  const results=searchWorkspace('254',data,{id:'a'},null);
  assert(results.some(x=>x.id==='report:own'&&x.detail.includes('Unassigned event')));
  assert(!results.some(x=>x.id==='report:private'));
});
test('team directory combines event teams with scoped evidence without fabricated names', () => {
  assert.deepEqual(teamDirectory({submissions:[{team_id:'a',scouted_team:'7'},{team_id:'b',scouted_team:'9'}]}, {id:'a'}, {event_teams:[{team_number:2,nickname:'Real'}]}),[{team_number:2,nickname:'Real'},{team_number:7,nickname:''}]);
});
test('search indexes matches, destinations and evidence notes with bounded results', () => {
  const rows=searchWorkspace('QM 4',{matches:[{key:'2026test_qm4',match_number:4,comp_level:'qm',alliances:{red:{team_keys:['frc2']},blue:{team_keys:[]}}}]},{id:'a'},null);
  assert.equal(rows[0].kind,'match');
  assert(searchWorkspace('Strategy',{}, {id:'a'},null).some(x=>x.page==='strategy'));
  assert(searchWorkspace('',{}, {id:'a'},null).length<=30);
});
