import { useState } from 'react';

export function LegacyTeamAssignments({event,user,role,navigate}) {
 const entries=Object.entries(event?.assignment||{}).filter(([id,row])=>row&&Array.isArray(row.teams)&&(['owner','admin'].includes(role)||id===user.id));
 if(!entries.length)return null;
 return <details className="a-disclosure"><summary>Teams assigned in the older version</summary><p className="a-muted a-small">Original team allocations are retained. They do not identify a form or match, so they are not counted as submitted reports or silently converted to newer assignments.</p><ul>{entries.map(([id,row])=><li key={id}><strong>{row.username||id}</strong>: {row.teams.join(', ')||'No teams'}{id===user.id&&<div className="a-row">{row.teams.map(String).filter((number,index,all)=>/^\d+$/.test(number)&&all.indexOf(number)===index).map(number=><button className="a-button" key={number} onClick={()=>navigate(`/pit?${new URLSearchParams({event_key:event.event_key,scouted_team:number})}`)}>Pit scout {number}</button>)}</div>}</li>)}</ul><a href="#/matches">View schedule and filter to my assigned teams</a></details>;
}

export function EventLifecycle({event,role,api,onRefresh}) {
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 if(!event||!['owner','admin'].includes(role))return null;
 async function toggle(){if(!confirm(event.archived_at?'Restore this event?':'End and archive this event? All reports, forms, assignments and unfinished drafts will be kept.'))return;setBusy(true);setError('');try{await api('PATCH',`/scout_events/${encodeURIComponent(event.id)}`,{archived_at:event.archived_at?null:new Date().toISOString()});setMessage(event.archived_at?'Event restored.':'Event archived. Select another event when ready. Historical reports remain available.');await onRefresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <details className="a-disclosure"><summary>Event archive and exports</summary><p className="a-muted">Export reports before closing a competition if you need a separate copy. Switching events never clears data. Archived events remain available for history and unfinished drafts.</p><div className="a-row"><a className="a-button" href="#/reports">Open reports and export</a><button className="a-button" disabled={busy} onClick={toggle}>{busy?'Saving…':event.archived_at?'Restore event':'End and archive event'}</button></div>{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="a-danger">{error}</p>}</details>;
}
