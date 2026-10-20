export function matchOwners({event,match,assignments=[]}){
 if(!event||!match)return [];
 return ['red','blue'].flatMap(alliance=>(match.alliances?.[alliance]?.team_keys||[]).map(key=>{
  const teamNumber=key.replace(/^frc/,''),explicit=assignments.filter(row=>row.team_id===event.team_id&&row.event_key===event.event_key&&row.match_key===match.key&&String(row.team_number)===teamNumber&&row.report_kind!=='pit'&&!row.archived_at);
  const owners=explicit.length?[...new Set(explicit.map(row=>row.scout_user_id))]:Object.entries(event.assignment||{}).filter(([,row])=>Array.isArray(row?.teams)&&row.teams.map(String).includes(teamNumber)).map(([id])=>id);
  return {teamNumber,alliance,owners,assignment:explicit[0]||null,legacy:!explicit.length};
 }));
}
export function assignedRobots({userId,...context}){return matchOwners(context).filter(row=>row.owners.length===1&&row.owners[0]===userId);}
export function matchReportError({event,assignments=[],userId,report}){
 if(!event||event.team_id!==report.team_id||event.event_key!==report.event_key)return 'Choose your assigned event before submitting a match report.';
 const match=event.matches?.find(row=>row.key===report.match_key);
 if(!match)return 'Choose an official match from your event schedule.';
 const slot=matchOwners({event,match,assignments}).find(row=>row.teamNumber===String(report.scouted_team));
 if(!slot)return 'Choose an assigned robot that is playing in this match.';
 if(slot.owners.length>1)return 'This robot has conflicting assignments. Ask a coordinator to resolve them; your draft is preserved.';
 if(slot.owners.length!==1||slot.owners[0]!==userId)return 'You are not assigned to this robot for this match. Request a handoff or ask a coordinator; your local report is preserved.';
 if(slot.assignment?.form_id&&slot.assignment.form_id!==report.form_id)return 'Use the form linked to your match assignment.';
 if(report.alliance&&report.alliance!==slot.alliance)return 'The selected alliance does not match this robot in the official match.';
 if(report.match_number!=null&&Number(report.match_number)!==Number(match.match_number))return 'The match number does not match the official match.';
 return null;
}
