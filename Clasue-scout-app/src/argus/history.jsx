import { useEffect, useState } from 'react';
import { TeamDirectory, ReportDetails } from './workspace-pages.jsx';
import { TeamProfile, TeamComparison } from './analytics-views.jsx';

export default function EventHistory({data,workspace,event,api}){
  const events=(data.scout_events||[]).filter(e=>e.team_id===workspace.id&&!e.data_cleared_at);
  const [selected,setSelected]=useState(events.find(e=>e.id!==event?.id)?.id||event?.id||'');
  const [analytics,setAnalytics]=useState(null),[team,setTeam]=useState(null),[compare,setCompare]=useState(null),[report,setReport]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;if(selected)api('GET',`/events/${encodeURIComponent(selected)}/analytics`).then(value=>{if(active){setAnalytics({id:selected,value});setError('');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[api,selected]);
  async function openReport(id){try{setReport(await api('GET',`/events/${encodeURIComponent(selected)}/evidence/${encodeURIComponent(id)}`));}catch(e){setError(e.message);}}
  const value=analytics?.id===selected?analytics.value:null;
  return <div className="a-stack"><header><h1>Event history</h1><p className="a-muted">Read-only browsing. Your workspace active event stays {event?.event_name||'unconfigured'}.</p></header><label>Historical event<select className="a-input" value={selected} onChange={e=>{setSelected(e.target.value);setTeam(null);setCompare(null);setReport(null);}}><option value="">Choose a saved event</option>{events.map(e=><option key={e.id} value={e.id}>{e.event_name||e.event_key}{e.archived_at?' (Archived)':''}</option>)}</select></label>{error&&<p className="a-danger" role="alert">{error}</p>}{value&&<><div className="a-row"><button className="a-button" onClick={()=>{setTeam(null);setCompare(null);setReport(null);}}>Browse historical teams</button><a className="a-button" href="#/events">Manage active event</a></div>{report?<ReportDetails data={{submissions:[report],forms:[]}} reportId={report.id} onOpenTeam={n=>{setReport(null);setTeam(n);}}/>:compare?<TeamComparison analytics={value} teamNumbers={compare} onChange={setCompare} onOpenTeam={n=>{setCompare(null);setTeam(n);}}/>:team?<TeamProfile key={`${selected}:${team}`} analytics={value} teamNumber={team} onCompare={n=>{setTeam(null);setCompare(n);}} onOpenReport={openReport}/>:<TeamDirectory analytics={value} onOpenTeam={setTeam} onCompare={setCompare}/>}</>}{!selected&&<p>No retained events are available yet.</p>}</div>;
}
