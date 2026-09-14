import { useEffect, useState } from 'react';
import { offline, exportPending } from './offline.js';

export function SyncPanel({ state, shellReady, onClose }) {
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  async function retry() {
    setWorking(true);setError('');
    try {
      await offline.sync(); await offline.prepare();
      if (navigator.storage?.persist) await navigator.storage.persist();
    } catch(e) { setError(e.message); }
    finally { setWorking(false); }
  }
  return <section className="panel sync-panel" aria-label="Device and upload status">
    <div className="section-heading"><div><span className="eyebrow">This device</span><h2>Saved here. Synced to your team.</h2></div><button className="quiet-button" onClick={onClose}>Close</button></div>
    <div className="sync-summary"><div><strong>{state.pending}</strong><span>reports waiting to upload</span></div><div><strong>{state.connection==='online'?'Connected':'Offline'}</strong><span>{state.syncing?'Checking for saved reports…':'Uploads retry automatically with Argus open.'}</span></div></div>
    <p>{shellReady&&state.readyAt?'Your forms and app are downloaded for offline use.':!window.isSecureContext?'Open your server’s HTTPS address to enable offline reopening. Reports can still be saved while this page stays open.':'Connect once and let this device finish downloading the app and forms.'}</p>
    <p className="muted">Stay signed in on this browser. If Argus is closed, reopen it after reconnecting to finish uploads. Clearing browser data also clears unsynced reports.</p>
    {(error||state.error)&&<p role="alert" className="error-text">{error||state.error}</p>}
    <div className="button-row"><button className="primary-button" disabled={working||state.syncing} onClick={retry}>{working?'Checking…':'Sync & prepare device'}</button>{state.pending>0&&<button className="quiet-button" onClick={()=>exportPending().catch(e=>setError(e.message))}>Download pending reports</button>}</div>
  </section>;
}

export function HomeDashboard({ team, user, role, mem, api, onNavigate, syncState, shellReady, onShowSync, onDeleteAccount, onDeleteTeam, onLeaveTeam }) {
  const [data,setData]=useState({forms:[],submissions:[],memberships:[],announcements:[],scout_events:[]});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    Promise.all(Object.keys(data).map(async store=>[store,await api('GET',`/${store}?team_id=${encodeURIComponent(team.id)}`)]))
      .then(rows=>{if(active)setData(Object.fromEntries(rows));})
      .catch(e=>{if(active)setError(e.message);})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
    // Refresh on team changes; API identity is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[team.id,api]);
  const reports=data.submissions.filter(row=>row.user_id===user.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const news=[...data.announcements].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const event=data.scout_events[0];
  return <div className="dashboard page-enter">
    <div className="dashboard-intro"><div><span className="eyebrow">Team {team.number} · {team.name}</span><h1>Ready for the next match.</h1><p>Welcome back, {user.username}. Your scouting workspace is ready.</p></div><button className="primary-button" onClick={()=>onNavigate('forms')}>Start scouting <span aria-hidden="true">↗</span></button></div>
    {error&&<div className="notice" role="status">{error}</div>}
    <div className="stat-grid">
      {[['Forms ready',data.forms.length,'forms'],['Your reports',reports.length,'forms'],['Team members',data.memberships.length,'myteam'],['Waiting to upload',syncState.pending,'sync']].map(([label,value,target])=><button key={label} className="stat-card" onClick={()=>target==='sync'?onShowSync():onNavigate(target)}><span>{label}<span aria-hidden="true">↗</span></span><strong>{loading&&target!=='sync'?'—':value}</strong><small>{target==='sync'?(syncState.pending?'Saved on this device':'You’re up to date'):target==='forms'&&label==='Forms ready'?'Match & pit scouting':label==='Your reports'?'Submitted by you':'Your scouting crew'}</small></button>)}
    </div>
    <div className="dashboard-grid">
      <section className="panel"><div className="section-heading"><div><span className="eyebrow">Get on the field</span><h2>Scouting forms</h2></div><button className="text-button" onClick={()=>onNavigate('forms')}>View all →</button></div>
        {data.forms.length?data.forms.slice(0,4).map((form,i)=><button className="resource-row" key={form.id} onClick={()=>onNavigate('forms')}><span className="resource-number">{String(i+1).padStart(2,'0')}</span><span><strong>{form.title}</strong><small>{form.questions?.length||0} questions · {form.allow_team_select?'Team selection':'Scouting report'}</small></span><span aria-hidden="true">↗</span></button>):<div className="empty-state"><strong>{loading?'Loading forms…':'Your next report starts here'}</strong><p>{role==='member'?'Your team’s forms will appear here when an admin creates them.':'Create a match or pit form to get the team scouting.'}</p><button className="quiet-button" onClick={()=>onNavigate('forms')}>Go to forms</button></div>}
      </section>
      <section className="panel event-panel"><span className="eyebrow">Competition</span><h2>{event?.event_name||event?.name||'Set up your event'}</h2><p>{event?'Keep your schedule, team list, and pit coverage together.':'Choose the competition your team is attending to bring in the schedule and team list.'}</p><div className="event-meta"><span>Team {team.number}</span><span>{event?.event_teams?.length?`${event.event_teams.length} teams`:'Event workspace'}</span></div><button className="quiet-button" onClick={()=>onNavigate('event')}>{event?'Open event':'Go to event'} →</button></section>
      <section className="panel"><div className="section-heading"><h2>Team updates</h2><button className="text-button" onClick={()=>onNavigate('announce')}>All news →</button></div>{news.length?news.slice(0,3).map(item=><article className="news-item" key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>{item.author} · {new Date(item.created_at).toLocaleDateString()}</small></article>):<div className="empty-state"><strong>No new announcements</strong><p>Team notes and reminders will appear here. Check in with your scouting lead before the next match.</p></div>}</section>
      <section className="panel device-panel"><span className="eyebrow">Argus anywhere</span><h2>{syncState.pending?`${syncState.pending} report${syncState.pending===1?'':'s'} saved on this device`:shellReady&&syncState.readyAt?'Ready to go offline':'Prepare for offline scouting'}</h2><p>{syncState.pending?'Your reports will upload automatically when the server is reachable. Keep Argus open to finish syncing.':'Downloaded forms work without a connection. Your reports stay on this device until they reach the server.'}</p><div className="device-status"><span className={`status-dot ${syncState.connection==='offline'?'offline-dot':''}`}/>{syncState.connection==='online'?'Server connected':'Working from this device'}</div><button className="quiet-button" onClick={onShowSync}>Device & sync details →</button></section>
    </div>
    <details className="panel account-settings"><summary>Account & team settings <span>{role}</span></summary><div className="button-row">{mem?.role!=='owner'&&data.memberships.length>1&&<button className="quiet-button" onClick={onLeaveTeam}>Leave team</button>}<button className="quiet-button" onClick={onDeleteAccount}>Delete my account</button>{role==='owner'&&<button className="quiet-button" onClick={onDeleteTeam}>Delete team</button>}</div></details>
  </div>;
}
