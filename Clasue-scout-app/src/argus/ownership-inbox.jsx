import { useCallback, useEffect, useState } from 'react';

export function OwnershipInbox({ api, workspace, user }) {
  const [offers,setOffers]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const load=useCallback(async()=>{try{setOffers(await api('GET',`/ownership-transfers?team_id=${encodeURIComponent(workspace.id)}`));}catch{/* Offers require a live authenticated connection. */}},[api,workspace.id]);
  useEffect(()=>{Promise.resolve().then(load);const timer=setInterval(load,30000);return()=>clearInterval(timer);},[load]);
  const incoming=offers.filter(o=>o.to_user_id===user.id&&o.status==='pending');
  async function respond(offer,action){setBusy(true);setError('');try{await api('POST',`/ownership-transfers/${offer.id}/respond`,{action});await load();window.dispatchEvent(new Event('argus-role-check'));window.dispatchEvent(new Event('argus-workspace-updated'));}catch(e){setError(e.message);}finally{setBusy(false);}}
  if(!incoming.length&&!error)return null;
  return <section className="a-panel a-stack" aria-label="Ownership transfer offers"><h2>Workspace ownership offered</h2>{incoming.map(offer=><div key={offer.id}><p>The current Owner offered you ownership of this workspace. Accepting makes you Owner and makes them Admin. Expires {new Date(offer.expires_at).toLocaleTimeString()}.</p><div className="a-row"><button className="a-button a-primary" disabled={busy} onClick={()=>respond(offer,'accept')}>Accept workspace ownership</button><button className="a-button" disabled={busy} onClick={()=>respond(offer,'decline')}>Decline workspace ownership</button></div></div>)}{error&&<p role="alert" className="a-danger">{error}</p>}</section>;
}
