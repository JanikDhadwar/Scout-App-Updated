import { useEffect, useState } from 'react';
import { offline, exportPending } from './offline.js';
import { Disclosure, Icon } from './ui-primitives.jsx';

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
    <div className="section-heading"><div><h2>Device & sync</h2><p className="muted">Check your connection and saved reports.</p></div><button className="quiet-button" onClick={onClose}>Close</button></div>
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
    <div className="dashboard-intro"><div><span className="workspace-context">Team {team.number} scouting</span><h1>Welcome back, {user.username}.</h1><p>Choose a form, scout a team, and keep the crew up to date.</p></div><button className="primary-button" onClick={()=>onNavigate('forms')}>Start scouting <Icon name="arrow" size={18}/></button></div>
    {error&&<div className="notice" role="status">{error}</div>}
    <div className="stat-grid">
      {[['Scouting forms',data.forms.length,'forms'],['Your reports',reports.length,'forms'],['Team members',data.memberships.length,'myteam'],['Pending uploads',syncState.pending,'sync']].map(([label,value,target])=><button key={label} className="stat-card" onClick={()=>target==='sync'?onShowSync():onNavigate(target)}><span>{label}<Icon name="chevron" size={14}/></span><strong>{loading&&target!=='sync'?'…':value}</strong><small>{target==='sync'?(syncState.pending?'Saved on this device':'Everything is uploaded'):target==='forms'&&label==='Scouting forms'?'Match and pit scouting':label==='Your reports'?'Submitted by you':'In this workspace'}</small></button>)}
    </div>
    <div className="dashboard-grid">
      <section className="panel scouting-panel"><div className="section-heading"><div><h2>Ready to scout</h2><p className="muted section-description">Your team's match and pit forms.</p></div><button className="text-button" onClick={()=>onNavigate('forms')}>All forms <Icon name="arrow" size={16}/></button></div>
        {data.forms.length?data.forms.slice(0,4).map(form=><button className="resource-row" key={form.id} onClick={()=>onNavigate('forms')}><span className="resource-number"><Icon name="forms"/></span><span><strong>{form.title}</strong><small>{form.questions?.length||0} questions, {form.allow_team_select?'team selection':'scouting report'}</small></span><Icon name="chevron" size={18}/></button>):<div className="empty-state"><span className="empty-icon"><Icon name="forms" size={26}/></span><strong>{loading?'Loading forms…':'No scouting forms yet'}</strong><p>{role==='member'?"Your team's forms will appear here when an admin creates them.":'Create a match or pit form to start collecting reports.'}</p><button className="quiet-button" onClick={()=>onNavigate('forms')}>Go to forms</button></div>}
      </section>
      <section className="panel event-panel"><div className="panel-label"><Icon name="event"/><span>Competition</span></div><h2>{event?.event_name||event?.name||'Where are we competing?'}</h2><p>{event?'View the match schedule, team list, and pit coverage for your competition.':'Pick an event to see the match schedule and teams to scout.'}</p><div className="event-meta"><span>Team {team.number}</span>{!!event?.event_teams?.length&&<span>{event.event_teams.length} teams</span>}</div><button className="quiet-button" onClick={()=>onNavigate('event')}>{event?'Open event':'Choose an event'} <Icon name="arrow" size={16}/></button></section>
      <section className="panel updates-panel"><div className="section-heading"><h2>Team updates</h2><button className="text-button" onClick={()=>onNavigate('announce')}>All news <Icon name="arrow" size={16}/></button></div>{news.length?news.slice(0,3).map(item=><article className="news-item" key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>{item.author}, {new Date(item.created_at).toLocaleDateString()}</small></article>):<div className="empty-state compact-empty"><span className="empty-icon"><Icon name="news" size={24}/></span><div><strong>No announcements yet</strong><p>Notes from your scouting lead will appear here.</p></div></div>}</section>
      <section className="panel device-panel"><div className="panel-label"><Icon name="device"/><span>On this device</span></div><h2>{syncState.pending?`${syncState.pending} report${syncState.pending===1?'':'s'} waiting to upload`:shellReady&&syncState.readyAt?'Offline scouting is ready':'Scout without Wi-Fi'}</h2><p>{syncState.pending?'Your reports will upload when the server is reachable. Keep Argus open to finish syncing.':'Download your forms before the event. Reports save on this device and upload when you reconnect.'}</p><div className="device-status"><span className={`status-dot ${syncState.connection==='offline'?'offline-dot':''}`}/>{syncState.connection==='online'?'Server connected':'Working from this device'}</div><button className="text-button" onClick={onShowSync}>Device & sync <Icon name="arrow" size={16}/></button></section>
    </div>
    <Disclosure title="Account & team settings" trailing={role}><p className="muted">These actions affect your account or team. You will be asked to confirm.</p><div className="button-row">{mem?.role!=='owner'&&data.memberships.length>1&&<button className="quiet-button danger-button" onClick={onLeaveTeam}>Leave team</button>}<button className="quiet-button danger-button" onClick={onDeleteAccount}>Delete my account</button>{role==='owner'&&<button className="quiet-button danger-button" onClick={onDeleteTeam}>Delete team</button>}</div></Disclosure>
  </div>;
}
