import { useEffect, useRef, useState } from 'react';
import { moveEntry, teamDirectory } from './strategy-model.js';
import './strategy.css';

export function Strategy({data={},workspace,event,user,role,api,onOpenTeam,onCompare,onPresent,onRefresh}) {
  const eventKey=event?.event_key||'';
  const lists=(data.picklists||[]).filter(x=>x.team_id===workspace.id&&x.event_key===eventKey);
  const storageKey=`argus:picklist-draft:${user.id}:${workspace.id}:${eventKey}`;
  const [restored]=useState(()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'null');}catch{return null;}});
  const [selected,setSelected]=useState(restored?.selected||''),[draft,setDraft]=useState(restored?.draft||null),[query,setQuery]=useState(''),[chosen,setChosen]=useState([]),[error,setError]=useState(''),[message,setMessage]=useState(restored?'Unsaved picklist restored from this device.':''),[saving,setSaving]=useState(false),[dirty,setDirty]=useState(!!restored);
  const dragged=useRef(null);
  useEffect(()=>{try{if(dirty&&draft)localStorage.setItem(storageKey,JSON.stringify({selected,draft}));else localStorage.removeItem(storageKey);}catch{queueMicrotask(()=>setError('Your picklist draft could not be saved on this device. Save it to the server before leaving.'));}},[draft,dirty,selected,storageKey]);
  useEffect(()=>{if(!dirty)return;const guard=e=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty]);
  const teams=teamDirectory(data,workspace,event);
  const canEdit=['owner','admin'].includes(role);
  const update=patch=>{setDraft(current=>({...current,...patch}));setDirty(true);setMessage('Unsaved changes');setError('');};
  function openList(id){if(dirty&&!window.confirm('Discard unsaved picklist changes?'))return;const row=lists.find(x=>x.id===id);setSelected(id);setDraft(row?{...row,entries:(row.entries||[]).map(x=>({...x}))}:null);setDirty(false);setChosen([]);setError('');setMessage('');}
  function create(){if(dirty&&!window.confirm('Discard unsaved picklist changes?'))return;const row={id:crypto.randomUUID(),team_id:workspace.id,event_key:eventKey,name:'Alliance selection',entries:[],revision:0,created_by:user.id};setSelected('');setDraft(row);setDirty(true);setChosen([]);setMessage('New picklist — save to keep it.');setError('');}
  async function save(){if(!draft?.name.trim()){setError('Give this picklist a name.');return;}setSaving(true);setError('');try{const body={...draft,name:draft.name.trim()};const saved=await api(selected?'PATCH':'POST',selected?`/picklists/${encodeURIComponent(selected)}`:'/picklists',body);setDraft(saved||body);setSelected((saved||body).id);setDirty(false);setMessage('Picklist saved on the server.');await onRefresh?.();}catch(e){setError(e.status===409?'This picklist changed on another device. Your edits are preserved here. Reload the saved list to review changes before saving again.':e.message||'Could not save. Your changes are still on this screen.');}finally{setSaving(false);}}
  const entries=draft?.entries||[];
  const add=t=>{if(entries.some(x=>Number(x.team_number)===t.team_number))return;update({entries:[...entries,{team_number:t.team_number,note:'',review:false}]});};
  const changeEntry=(i,patch)=>update({entries:entries.map((x,j)=>i===j?{...x,...patch}:x)});
  const reorder=(from,to)=>update({entries:moveEntry(entries,from,to)});
  return <div className="a-stack argus-strategy"><header><h1>Alliance strategy</h1><p className="a-muted">Build an event picklist from observed evidence. Ordering reflects your planning, not official rankings.</p></header>
    {!eventKey?<section className="a-panel a-empty">Select an event in Event Data before creating an alliance picklist.</section>:<>
      <section className="a-panel a-row"><label>Saved picklist<select className="a-input" value={selected} onChange={e=>openList(e.target.value)}><option value="">Choose a list</option>{lists.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>{canEdit&&<button className="a-button" onClick={create}>New picklist</button>}<span className="a-muted">{event.event_name||eventKey}</span></section>
      {!canEdit&&<p className="a-muted">Admins and owners can create and edit shared picklists. You can inspect saved lists and compare teams.</p>}
      {error&&<div className="a-panel a-danger" role="alert">{error}{selected&&<button className="a-button" onClick={()=>openList(selected)}>Reload saved version</button>}</div>}
      {message&&<p role="status">{message}</p>}
      {draft?<div className="strategy-layout"><section className="a-panel a-stack"><div className="a-row"><label className="strategy-name">Picklist name<input className="a-input" value={draft.name} disabled={!canEdit||saving} onChange={e=>update({name:e.target.value})}/></label>{canEdit&&<button className="a-button" disabled={saving||!dirty} onClick={save}>{saving?'Saving…':'Save picklist'}</button>}</div>
        <div className="a-row"><button className="a-button" disabled={chosen.length<2||chosen.length>4} onClick={()=>onCompare?.(chosen)}>Compare selected ({chosen.length}/4)</button><small className="a-muted">Select two to four teams.</small></div>
        {!entries.length&&<p className="a-empty">Add teams from the directory to begin your picklist.</p>}
        <ol className="picklist-entries">{entries.map((entry,i)=>{const num=Number(entry.team_number), t=teams.find(t=>t.team_number===num);return <li className="picklist-entry" key={num} draggable={canEdit&&!saving} onDragStart={e=>{dragged.current=i;e.dataTransfer.effectAllowed='move';}} onDragOver={e=>{if(canEdit)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(canEdit&&dragged.current!==null){reorder(dragged.current,i);dragged.current=null;}}} onDragEnd={()=>{dragged.current=null;}}>
          <div className="a-row"><strong className="pick-rank">{i+1}</strong><label className="pick-select"><input type="checkbox" aria-label={`Compare team ${num}`} checked={chosen.includes(num)} disabled={!chosen.includes(num)&&chosen.length>=4} onChange={()=>setChosen(c=>c.includes(num)?c.filter(x=>x!==num):[...c,num])}/> Team {num}</label><span className="a-muted">{t?.nickname||''}</span></div>
          <div className="a-row"><button className="a-button" onClick={()=>onOpenTeam?.(num)}>Analytics</button><button className="a-button" onClick={()=>onPresent?.(num)}>Present team</button>{canEdit&&<><button className="a-button" aria-label={`Move team ${num} up`} disabled={i===0||saving} onClick={()=>reorder(i,i-1)}>↑ Move up</button><button className="a-button" aria-label={`Move team ${num} down`} disabled={i===entries.length-1||saving} onClick={()=>reorder(i,i+1)}>↓ Move down</button></>}</div>
          <label>Team {num} strategy notes<textarea aria-label={`Team ${num} strategy notes`} className="a-input" value={entry.note||''} disabled={!canEdit||saving} rows={2} onChange={e=>changeEntry(i,{note:e.target.value})}/></label>
          <div className="a-row"><label><input type="checkbox" checked={!!entry.review} disabled={!canEdit||saving} onChange={e=>changeEntry(i,{review:e.target.checked})}/> Needs review</label>{canEdit&&<button className="a-button a-danger" disabled={saving} onClick={()=>{update({entries:entries.filter((_,j)=>j!==i)});setChosen(c=>c.filter(x=>x!==num));}}>Remove team {num}</button>}</div>
        </li>;})}</ol>
      </section><aside className="a-panel a-stack"><h2>Team directory</h2><label>Find a team<input className="a-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Number or name"/></label><ul className="strategy-directory">{teams.filter(t=>`${t.team_number} ${t.nickname}`.toLowerCase().includes(query.toLowerCase())).map(t=><li key={t.team_number}><span><strong>{t.team_number}</strong><small className="a-muted">{t.nickname}</small></span><button className="a-button" disabled={!canEdit||saving||entries.some(x=>Number(x.team_number)===t.team_number)} onClick={()=>add(t)}>{entries.some(x=>Number(x.team_number)===t.team_number)?'Added':'Add'}</button></li>)}</ul>{!teams.length&&<p className="a-empty">Event teams or scouting reports will populate this directory.</p>}</aside></div>:<section className="a-panel a-empty">Choose a saved picklist{canEdit?' or create one to start planning.':'.'}</section>}
    </>}
  </div>;
}
export default Strategy;
