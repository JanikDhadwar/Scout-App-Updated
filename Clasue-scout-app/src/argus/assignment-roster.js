export function assignmentRoster(data,event){
 if(!event)return {teams:[],scouts:[]};
 const members=(data.memberships||[]).filter(m=>m.team_id===event.team_id);
 const allocations=(data.team_allocations||[]).filter(a=>a.team_id===event.team_id&&a.event_key===event.event_key&&!a.archived_at);
 const numbers=[...new Set([...(event.event_teams||[]).map(t=>Number(t.team_number)),...allocations.map(a=>Number(a.team_number))])].filter(n=>Number.isInteger(n)&&n>0).sort((a,b)=>a-b);
 const teams=numbers.map(number=>{
  const explicit=allocations.filter(a=>Number(a.team_number)===number),legacy=!explicit.length;
  const ids=legacy?Object.entries(event.assignment||{}).filter(([,value])=>Array.isArray(value?.teams)&&value.teams.map(String).includes(String(number))).map(([id])=>id):[...new Set(explicit.map(a=>a.owner_user_id))];
  const ownerId=ids.length===1?ids[0]:null;
  return {number,nickname:event.event_teams?.find(t=>Number(t.team_number)===number)?.nickname||'',ownerId,ownerName:ids.length>1?'Conflicting assignments':ownerId?members.find(m=>m.user_id===ownerId)?.username||'Former member':'Unassigned',locked:explicit.some(a=>a.locked),allocation:explicit.length===1?explicit[0]:null,legacy};
 });
 const scouts=members.map(m=>({id:m.user_id,name:m.username||'Unnamed scout',teams:teams.filter(t=>t.ownerId===m.user_id)})).sort((a,b)=>a.name.localeCompare(b.name));
 const former=[...new Set(teams.filter(t=>t.ownerId&&!members.some(m=>m.user_id===t.ownerId)).map(t=>t.ownerId))];
 former.forEach(id=>scouts.push({id,name:'Former member',teams:teams.filter(t=>t.ownerId===id)}));
 return {teams,scouts};
}
