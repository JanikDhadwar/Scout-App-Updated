import { useState } from 'react';
import { assignmentRoster } from './assignment-roster.js';

export function AssignmentRoster({data,event,onSelect}){
 const [view,setView]=useState('scouts'),[query,setQuery]=useState(''),[page,setPage]=useState(0);
 const roster=assignmentRoster(data,event),needle=query.trim().toLowerCase();
 const rows=(view==='scouts'?roster.scouts:roster.teams).filter(row=>view==='scouts'?`${row.name} ${row.teams.map(t=>t.number).join(' ')}`.toLowerCase().includes(needle):`${row.number} ${row.nickname} ${row.ownerName}`.toLowerCase().includes(needle));
 const last=Math.max(0,Math.ceil(rows.length/8)-1),current=Math.min(page,last);
 const teamButton=team=><button type="button" className="a-button" key={team.number} onClick={()=>onSelect(team.number)}>Team {team.number}{team.locked?' · Locked':''}</button>;
 return <section className="a-stack a-assignment-roster" aria-label="Who scouts each team"><h3>Who scouts each team</h3><div className="a-row"><div role="group" aria-label="Assignment view"><button type="button" className="a-button" aria-pressed={view==='scouts'} onClick={()=>{setView('scouts');setPage(0);}}>By scout</button><button type="button" className="a-button" aria-pressed={view==='teams'} onClick={()=>{setView('teams');setPage(0);}}>By team</button></div><label className="a-grow">Find a scout or team<input className="a-input" type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label></div>
 <div className="a-stack">{rows.slice(current*8,current*8+8).map(row=><article className="a-roster-row" key={view==='scouts'?row.id:row.number}>{view==='scouts'?<><strong>{row.name} <span className="a-muted a-small">({row.teams.length})</span></strong><div className="a-row">{row.teams.length?row.teams.map(teamButton):<span className="a-muted">No teams assigned</span>}</div></>:<><div><strong>{row.ownerName}</strong><p className="a-muted a-small">{row.nickname||'Name unavailable'}</p></div>{teamButton(row)}</>}</article>)}</div>
 {!rows.length&&<p className="a-muted">No matching assignments.</p>}<div className="a-row"><button type="button" className="a-button" disabled={current===0} onClick={()=>setPage(current-1)}>Previous assignments</button><span className="a-small">Page {current+1} of {last+1}</span><button type="button" className="a-button" disabled={current===last} onClick={()=>setPage(current+1)}>Next assignments</button></div>
 <p className="a-muted a-small">Select a team to view or change its permanent scout. One-match handoffs are shown in the match schedule.</p></section>;
}
