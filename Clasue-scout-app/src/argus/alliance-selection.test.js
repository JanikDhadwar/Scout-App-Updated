import test from 'node:test';
import assert from 'node:assert/strict';
import { allianceSelectionSheet, buildAnalytics } from './analytics.js';

test('alliance sheet uses explicit categories and linked match medians across seasons',()=>{
 const metrics=[{id:'f:a',type:'number',category:'scoring',direction:'higher',label:'Pieces'},{id:'f:b',type:'scale',category:'defense',direction:'lower',label:'Allowed'},{id:'f:c',type:'number',label:'Defense scoring'}];
 const team=(teamNumber,a,b)=>({teamNumber,metrics:{'f:a':{values:a.map((value,i)=>({value,matchKey:`2099x_qm${i}`,sourceIds:[`${teamNumber}-${i}`]}))},'f:b':{values:[{value:b,matchKey:'2099x_qm1',sourceIds:['defense-source']}]}}});
 const analytics={metrics,teams:[team('1',[0,10],3),team('2',[20,20],1),team('3',[],null)]};
 const sheet=allianceSelectionSheet(analytics);
 assert.deepEqual(sheet.map(s=>s.key),['scoring','defense','support','reliability']);
 assert.deepEqual(sheet[0].teams.map(t=>t.teamNumber),['2','1','3']);
 assert.equal(sheet[0].teams[0].score,100);
 assert.equal(sheet[0].teams[2].score,null);
 assert.equal(sheet[1].teams[0].teamNumber,'2');
 assert.equal(sheet[0].metrics.length,1,'Labels must not imply a category');
 assert.deepEqual(sheet[0].teams[0].sourceIds,['2-0','2-1']);
});

test('real report aggregation preserves role mappings, duplicate medians and future-year evidence',()=>{
 const form={id:'form',team_id:'w',questions:[{id:'x',type:'number',text:'Anything'}]};
 const event={event_key:'2099future',analytics_config:{'form:x':{category:'defense',direction:'lower'}}};
 const report=(id,value,match_key,report_kind='match')=>({id,team_id:'w',form_id:'form',event_key:event.event_key,scouted_team:'1',match_key,report_kind,answers:{x:value}});
 const analytics=buildAnalytics({forms:[form],event,scope:{teamId:'w',eventKey:event.event_key},reports:[report('a',2,'match1'),report('b',6,'match1'),report('c',8,'match2'),report('pit',900,'match1','pit'),report('unlinked',100,null)]});
 const row=allianceSelectionSheet(analytics)[1].teams[0];
 assert.equal(row.measurements[0].mean,6);
 assert.equal(row.measurements[0].n,2);
 assert.deepEqual(row.sourceIds,['a','b','c']);
});

test('partial categories cannot outrank fully measured teams; ties are shared',()=>{
 const metrics=['a','b'].map(id=>({id,type:'number',category:'scoring',direction:'higher'}));
 const field=value=>({values:[{value,matchKey:'m',sourceIds:[]}]});
 const analytics={metrics,teams:[{teamNumber:'1',metrics:{a:field(9)}},{teamNumber:'2',metrics:{a:field(2),b:field(4)}},{teamNumber:'3',metrics:{a:field(2),b:field(4)}}]};
 const rows=allianceSelectionSheet(analytics)[0].teams;
 assert.equal(rows[0].teamNumber,'2');assert.equal(rows[0].score,rows[1].score);assert.equal(rows[2].score,null);
 assert.equal(allianceSelectionSheet(analytics,['1'])[0].teams.length,2);
});

test('missing fields do not become zero and unlinked/pit observations cannot rank a team',()=>{
 const analytics={metrics:[{id:'f:x',type:'number',category:'scoring',direction:'higher'}],teams:[{teamNumber:'1',metrics:{'f:x':{values:[{value:0,matchKey:'m',sourceIds:['zero']},{value:100,matchKey:null}]}},pitMetrics:{'f:x':{mean:900}}},{teamNumber:'2',metrics:{}}]};
 const rows=allianceSelectionSheet(analytics)[0].teams;
 assert.equal(rows[0].score,50,'A single observed team is neutral, not best');
 assert.equal(rows[0].measurements[0].mean,0);
 assert.equal(rows[0].measurements[0].n,1);
 assert.equal(rows[1].score,null);
});
