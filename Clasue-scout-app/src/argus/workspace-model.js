export const destinations=[['dashboard','Dashboard'],['match','Match scouting'],['pit','Pit scouting'],['teams','Teams'],['matches','Matches'],['analytics','Analytics'],['strategy','Strategy'],['events','Event data'],['settings','Settings']];
export const matchLabel=match=>match?.comp_level==='qm'?`Qual ${match.match_number}`:match?.match_number?`${match.comp_level||'Match'} ${match.match_number}`:match?.key||'Unlinked match';
export const isCompleted=match=>!!(match.actual_time||match.post_result_time)||['red','blue'].some(color=>match.alliances?.[color]?.score!=null&&Number(match.alliances[color].score)>=0);
export function assignmentReports(assignment,reports=[]){return reports.filter(report=>report.team_id===assignment.team_id&&report.event_key===assignment.event_key&&report.user_id===assignment.scout_user_id&&String(report.scouted_team)===String(assignment.team_number)&&report.match_key===assignment.match_key&&report.report_kind!=='pit');}
export function buildSearchIndex({data={},event,workspaceId,userId,role}={}){
 const items=destinations.map(([route,label])=>({group:'Pages',label,route:`/${route}`,text:label.toLowerCase()}));
 const add=(group,label,route,detail='')=>items.push({group,label,route,detail,text:`${label} ${detail}`.toLowerCase()});
 (event?.event_teams||[]).forEach(team=>add('Teams',`Team ${team.team_number}`,`/teams/${team.team_number}`,team.nickname||''));
 (data.matches||[]).forEach(match=>add('Matches',matchLabel(match),`/matches/${encodeURIComponent(match.key)}`,(match.alliances?.red?.team_keys||[]).concat(match.alliances?.blue?.team_keys||[]).join(' ')));
 (data.scout_events||[]).filter(row=>row.team_id===workspaceId).forEach(row=>add('Events',row.event_name||row.event_key,`/events/${encodeURIComponent(row.id)}`,row.event_key));
 (data.submissions||[]).filter(row=>row.team_id===workspaceId&&(role!=='member'||row.user_id===userId)).forEach(row=>add('Reports',`${row.form_title||'Report'}${row.scouted_team?` / Team ${row.scouted_team}`:''}`,`/reports/${encodeURIComponent(row.id)}`,`${row.match_key||''} ${row.submitted_by||''}`));
 return items;
}
export function searchIndex(index,query){const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);return index.filter(item=>terms.every(term=>item.text.includes(term))).slice(0,30);}
