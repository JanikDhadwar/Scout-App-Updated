import { assignedRobots } from './match-access.js';
import { isCompleted } from './workspace-model.js';
export function scoutingPath({match,eventKey,teamNumber,userId,assignments=[],forms=[],event}){
 const number=String(teamNumber),alliance=['red','blue'].find(color=>(match?.alliances?.[color]?.team_keys||[]).includes(`frc${number}`));
 if(!alliance||!eventKey||!match?.key)throw new Error('Choose a robot from this match.');
 if(event&&!assignedRobots({event,match,assignments,userId}).some(row=>row.teamNumber===number))throw new Error('Choose a robot assigned to you for this match.');
 const assignment=assignments.find(row=>row.scout_user_id===userId&&row.event_key===eventKey&&row.match_key===match.key&&String(row.team_number)===number&&!row.archived_at&&row.report_kind!=='pit');
 const available=forms.filter(form=>!form.archived&&!form.archived_at&&(form.kind||'match')==='match');
 return `/match?${new URLSearchParams({event_key:eventKey,match_key:match.key,match_number:String(match.match_number||''),scouted_team:number,alliance,...(assignment?{assignment_id:assignment.id,form_id:assignment.form_id||(forms.filter(form=>!form.archived&&!form.archived_at&&(form.kind||'match')==='match').length===1?forms.find(form=>!form.archived&&!form.archived_at&&(form.kind||'match')==='match').id:'')}:available.length===1?{form_id:available[0].id}:{})})}`;
}
export function matchTiming(match,now=Date.now()){
 if(isCompleted(match))return 'Completed';
 const predicted=Number(match?.predicted_time)>0,time=Number(predicted?match.predicted_time:match?.time);
 if(!Number.isFinite(time)||time<=0)return 'Time unavailable';
 const minutes=Math.ceil((time*1000-now)/60000);
 if(minutes<0)return predicted?'Estimated time passed':'Scheduled time passed';
 if(minutes===0)return predicted?'Estimated now':'Scheduled now';
 return `${predicted?'Estimated in':'In'} ${minutes} min`;
}
