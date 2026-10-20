import { useEffect, useState } from 'react';

export function SetupGuidance({workspace,event,data,role,api,section,userId}) {
  const preferenceKey=`argus:setup-dismissed:v1:${userId}:${workspace.id}`;
  const [dismissed,setDismissed]=useState(()=>{try{return localStorage.getItem(preferenceKey)==='true';}catch{return false;}});
  function dismiss(value){setDismissed(value);try{localStorage.setItem(preferenceKey,String(value));}catch{ /* Session preference remains available. */ }}
  const [connection,setConnection]=useState(null);
  useEffect(()=>{
    let active=true;
    const refresh=()=>api('GET',`/integrations/status?workspaceId=${encodeURIComponent(workspace.id)}`).then(status=>{if(active)setConnection(status);}).catch(()=>{ /* Page-specific errors and cached data remain available. */ });
    refresh();
    window.addEventListener('argus-connections-updated',refresh);
    return()=>{active=false;window.removeEventListener('argus-connections-updated',refresh);};
  },[api,workspace.id,section]);
  const canEdit=['owner','admin'].includes(role),tasks=[];
  if(connection?.tbaConfigured===false)tasks.push({id:'connection',text:role==='owner'?'Connect The Blue Alliance in Settings to load events, teams, schedules and stream links.':'Ask the workspace owner to connect The Blue Alliance in Settings. This supplies official events and schedules.',route:'/settings',action:role==='owner'?'Set up event connection':'View connection settings'});
  if(!event)tasks.push({id:'event',text:canEdit?'Choose a season and search any event. Your team does not have to be attending.':'Ask an admin to add an event. Then choose it from the current event menu.',route:'/events',action:canEdit?'Choose an event':'View event setup'});
  else if(!event.event_teams?.length||!event.matches?.length)tasks.push({id:'schedule',text:canEdit?'Download the event’s teams and match schedule from Event setup. A future event may not have published its schedule yet.':'This event has no complete downloaded schedule. Ask an admin to refresh its official data. Future events may not have a schedule yet.',route:'/events',action:'View event setup'});
  for(const kind of ['match','pit'])if(!(data.forms||[]).some(form=>!form.archived&&!form.archived_at&&(form.kind||'match')===kind))tasks.push({id:kind,text:canEdit?`Open ${kind} forms and choose New form. Add the questions your scouts should answer.`:`Ask an admin to create a ${kind} scouting form before collecting these reports.`,route:`/${kind}`,action:`Open ${kind} forms`});
  if(!tasks.length)return null;
  if(dismissed)return <div className="a-setup-dismissed"><button className="a-button" onClick={()=>dismiss(false)}>Show setup help</button></div>;
  return <details className="a-setup-guide" open={!event||section==='dashboard'}><summary>Setup help <span>{tasks.length} {tasks.length===1?'step needs':'steps need'} attention</span></summary><button className="a-button" onClick={()=>dismiss(true)}>Dismiss setup</button><ol>{tasks.map(task=><li key={task.id}><p>{task.text}</p><a className="a-button" href={`#${task.route}`}>{task.action}</a></li>)}</ol><p className="a-muted a-small">Manual events and saved forms can still work offline. Setup never removes existing reports.</p></details>;
}
