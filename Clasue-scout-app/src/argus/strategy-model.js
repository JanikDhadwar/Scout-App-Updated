export function moveEntry(entries,from,to) {
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=entries.length||to>=entries.length)return entries;
  const next=[...entries], [item]=next.splice(from,1);next.splice(to,0,item);return next;
}
export function teamDirectory(data={},workspace,event) {
  const teams=new Map();
  for(const t of event?.event_teams||[])teams.set(Number(t.team_number),{team_number:Number(t.team_number),nickname:t.nickname||''});
  for(const r of data.submissions||[])if(r.team_id===workspace?.id&&(!r.event_key||r.event_key===event?.event_key)&&Number(r.scouted_team)>0&&!teams.has(Number(r.scouted_team)))teams.set(Number(r.scouted_team),{team_number:Number(r.scouted_team),nickname:''});
  return [...teams.values()].sort((a,b)=>a.team_number-b.team_number);
}
export const destinations=[['dashboard','Dashboard'],['match','Match Scouting'],['pit','Pit Scouting'],['teams','Teams'],['matches','Matches'],['analytics','Analytics'],['strategy','Strategy'],['event','Event Data'],['settings','Settings']];
export function searchWorkspace(query,data={},workspace,event) {
  const q=query.trim().toLowerCase();
  const rows=destinations.map(([page,label])=>({id:`page:${page}`,kind:'destination',page,label,detail:'Navigation'}));
  for(const t of teamDirectory(data,workspace,event))rows.push({id:`team:${t.team_number}`,kind:'team',team:t.team_number,label:`Team ${t.team_number}`,detail:t.nickname||'Scouting team'});
  for(const m of data.matches||[])rows.push({id:`match:${m.key||m.id}`,kind:'match',match:m,label:`${(m.comp_level||'Match').toUpperCase()} ${m.match_number||''}`,detail:[...(m.alliances?.red?.team_keys||[]),...(m.alliances?.blue?.team_keys||[])].map(x=>x.replace('frc','')).join(' · ')});
  for(const e of data.scout_events||[])if(e.team_id===workspace?.id)rows.push({id:`event:${e.id}`,kind:'event',event:e,label:e.event_name||e.event_key||'Event',detail:e.event_key||''});
  for(const r of data.submissions||[])if(r.team_id===workspace?.id)rows.push({id:`report:${r.id}`,kind:'report',report:r,label:`${r.form_title||'Report'}${r.scouted_team?` · Team ${r.scouted_team}`:''}`,detail:`${r.event_key||'Unassigned event'} · ${r.submitted_by||'Scout'}${r.match_key?` · ${r.match_key}`:''}`});
  return rows.filter(row=>!q||`${row.label} ${row.detail}`.toLowerCase().includes(q)).sort((a,b)=>a.kind.localeCompare(b.kind)).slice(0,30);
}
