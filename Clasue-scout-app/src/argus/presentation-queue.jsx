import {useEffect,useRef,useState,useMemo} from 'react';
import {TeamPresentation} from './analytics-views.jsx';
import {presentationSnapshot,presentationSignature} from './presentation-model.js';

export default function PresentationLauncher({analytics,event,data,role,teamNumber,onClose}) {
 const all=teamNumber==='all';
 const [order,setOrder]=useState(()=>all?[...new Set((event?.event_teams||[]).map(row=>String(row.team_number??row.number)).filter(number=>/^[1-9]\d*$/.test(number)))].sort((a,b)=>Number(a)-Number(b)):[String(teamNumber)]);
 const [started,setStarted]=useState(!all),[source,setSource]=useState(()=>structuredClone(analytics)),[includeNotes,setIncludeNotes]=useState(false),[progress,setProgress]=useState(null);
 const worker=useRef(null),rejectExport=useRef(null);
 const [lists,setLists]=useState(()=>structuredClone((data.picklists||[]).filter(row=>row.event_key===event?.event_key)));
 const snapshot=useMemo(()=>presentationSnapshot(source,{includeNotes,picklists:lists}),[source,includeNotes,lists]);
 const changed=presentationSignature(analytics)!==presentationSignature(source)||JSON.stringify(lists)!==JSON.stringify((data.picklists||[]).filter(row=>row.event_key===event?.event_key));
 const permittedNotes=['owner','admin'].includes(role);
 useEffect(()=>()=>{const task=worker.current;worker.current=null;task?.terminate();rejectExport.current?.(new Error('Export cancelled.'));},[]);
 function cancel(){worker.current?.terminate();worker.current=null;rejectExport.current?.(new Error('Export cancelled. No partial file was downloaded.'));rejectExport.current=null;setProgress(null);}
 async function exportFile(format) {
  if(worker.current)throw new Error('Wait for the current export or cancel it.');
  setProgress({completed:0,total:0});
  return new Promise((resolve,reject)=>{
   rejectExport.current=reject;
   const task=new Worker(new URL('./presentation-export.worker.js',import.meta.url),{type:'module'});worker.current=task;
   const finish=()=>{task.terminate();worker.current=null;rejectExport.current=null;setProgress(null);};
   task.onmessage=({data})=>{
    if(worker.current!==task)return;
    if(data.progress){setProgress(data.progress);return;}
    if(data.error){finish();reject(new Error(data.error));return;}
    if(data.result){const result=data.result,url=URL.createObjectURL(result.blob),anchor=document.createElement('a');anchor.href=url;anchor.download=result.filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);finish();resolve(result);}
   };
   task.onerror=()=>{if(worker.current!==task)return;finish();reject(new Error('Export could not finish. Try a smaller event or retry.'));};
   task.postMessage({format,analytics:snapshot,teamNumbers:order,includeNotes:permittedNotes&&includeNotes});
  });
 }
 function move(index,direction){setOrder(current=>{const next=[...current],to=index+direction;if(to<0||to>=next.length)return current;[next[index],next[to]]=[next[to],next[index]];return next;});}
 const noteControl=permittedNotes&&<label><input type="checkbox" checked={includeNotes} disabled={!!progress} onChange={e=>setIncludeNotes(e.target.checked)}/> Include authorized notes</label>;
 if(!started)return <section className="a-panel a-stack"><h1>Present All</h1><p>Review every team in this event. Move teams into your discussion order, then start a frozen presentation. Exports use the same data and order.</p>{noteControl}<ol className="a-presentation-order">{order.map((number,index)=><li key={number}><strong>Team {number}</strong><button className="a-button" aria-label={`Move team ${number} up`} disabled={index===0} onClick={()=>move(index,-1)}>Move up</button><button className="a-button" aria-label={`Move team ${number} down`} disabled={index===order.length-1} onClick={()=>move(index,1)}>Move down</button></li>)}</ol>{!order.length&&<p>No official event teams are downloaded.</p>}<div className="a-row"><button className="a-button a-primary" disabled={!order.length} onClick={()=>{setSource(structuredClone(analytics));setStarted(true);}}>Start presentation</button><button className="a-button" onClick={onClose}>Back to teams</button></div></section>;
 return <TeamPresentation closeLabel={all?'Back to teams':'Back to team'} analytics={snapshot} teamNumber={order[0]} teamNumbers={order} onClose={()=>{cancel();onClose();}} onExport={exportFile} toolbar={<>{noteControl}<a className="a-button" href="#/strategy">Open picklist</a>{changed&&<button className="a-button" disabled={!!progress} onClick={()=>{setSource(structuredClone(analytics));setLists(structuredClone((data.picklists||[]).filter(row=>row.event_key===event?.event_key)));}}>New data available — refresh</button>}{progress&&<span role="status">Export: {progress.completed} / {progress.total||'preparing'} <button className="a-button" onClick={cancel}>Cancel export</button></span>}</>}/>;
}
