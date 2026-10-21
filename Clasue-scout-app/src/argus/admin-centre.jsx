import { useCallback, useEffect, useRef, useState } from 'react';
import { OwnershipManager } from './assignment-hub.jsx';
import { matchLabel } from './workspace-model.js';
import { Assignments as DutyEditor } from './operations.jsx';
import { CoverageBoard } from './coverage-board.jsx';
const adminSections=[['attention','Needs attention'],['members','Members'],['assignments','Assignments'],['reports','Forms and reports'],['sharing','Shared data'],['activity','Activity']];

function Members({ data, workspace, user, role, api, onRefresh }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [password, setPassword] = useState(''), [target, setTarget] = useState(''), [offers, setOffers] = useState([]);
  const members = (data.memberships || []).filter(m => m.team_id === workspace.id);
  const load = useCallback(async () => { try { setOffers(await api('GET', `/ownership-transfers?team_id=${encodeURIComponent(workspace.id)}`)); } catch (e) { setError(e.message); } }, [api, workspace.id]);
  useEffect(() => { Promise.resolve().then(load); }, [load]);
  async function act(path, body, success) {
    setBusy(true); setError('');
    try { await api('POST', path, body); setMessage(success); setPassword(''); await onRefresh(); await load(); window.dispatchEvent(new Event('argus-role-check')); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="a-panel a-stack"><h2>Members and roles</h2><p className="a-muted">Admins manage ordinary Scouters. Only the Owner manages Admin roles and requests ownership transfer. Removing a member keeps reports and flags their unfinished duties.</p>
    {members.map(m => <div className="a-duty" key={m.id}><div><strong>{m.username || m.user_id}</strong><p>{m.role === 'member' ? 'Scouter' : m.role}{m.user_id === user.id ? ' · You' : ''}</p></div>{m.role !== 'owner' && m.user_id !== user.id && <div className="a-row">{role === 'owner' && <button className="a-button" disabled={busy} onClick={() => act(`/memberships/${encodeURIComponent(m.id)}/role`, { role: m.role === 'admin' ? 'member' : 'admin' }, 'Role updated.')}>{m.role === 'admin' ? 'Make Scouter' : 'Make Admin'}</button>}{(role === 'owner' || m.role === 'member') && <button className="a-button a-danger" disabled={busy} onClick={() => { if (confirm(`Remove ${m.username}? Existing reports remain. Review their unfinished assignments afterwards.`)) act(`/memberships/${encodeURIComponent(m.id)}/remove`, {}, 'Member removed. Review unfinished duties.'); }}>Remove member</button>}</div>}</div>)}
    {role === 'owner' && <details className="a-disclosure"><summary>Transfer ownership securely</summary><form className="a-stack" onSubmit={e => { e.preventDefault(); act('/auth/transfer-ownership', { team_id: workspace.id, user_id: target, password }, 'Transfer offered. The recipient must accept within 15 minutes.'); }}><p>Your role changes to Admin only after the recipient accepts.</p><label>New owner<select required className="a-input" value={target} onChange={e => setTarget(e.target.value)}><option value="">Choose an active member</option>{members.filter(m => m.user_id !== user.id).map(m => <option key={m.id} value={m.user_id}>{m.username}</option>)}</select></label><label>Confirm your password<input className="a-input" required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label><button className="a-button" disabled={busy || !target || !password}>Request ownership transfer</button></form></details>}
    {offers.filter(o => o.status === 'pending').map(o => <div className="a-help" key={o.id}><p>Ownership transfer · expires {new Date(o.expires_at).toLocaleTimeString()}</p>{o.to_user_id === user.id ? <div className="a-row"><button className="a-button" disabled={busy} onClick={() => act(`/ownership-transfers/${o.id}/respond`, { action: 'accept' }, 'Ownership transferred.')}>Accept ownership</button><button className="a-button" disabled={busy} onClick={() => act(`/ownership-transfers/${o.id}/respond`, { action: 'decline' }, 'Transfer declined.')}>Decline ownership</button></div> : <button className="a-button" disabled={busy} onClick={() => act(`/ownership-transfers/${o.id}/respond`, { action: 'cancel' }, 'Transfer cancelled.')}>Cancel transfer</button>}</div>)}
    {error && <p role="alert" className="a-danger">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}

function Reports({ workspace, event, api, onRefresh }) {
  const [result, setResult] = useState(null), [page, setPage] = useState(0), [reason, setReason] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setResult(await api('GET', `/admin/reports?${new URLSearchParams({ team_id: workspace.id, event_key: event?.event_key || '', page: String(page) })}`)); } catch (e) { setError(e.message); } }, [api, workspace.id, event, page]);
  useEffect(() => { Promise.resolve().then(load); }, [load]);
  async function change(row) {
    setBusy(true); setError('');
    try { await api('POST', `/submissions/${encodeURIComponent(row.id)}/${row.state.removed ? 'restore' : 'remove'}`, { reason, revision: row.state.revision }); await load(); await onRefresh(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function approve(row){setBusy(true);setError('');try{await api('POST',`/submissions/${encodeURIComponent(row.id)}/review`,{revision:row.state.revision,reason,approved:true});await load();await onRefresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <section className="a-panel a-stack"><h2>Forms and reports</h2><div className="a-row"><a className="a-button" href="#/pit">Manage pit forms</a><a className="a-button" href="#/match">Manage match forms</a><a className="a-button" href="#/reports">Search and export reports</a></div><p className="a-muted">Forms are archived to preserve drafts. Report removal is reversible and keeps the original payload and retry ID.</p><label>Reason for removal or restoration<input className="a-input" value={reason} maxLength={500} onChange={e => setReason(e.target.value)} /></label>
    {result?.reports.map(row => <article className="a-duty" key={row.id}><div><strong>Team {row.scouted_team} · {row.form_title || row.report_kind}</strong><p className="a-muted">{row.match_key || 'Pit / unlinked'} · {row.state.removed ? 'Removed' : 'Active'}{row.state.review_required ? ' · Legacy snapshot needs review' : ''}</p>{row.state.reason && <p>{row.state.reason}</p>}</div><div className="a-row">{!row.state.removed && <a className="a-button" href={`#/reports/${encodeURIComponent(row.id)}`}>View report</a>}{row.state.review_required&&<button className="a-button" disabled={busy||!reason.trim()} onClick={()=>approve(row)}>Approve reviewed snapshot</button>}<button className="a-button" disabled={busy || !reason.trim()} onClick={() => change(row)}>{row.state.removed ? 'Restore report' : 'Remove report'}</button></div></article>)}
    <div className="a-row"><button className="a-button" disabled={!page} onClick={() => setPage(p => p - 1)}>Previous reports</button><span>Page {page + 1} · {result?.total || 0} reports</span><button className="a-button" disabled={(page + 1) * 25 >= (result?.total || 0)} onClick={() => setPage(p => p + 1)}>Next reports</button></div>{error && <p role="alert" className="a-danger">{error}</p>}
  </section>;
}

function Sharing({ event, data, api, onRefresh }) {
  const [ids, setIds] = useState(() => event.shared_summary_policy?.metric_ids || []), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const fields = (data.forms || []).flatMap(f => (f.questions || []).filter(q => ['number', 'scale', 'boolean', 'select'].includes(q.type)).map(q => ({ id: `${f.id}:${q.id}`, label: `${f.title}: ${q.text}` })));
  async function save(e) { e.preventDefault(); setBusy(true); try { await api('PATCH', `/events/${encodeURIComponent(event.id)}/sharing`, { revision: event.sharing_revision || 0, metric_ids: ids }); setMessage('Approved summaries saved. Private reports and notes remain restricted.'); await onRefresh(); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  return <form className="a-panel a-stack" onSubmit={save}><h2>Approved shared measurements</h2><p className="a-muted">Choose measurements Scouters can see across the event. Raw private reports, scout names, notes and photos are not included.</p><fieldset disabled={busy}><legend>Publish structured evidence</legend>{fields.map(field => <label className="a-check-row" key={field.id}><input type="checkbox" checked={ids.includes(field.id)} onChange={e => setIds(current => e.target.checked ? [...current, field.id] : current.filter(id => id !== field.id))} />{field.label}</label>)}</fieldset><button className="a-button" disabled={busy}>Save approved measurements</button>{message && <p role="status">{message}</p>}</form>;
}

function Activity({ workspace, api, data }) {
  const [result, setResult] = useState({ entries: [], next: null }), [error, setError] = useState(''), [before, setBefore] = useState('');
  useEffect(() => { let active = true; api('GET', `/admin/activity?${new URLSearchParams({ team_id: workspace.id, before })}`).then(value => { if (active) setResult(value); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [api, workspace.id, before]);
  return <section className="a-panel a-stack"><h2>Activity history</h2>{result.entries.map(entry => <article className="a-duty" key={entry.id}><div><strong>{entry.action}</strong><p>{(data.memberships || []).find(m => m.user_id === entry.actor_id)?.username || (entry.actor_id ? 'Former member' : 'System')} · {new Date(entry.created_at).toLocaleString()}</p><small className="a-muted">{entry.target_id}</small>{entry.detail.reason && <p>{entry.detail.reason}</p>}</div></article>)}{!result.entries.length && <p>No recorded actions yet. Earlier actions were not backfilled.</p>}<div className="a-row"><button className="a-button" disabled={!before} onClick={() => setBefore('')}>Latest activity</button><button className="a-button" disabled={!result.next} onClick={() => setBefore(result.next)}>Older activity</button></div>{error && <p role="alert" className="a-danger">{error}</p>}</section>;
}

export default function AdminCentre(props) {
  const { event, role, api, data, onRefresh } = props;
  const [busy, setBusy] = useState(false);
  const overviewRequest=useRef(0);
  const cancelOverview=useCallback(()=>{overviewRequest.current++;},[]);
  const [tab, setTab] = useState(()=>new URLSearchParams(location.hash.split('?')[1]||'').get('tab')||'attention'), [overview, setOverview] = useState(null), [error, setError] = useState('');
  const load = useCallback(async () => { if (!event || !['owner', 'admin'].includes(role)) return; const request=++overviewRequest.current;try { const result=await api('GET', `/admin/overview?event_id=${encodeURIComponent(event.id)}`);if(request===overviewRequest.current){setOverview(result);setError('');} } catch (e) { if(request===overviewRequest.current)setError(e.message); } }, [api, event, role]);
  useEffect(() => { const refreshVisible=()=>{if(document.visibilityState!=='hidden')load();};Promise.resolve().then(refreshVisible);const timer=setInterval(refreshVisible,15000);window.addEventListener('online',refreshVisible);return()=>{clearInterval(timer);window.removeEventListener('online',refreshVisible);cancelOverview();}; }, [load,cancelOverview]);
  async function dismiss(team, slot, dismissed) {
    setBusy(true); setError('');
    try { await api('POST', '/admin/coverage', { event_id: event.id, team_number: team.team_number, match_key: slot.match_key, dismissed, revision: slot.dismissal?.revision || 0 }); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function dismissTeam(team,dismissed){
    setBusy(true);setError('');
    try{await api('POST','/admin/coverage',{scope:'team',event_id:event.id,team_number:team.team_number,dismissed,expected_revision:team.revision});await load();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const refresh = async () => { await onRefresh(); await load(); };
  if (!['owner', 'admin'].includes(role)) return <section className="a-panel"><h1>Administrator access required</h1><p>The backend also rejects protected requests.</p></section>;
  const name = id => (data.memberships || []).find(m => m.user_id === id)?.username || overview?.people?.find(p=>p.id===id)?.username || (id ? 'Former member — reassign' : 'Unassigned');
  return <div className="a-stack"><header><h1>Admin control centre</h1><p className="a-muted">{event?.event_name || 'Activate an event in Settings to review scouting progress.'}</p></header><nav className="a-admin-tabs" aria-label="Admin sections">{adminSections.map(([id, label]) => <button className="a-button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav><label className="a-admin-section">Admin section<select aria-label="Admin section" className="a-input" value={tab} onChange={e=>setTab(e.target.value)}>{adminSections.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>{error && <p role="alert" className="a-danger">{error}</p>}
    {tab === 'members' ? <Members {...props} onRefresh={refresh} /> : tab === 'reports' ? <Reports {...props} onRefresh={refresh} /> : tab === 'activity' ? <Activity {...props} /> : !event ? <section className="a-panel"><p>No active event.</p><a className="a-button" href="#/events">Manage events</a></section> : tab === 'assignments' ? <><OwnershipManager key={event.id} {...props} onSaved={load} /><details className="a-panel a-disclosure"><summary>Adjust one-match or pit responsibility</summary><DutyEditor {...props} onRefresh={refresh}/></details></> : tab === 'sharing' ? <Sharing key={`${event.id}:${event.sharing_revision || 0}`} {...props} /> : <>
      {!overview&&<p role="status">Loading scouting progress…</p>}
      {overview&&<CoverageBoard key={event.id} teams={overview.team_coverage||[]} event={event} name={name} busy={busy} error={error} onDismiss={dismiss} onDismissTeam={dismissTeam} onAssignments={()=>setTab('assignments')} onRefresh={load}/>}
      <details className="a-disclosure a-admin-support"><summary>More progress details</summary><div className="a-stack">
      <details className="a-panel a-disclosure"><summary>Duty totals and unowned teams</summary><p>{overview?.completed || 0} of {overview?.assignments.filter(a => !a.schedule_cancelled).length || 0} duties server confirmed. Dismissed warnings do not change this total.</p>{!!overview?.unowned.length&&<p>Teams without a permanent owner: {overview.unowned.join(', ')}</p>}</details>
      <details className="a-panel a-disclosure"><summary>Coverage conflicts and gaps</summary>{overview?.conflicts.length ? overview.conflicts.map((c, i) => <article className="a-duty" key={`${c.match_key}:${i}`}><div><strong>{matchLabel(event.matches?.find(m => m.key === c.match_key))} · {c.kind.replaceAll('_', ' ')}</strong><p>{name(c.user_id)} · Teams {c.team_numbers.join(', ')}</p></div><a className="a-button" href={`#/matches/${encodeURIComponent(c.match_key)}`}>Review match and handoffs</a></article>) : <p>No conflicts in the downloaded schedule.</p>}<a className="a-button" href="#/assignments">Open assignment editor</a></details>
      <details className="a-panel a-disclosure"><summary>Handoff history</summary>{overview?.handoffs.length ? overview.handoffs.slice().reverse().slice(0, 40).map(h => <article className="a-duty" key={h.id}><div><strong>Team {h.team_number} · {matchLabel(event.matches?.find(m => m.key === h.match_key))}</strong><p>{name(h.from_user_id)} → {name(h.to_user_id)} · {h.status}</p></div></article>) : <p>No handoffs at this event.</p>}</details>
      <details className="a-panel a-disclosure"><summary>Practice progress</summary><p>Completion records practice submissions, not a certification of scouting accuracy.</p><ul>{(data.memberships || []).map(m => <li key={m.id}>{m.username}: {[...new Set((overview?.training || []).filter(r => r.user_id === m.user_id).map(r => r.report_kind))].join(' and ') || 'No practice submitted'}</li>)}</ul></details>
      </div></details>
    </>}
  </div>;
}
