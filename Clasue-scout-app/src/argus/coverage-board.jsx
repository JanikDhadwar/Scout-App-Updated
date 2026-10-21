import { useEffect, useRef, useState } from 'react';
import { matchLabel } from './workspace-model.js';
import { usePhoneLayout } from './phone-layout.js';
import './coverage-board.css';

const statusText={red:'Pit not scouted',yellow:'Missed matches',green:'No outstanding warnings',unknown:'Schedule unavailable'};
function CoverageStatus({status}){
 const paths={red:'M4 4h16v16H4zM8 12h8',yellow:'M12 3 2 21h20L12 3zM12 9v5m0 3v1',green:'m4 12 5 5L20 6',unknown:'M4 12h16'};
 return <svg className="a-coverage-status" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={paths[status]||paths.unknown}/></svg>;
}
function CoverageMatches({team,slots,event,name,busy,onDismiss,dismissed=false}){
 const phone=usePhoneLayout(),size=phone?4:6,[page,setPage]=useState(0);
 const last=Math.max(0,Math.ceil(slots.length/size)-1),current=Math.min(page,last);
 const label=dismissed?'Dismissed matches':'Missed matches';
 return <section className="a-coverage-match-list" aria-label={label}>{!dismissed&&<h3>{label} ({slots.length})</h3>}
  {slots.slice(current*size,(current+1)*size).map(slot=><div className="a-coverage-match-row" key={slot.match_key}><div><strong>{matchLabel(event.matches?.find(m=>m.key===slot.match_key)||{key:slot.match_key})}</strong>{dismissed?<small>Dismissed by {name(slot.dismissal.actor_id)} · No report submitted</small>:<><small>Responsible: {name(slot.duty?.scout_user_id||team.owner_user_id)}</small>{slot.duty?.primary_scout_user_id&&slot.duty.primary_scout_user_id!==slot.duty.scout_user_id&&<small>Permanent owner at assignment: {name(slot.duty.primary_scout_user_id)}</small>}</>}</div><button className="a-button" disabled={busy} onClick={()=>onDismiss(team,slot,!dismissed)}>{dismissed?'Restore warning':'Dismiss missed match'}</button></div>)}
  {slots.length>size&&<nav className="a-row a-coverage-pages" aria-label={`${label} pages`}><button className="a-button" disabled={busy||!current} onClick={()=>setPage(current-1)}>Previous matches</button><span role="status">{current*size+1}–{Math.min((current+1)*size,slots.length)} of {slots.length}</span><button className="a-button" disabled={busy||current===last} onClick={()=>setPage(current+1)}>Next matches</button></nav>}
 </section>;
}
export function CoverageBoard({teams,event,name,busy,error,onDismiss,onDismissTeam,onAssignments,onRefresh}){
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[page,setPage]=useState(0),[selected,setSelected]=useState(null);
 const dialog=useRef(null),phone=usePhoneLayout(),pageSize=phone?6:12;
 const visible=teams.filter(team=>(filter==='all'||team.status===filter)&&`${team.team_number} ${team.team_name}`.toLowerCase().includes(query.toLowerCase()));
 const lastPage=Math.max(0,Math.ceil(visible.length/pageSize)-1),current=Math.min(page,lastPage);
 const team=teams.find(row=>row.team_number===selected);
 useEffect(()=>{const node=dialog.current;if(selected&&!node.open)node.showModal();else if(!selected&&node.open)node.close();},[selected]);
 const dismissed=team&&(team.dismissed_matches.length>0||team.pit_dismissal?.dismissed);
 return <section className="a-panel a-stack a-coverage-board" aria-labelledby="coverage-heading">
  <header className="a-row"><h2 id="coverage-heading">Scouting by team</h2><button className="a-button" disabled={busy} onClick={onRefresh}>Refresh overview</button></header>
  <p className="a-coverage-legend"><span className="a-coverage-green"><CoverageStatus status="green"/>Green: covered or dismissed</span><span className="a-coverage-yellow"><CoverageStatus status="yellow"/>Yellow: missed matches</span><span className="a-coverage-red"><CoverageStatus status="red"/>Red: no pit report</span></p>
  <div className="a-coverage-controls"><label>Find team<input type="search" className="a-input" placeholder="Number or name" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label><label>Show<select aria-label="Show team coverage" className="a-input" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="all">All teams ({teams.length})</option>{Object.entries(statusText).map(([value,label])=><option key={value} value={value}>{label} ({teams.filter(t=>t.status===value).length})</option>)}</select></label></div>
  <div className="a-coverage-grid" aria-label="Event team coverage">{visible.slice(current*pageSize,(current+1)*pageSize).map(row=><button className={`a-coverage-tile is-${row.status}`} key={row.team_number} onClick={()=>setSelected(row.team_number)} aria-label={`Team ${row.team_number} · ${row.team_name||'Name unavailable'}: ${statusText[row.status]}`} aria-haspopup="dialog"><strong><CoverageStatus status={row.status}/>{row.team_number}</strong><span>{row.team_name||'Name unavailable'}</span></button>)}</div>
  {!visible.length&&<p>{teams.length?'No matching teams. Change the search or filter.':'No event teams downloaded. Download teams in Event setup.'}</p>}
  <div className="a-row a-coverage-pages"><button className="a-button" disabled={current===0} onClick={()=>setPage(current-1)}>Previous teams</button><span role="status">{visible.length?`${current*pageSize+1}–${Math.min((current+1)*pageSize,visible.length)} of ${visible.length}`:'0 teams'}</span><button className="a-button" disabled={current===lastPage} onClick={()=>setPage(current+1)}>Next teams</button></div>
  <dialog ref={dialog} className="a-coverage-dialog" aria-labelledby="coverage-team-heading" onClose={()=>setSelected(null)}><div className="a-stack">
   <header className="a-row"><h2 id="coverage-team-heading">Team {team?.team_number}{team?.team_name?` · ${team.team_name}`:''}</h2><button className="a-button" onClick={()=>setSelected(null)}>Close</button></header>
   {error&&<div role="alert"><p className="a-danger">{error}</p><button className="a-button" disabled={busy} onClick={onRefresh}>Refresh team status</button></div>}
   {team&&<><p className={`a-coverage-${team.status}`}>{statusText[team.status]}</p><p><strong>Permanent owner:</strong> {name(team.owner_user_id)}<br/><strong>Pit scout:</strong> {name(team.pit_scout_user_id)}</p>
    {team.pit_missing&&<p>{team.pit_dismissal?.dismissed?`Pit warning dismissed by ${name(team.pit_dismissal.actor_id)}. No pit report submitted.`:'No pit scouting report submitted.'}</p>}
    {!team.schedule_known&&<p>Schedule unavailable. Match coverage cannot be confirmed.</p>}
    <div className="a-row a-coverage-actions">{team.status!=='green'&&team.status!=='unknown'&&<button className="a-button a-primary" disabled={busy} onClick={()=>onDismissTeam(team,true)}>Dismiss team warnings</button>}{dismissed&&<button className="a-button" disabled={busy} onClick={()=>onDismissTeam(team,false)}>Restore team warnings</button>}<button className="a-button" onClick={()=>{setSelected(null);onAssignments();}}>Review assignment</button></div>
    {!!team.missing_matches.length&&<CoverageMatches key={`${team.team_number}:missing`} team={team} slots={team.missing_matches} event={event} name={name} busy={busy} onDismiss={onDismiss}/>}
    <p className="a-muted a-small">Dismissal clears warnings only, not missing evidence. It never creates reports, completes duties or changes analytics. New missed matches need a new review.</p>
    {dismissed&&<details className="a-disclosure"><summary>Dismissed matches ({team.dismissed_matches.length})</summary><CoverageMatches key={`${team.team_number}:dismissed`} team={team} slots={team.dismissed_matches} event={event} name={name} busy={busy} onDismiss={onDismiss} dismissed/></details>}
   </>}
  </div></dialog>
 </section>;
}
