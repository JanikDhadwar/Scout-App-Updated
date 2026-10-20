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
    <div className="dashboard-intro">
      <div><h1>Scouting</h1><p>{loading ? 'Loading team data…' : `${data.forms.length} ${data.forms.length === 1 ? 'form' : 'forms'} available`}</p></div>
      <button className="primary-button" onClick={()=>onNavigate('forms')}>Open forms</button>
    </div>
    {error&&<div className="notice" role="status">{error}</div>}
    <div className="scouting-workspace">
      <div className="workspace-primary">
        <section className="workspace-section" aria-label="Scouting forms">
          <div className="section-heading"><h2>Scouting forms</h2><span className="section-note">Match & pit reports</span></div>
          <div className="form-list-heading" aria-hidden="true"><span>Form</span><span>Questions</span><span/></div>
          {data.forms.length ? data.forms.slice(0,6).map(form=><button className="scout-form-row" key={form.id} onClick={()=>onNavigate('forms')}>
            <Icon name="forms" size={18}/><span className="scout-form-name"><strong>{form.title}</strong><small>{form.allow_team_select?'Team scouting':'General report'}</small></span>
            <span className="question-count">{form.questions?.length||0}</span><Icon name="chevron" size={16}/>
          </button>) : <div className="list-empty"><p>{loading?'Loading forms…':role==='member'?'An admin needs to add your scouting forms.':'No forms yet. Add a form to start scouting.'}</p><button className="text-button" onClick={()=>onNavigate('forms')}>{role==='member'?'View forms':'Create a form'}</button></div>}
          {data.forms.length>6&&<button className="text-button" onClick={()=>onNavigate('forms')}>View all {data.forms.length} forms</button>}
        </section>
        <section className="workspace-section" aria-label="Your recent reports">
          <div className="section-heading"><h2>Your recent reports</h2><span className="section-note">{reports.length} submitted</span></div>
          {reports.length ? <ul className="recent-report-list">{reports.slice(0,4).map(report=><li key={report.id}>
            <span><strong>{report.scouted_team?`Team ${report.scouted_team}`:report.form_title||'Scouting report'}</strong><small>{report.scouted_team?report.form_title||'Scouting report':report.submitted_by}</small></span>
            <time dateTime={report.created_at}>{new Date(report.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time>
          </li>)}</ul> : <p className="section-empty">{loading?'Loading reports…':'Your submitted reports will appear here.'}</p>}
        </section>
        <section className="workspace-section" aria-label="Team updates">
          <div className="section-heading"><h2>Team updates</h2><button className="text-button" onClick={()=>onNavigate('announce')}>View news</button></div>
          {news.length ? news.slice(0,3).map(item=><article className="news-item" key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>{item.author}, {new Date(item.created_at).toLocaleDateString()}</small></article>) : <p className="section-empty">No announcements.</p>}
        </section>
      </div>
      <aside className="workspace-aside" aria-label="Competition and device">
        <section className="workspace-section event-panel">
          <h2>Current event</h2><h3>{event?.event_name||event?.name||'No event selected'}</h3>
          <p>{event?'Match schedule, team assignments, and pit coverage.':'Select a competition to load its teams and match schedule.'}</p>
          {!!event?.event_teams?.length&&<p className="event-team-count">{event.event_teams.length} teams attending</p>}
          <button className="quiet-button" onClick={()=>onNavigate('event')}>{event?'View event':'Select event'}</button>
        </section>
        <section className="workspace-section device-panel">
          <div className="section-heading"><h2>Device status</h2><span className={`status-dot ${syncState.connection==='offline'?'offline-dot':''}`}/></div>
          <dl className="device-facts"><div><dt>Connection</dt><dd>{syncState.connection==='online'?'Connected':syncState.connection==='checking'?'Checking…':'Offline'}</dd></div><div><dt>Pending uploads</dt><dd>{syncState.pending}</dd></div><div><dt>Offline forms</dt><dd>{shellReady&&syncState.readyAt?'Downloaded':'Not ready'}</dd></div></dl>
          {syncState.pending>0&&<p>Keep Argus open to finish uploading your saved reports.</p>}
          <button className="text-button" onClick={onShowSync}>Sync details</button>
        </section>
        <Disclosure title="Account settings"><p className="muted">Signed in as {user.username}. Your role is {role}.</p><div className="button-row">{mem?.role!=='owner'&&data.memberships.length>1&&<button className="quiet-button danger-button" onClick={onLeaveTeam}>Leave team</button>}<button className="quiet-button danger-button" onClick={onDeleteAccount}>Delete my account</button>{role==='owner'&&<button className="quiet-button danger-button" onClick={onDeleteTeam}>Delete team</button>}</div></Disclosure>
      </aside>
    </div>
  </div>;
}
