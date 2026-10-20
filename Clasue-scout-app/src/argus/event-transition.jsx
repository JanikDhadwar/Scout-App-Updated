import { useCallback, useEffect, useRef, useState } from 'react';

export function EventTransition({teamId,nextEventId,api,pending=0,onCancel,onComplete}) {
 const dialog=useRef(null),[preview,setPreview]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[mode,setMode]=useState('export'),[deleteForms,setDeleteForms]=useState(false),[confirmation,setConfirmation]=useState(''),[downloaded,setDownloaded]=useState(false),[backupConfirmed,setBackupConfirmed]=useState(false);
 const load=useCallback(async()=>{setBusy(true);setError('');setDownloaded(false);setBackupConfirmed(false);setConfirmation('');try{setPreview(await api('GET',`/event-transition/preview?${new URLSearchParams({team_id:teamId,next_event_id:nextEventId})}`));}catch(e){setPreview(null);setError(e.message);}finally{setBusy(false);}},[api,teamId,nextEventId]);
 useEffect(()=>{const previous=document.activeElement;dialog.current.showModal();return()=>{if(previous?.isConnected)previous.focus();};},[]);
 useEffect(()=>{let active=true;Promise.resolve().then(()=>{if(active)load();});return()=>{active=false;};},[load]);
 function download(){
  const blob=new Blob([JSON.stringify({...preview.export,exported_at:new Date().toISOString()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`argus-${preview.current?.event_key||'event'}-backup.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setDownloaded(true);
 }
 async function submit(e){e.preventDefault();if(busy||!preview)return;setBusy(true);setError('');try{const result=await api('POST','/event-transition',{team_id:teamId,next_event_id:nextEventId,expected:preview.fingerprint,delete_forms:deleteForms});await onComplete(result);}catch(err){setError(err.message);setBusy(false);}}
 const hasCurrent=!!preview?.current,confirmed=!hasCurrent||confirmation.trim()===preview.current.event_key,exportReady=!hasCurrent||mode==='delete'||downloaded&&backupConfirmed;
 return <dialog ref={dialog} className="a-event-transition" aria-labelledby="event-transition-title" onCancel={e=>{if(busy)e.preventDefault();}} onClose={onCancel}>
  <form onSubmit={submit} className="a-stack">
   <div className="a-row"><h2 id="event-transition-title">Change event</h2><button className="a-button" type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
   {preview?<><p>Switch to <strong>{preview.next.event_name||preview.next.event_key}</strong>. This becomes the active event for everyone on your team.</p>
    {hasCurrent&&<><p>Delete data for <strong>{preview.current.event_name||preview.current.event_key}</strong> ({preview.current.event_key}):</p>
     <ul><li>{preview.counts.submissions} scouting reports, including their photos and drawings</li><li>{preview.counts.pit_scouts} pit visits</li><li>{preview.counts.assignments} assignments and {preview.counts.picklists} picklists</li><li>Downloaded schedule, rankings and event analytics settings</li></ul>
     <fieldset disabled={busy}><legend>Outgoing event data</legend><label><input type="radio" name="event-data-action" checked={mode==='export'} onChange={()=>setMode('export')}/> Export and delete data</label><label><input type="radio" name="event-data-action" checked={mode==='delete'} onChange={()=>setMode('delete')}/> Delete data without exporting</label></fieldset>
     {mode==='export'&&<div className="a-stack"><button type="button" className="a-button" disabled={busy} onClick={download}>Download event backup</button><label><input type="checkbox" checked={backupConfirmed} disabled={!downloaded||busy} onChange={e=>setBackupConfirmed(e.target.checked)}/> I saved the event backup and can open it.</label><small className="a-muted">The JSON backup includes event reports, media, forms, assignments and picklists. It may contain private scouting information. Keep it somewhere safe.</small></div>}
    </>}
    <fieldset disabled={busy}><legend>Forms ({preview.counts.forms})</legend><label><input type="radio" name="event-form-action" checked={!deleteForms} onChange={()=>setDeleteForms(false)}/> Keep forms for the next event</label><label><input type="radio" name="event-form-action" checked={deleteForms} onChange={()=>setDeleteForms(true)}/> Delete forms from new scouting</label></fieldset>
    {deleteForms&&<p className="a-muted">Forms will be removed from new scouting. Archived definitions remain available for unfinished drafts and older reports.</p>}
    {pending>0&&<p className="a-danger" role="status">This device has {pending} pending reports. They are not included in the server backup. Finish syncing or export them in Device and sync first. Other scouts may also have offline reports.</p>}
    <p className="a-danger">{hasCurrent?'Deleted event data cannot be restored inside Argus. ':''}Local drafts and pending reports stay on their original devices. Reports for a cleared event cannot upload later; export them from Device and sync.</p>
    {hasCurrent&&<label>Type {preview.current.event_key} to confirm deletion<input autoComplete="off" className="a-input" aria-label="Confirm outgoing event key" value={confirmation} disabled={busy} onChange={e=>setConfirmation(e.target.value)}/></label>}
    <button className="a-button a-primary" disabled={busy||!confirmed||!exportReady}>{busy?'Changing event…':hasCurrent?'Delete outgoing data and change event':'Activate event'}</button>
   </>:<p role="status">{busy?'Loading event preview…':'No preview available.'}</p>}
   {error&&<div role="alert" className="a-danger"><p>{error}</p><button type="button" className="a-button" disabled={busy} onClick={load}>Reload event preview</button></div>}
  </form>
 </dialog>;
}
