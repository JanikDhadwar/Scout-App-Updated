const {randomInt,randomUUID}=require('node:crypto');
const shuffle=values=>{const result=[...values];for(let i=result.length-1;i>0;i--){const j=randomInt(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;};
function generateAssignments({event,scoutIds,kind,formId,existing=[]}) {
  const scouts=shuffle([...new Set(scoutIds)]), loads=new Map(scouts.map(id=>[id,0]));
  const relevant=existing.filter(row=>row.team_id===event.team_id&&row.event_key===event.event_key&&!row.archived_at);
  const type=row=>row.report_kind||'match';
  for(const row of relevant)if(type(row)===kind&&loads.has(row.scout_user_id))loads.set(row.scout_user_id,loads.get(row.scout_user_id)+1);
  const tasks=kind==='pit'?(event.event_teams||[]).map(team=>({team_number:Number(team.team_number),match_key:null,match_number:null,alliance:null})):(event.matches||[]).filter(match=>!match.actual_time&&!match.post_result_time&&!['red','blue'].some(color=>match.alliances?.[color]?.score!=null&&Number(match.alliances[color].score)>=0)).flatMap(match=>['red','blue'].flatMap(alliance=>(match.alliances?.[alliance]?.team_keys||[]).map(key=>({team_number:Number(key.replace(/^frc/,'')),match_key:match.key,match_number:match.match_number,alliance}))));
  const added=[];
  for(const task of tasks){
    if(!Number.isInteger(task.team_number)||task.team_number<=0)continue;
    if(relevant.some(row=>type(row)===kind&&(kind==='match'||row.form_id===formId)&&String(row.team_number)===String(task.team_number)&&(row.match_key||null)===(task.match_key||null)))continue;
    const busy=new Set([...relevant,...added].filter(row=>kind==='match'&&type(row)==='match'&&row.match_key===task.match_key).map(row=>row.scout_user_id));
    const available=shuffle(scouts.filter(id=>!busy.has(id))).sort((a,b)=>loads.get(a)-loads.get(b));
    if(!available.length)throw new Error('Select enough scouts to cover every robot in a match without assigning two robots to one person. Existing assignments are preserved.');
    const scout=available[0];loads.set(scout,loads.get(scout)+1);
    added.push({id:randomUUID(),team_id:event.team_id,event_key:event.event_key,report_kind:kind,form_id:formId,scout_user_id:scout,...task,revision:1,created_at:new Date().toISOString()});
  }
  return added;
}
function submissionError(form,report,reports){
  const limit=Number(form.max_submissions_per_team);
  if((form.allow_team_select||limit>0)&&(!/^\d+$/.test(String(report.scouted_team||''))||Number(report.scouted_team)<1))return 'Select the team you are scouting.';
  if(limit>0&&reports.filter(row=>row.team_id===report.team_id&&row.form_id===form.id&&String(row.scouted_team)===String(report.scouted_team)&&(row.event_key||'')===(report.event_key||'')).length>=limit)return `This form has reached its limit of ${limit} report(s) for team ${report.scouted_team} at this event. Your queued report is retained for review.`;
  return null;
}
module.exports={generateAssignments,submissionError};
