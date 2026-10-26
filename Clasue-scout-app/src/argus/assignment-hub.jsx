import { useCallback, useEffect, useRef, useState } from 'react';
import { assignmentReports, isCompleted, matchLabel } from './workspace-model.js';
import { matchOwners } from './match-access.js';
import { MatchHandoffs } from './match-handoffs.jsx';
import { AssignmentRoster } from './assignment-roster.jsx';
import { assignmentRoster } from './assignment-roster.js';

function OwnerEditor({ allocation, members, api, onSaved }) {
  const [owner, setOwner] = useState(allocation.owner_user_id), [locked, setLocked] = useState(!!allocation.locked);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('PATCH', `/team-allocations/${encodeURIComponent(allocation.id)}`, { owner_user_id: owner, locked, revision: allocation.revision }); await onSaved(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <form className="a-owner-row" onSubmit={save}><strong>Team {allocation.team_number}</strong>
    <label>Permanent owner<select aria-label="Permanent owner" className="a-input" value={owner} onChange={e => setOwner(e.target.value)}>{!members.some(m => m.user_id === owner) && <option value={owner}>Former member — choose owner</option>}{members.map(m => <option key={m.id} value={m.user_id}>{m.username || m.user_id}</option>)}</select></label>
    <label><input type="checkbox" checked={locked} onChange={e => setLocked(e.target.checked)} /> Lock team {allocation.team_number}</label>
    <button className="a-button" disabled={busy}>Save team {allocation.team_number}</button>{error && <p role="alert" className="a-danger">{error}</p>}</form>;
}
export function OwnershipManager({ data, workspace, event, api, onRefresh, onSaved, initialTeam }) {
  const members = (data.memberships || []).filter(m => m.team_id === workspace.id);
  const forms = (data.forms || []).filter(f => f.team_id === workspace.id && !f.archived && !f.archived_at);
  const [scouts, setScouts] = useState(() => members.filter(m => !(event.excluded || []).includes(m.user_id)).map(m => m.user_id));
  const [pit, setPit] = useState(''), [match, setMatch] = useState(''), [selectedTeam,setSelectedTeam]=useState(initialTeam?Number(initialTeam):null);
  const [preview, setPreview] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [newScout, setNewScout] = useState('');
  const pitId = pit || forms.find(f => f.kind === 'pit')?.id || '', matchId = match || forms.find(f => (f.kind || 'match') === 'match')?.id || '';
  const allocations = (data.team_allocations || []).filter(a => a.team_id===workspace.id&&a.event_key === event.event_key && !a.archived_at);
  const newcomers = members.filter(member=>!allocations.some(a=>a.owner_user_id===member.user_id));
  const selected=assignmentRoster(data,event).teams.find(t=>t.number===selectedTeam);
  const selectedHeading=useRef(null);
  useEffect(()=>{if(selectedTeam)selectedHeading.current?.focus();},[selectedTeam]);
  const name = id => members.find(m => m.user_id === id)?.username || 'Former member';
  async function review(e, action) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { const value = await api('POST', '/assignment-plan/preview', action==='add_scouts' ? {event_id:event.id,mode:'add_scouts',new_scout_ids:[newScout],pit_form_id:pitId,match_form_id:matchId} : { event_id: event.id, scout_ids: scouts, pit_form_id: pitId, match_form_id: matchId, mode:e.nativeEvent.submitter?.value==='fill'?'fill':'rerandomize' }); setPreview({ ...value, request_id: crypto.randomUUID() }); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function apply() {
    setBusy(true); setError('');
    try { const result = await api('POST', '/assignment-plan/apply', { ...preview.input, fingerprint: preview.fingerprint, request_id: preview.request_id }); setMessage(`Ownership saved. ${result.added} duties added. ${result.conflicts.filter(c => c.kind === 'collision').length} match conflicts need review.`); setPreview(null); await onRefresh(); await onSaved?.(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="a-panel a-stack"><h2>Team assignments</h2><p className="a-muted">Assign teams once. When someone joins later, add that scout without randomizing everyone again.</p>
    {!!allocations.length&&<section className="a-help a-stack" aria-label="Add a scout"><h3>Add a scout</h3><p>Give a new scout a share of the teams. Unassigned teams go first; only a few unlocked teams move from existing scouts. Completed reports and accepted handoffs stay with their original scouts.</p><div className="a-row"><label className="a-grow">New scout<select aria-label="New scout" className="a-input" value={newScout} onChange={e=>{setNewScout(e.target.value);setPreview(null);}} disabled={busy}><option value="">Choose a scout</option>{newcomers.map(member=><option value={member.user_id} key={member.id}>{member.username||member.user_id}</option>)}</select></label><button type="button" className="a-button a-primary" disabled={busy||!newScout||!newcomers.some(member=>member.user_id===newScout)} onClick={e=>review(e,'add_scouts')}>Preview new scout assignments</button><button type="button" className="a-button" disabled={busy} onClick={onRefresh}>Refresh scouts</button></div>{!newcomers.length&&<p className="a-muted">Everyone has teams. If someone just joined, choose Refresh scouts.</p>}</section>}
    <form className="a-stack" onSubmit={review} onChange={() => setPreview(null)}>
      <div className="a-row"><button value="rerandomize" className={`a-button${allocations.length?'':' a-primary'}`} disabled={busy || !scouts.length || !pitId || !matchId}>{busy ? 'Checking…' : 'Randomize teams'}</button><button value="fill" className="a-button" disabled={busy || !scouts.length || !pitId || !matchId}>Fill unassigned teams</button><span className="a-muted a-small">{scouts.length} of {members.length} scouts selected</span></div>
      <details className="a-disclosure"><summary>Choose scouts and forms</summary><div className="a-stack"><fieldset disabled={busy}><legend>Participating scouts</legend><div className="a-row"><button type="button" className="a-button" onClick={()=>{setScouts(members.map(m=>m.user_id));setPreview(null);}}>Select everyone</button><button type="button" className="a-button" onClick={()=>{setScouts([]);setPreview(null);}}>Clear selection</button></div><div className="a-participants">{members.map(m => <label key={m.id}><input type="checkbox" checked={scouts.includes(m.user_id)} onChange={e => setScouts(ids => e.target.checked ? [...ids, m.user_id] : ids.filter(id => id !== m.user_id))} />{m.username || m.user_id}</label>)}</div></fieldset>
      <div className="a-row"><label>Pit assignment form<select className="a-input" required disabled={busy} value={pitId} onChange={e => setPit(e.target.value)}><option value="">Choose pit form</option>{forms.filter(f => f.kind === 'pit').map(f => <option key={f.id} value={f.id}>{f.title}</option>)}</select></label><label>Match assignment form<select className="a-input" required disabled={busy} value={matchId} onChange={e => setMatch(e.target.value)}><option value="">Choose match form</option>{forms.filter(f => (f.kind || 'match') === 'match').map(f => <option key={f.id} value={f.id}>{f.title}</option>)}</select></label></div>
      </div></details>
      {(!pitId || !matchId) && <p className="a-help">Create both a <a href="#/pit">pit form</a> and a <a href="#/match">match form</a> first.</p>}</form>
    {preview && <section className="a-help a-stack" aria-label="Ownership preview"><h3>Review assignments</h3>{preview.input.mode==='add_scouts'&&<div><p><strong>{preview.transfers.length} existing {preview.transfers.length===1?'team moves':'teams move'}.</strong> Everyone else keeps their teams.</p><ul>{preview.transfers.map(row=><li key={row.team_number}>Team {row.team_number}: {name(row.from_user_id)} → {name(row.to_user_id)}</li>)}</ul></div>}<p>{preview.allocations.length} teams · {preview.collision_count} overlapping match duties before existing handoffs. Review conflicts after applying.</p><ul>{preview.loads.map(load => <li key={load.user_id}>{name(load.user_id)}: {preview.allocations.filter(a => a.owner_user_id === load.user_id).map(a => a.team_number).join(', ') || 'No teams'}</li>)}</ul>{preview.warnings.map(w => <p key={w} className="a-danger">{w}</p>)}<div className="a-row"><button className="a-button a-primary" disabled={busy} onClick={apply}>Apply assignments</button><button className="a-button" disabled={busy} onClick={() => setPreview(null)}>Cancel preview</button></div></section>}
    {error && <p role="alert" className="a-danger">{error}</p>}{message && <p role="status">{message}</p>}
    {selected&&<section className="a-help a-stack" aria-label={`Assignment for team ${selected.number}`}><div className="a-row"><h3 ref={selectedHeading} tabIndex={-1}>Team {selected.number}</h3><button className="a-button" onClick={()=>setSelectedTeam(null)}>Close team assignment</button></div><p><strong>Assigned scout:</strong> {selected.ownerName}{selected.locked?' · Locked':''}</p>{selected.allocation?<OwnerEditor key={`${selected.allocation.id}:${selected.allocation.revision}`} allocation={selected.allocation} members={members} api={api} onSaved={async()=>{setPreview(null);await onRefresh();await onSaved?.();}}/>:<p>Use Randomize teams or Fill unassigned teams to create a permanent assignment.</p>}<a href={`#/teams/${selected.number}`}>Open team profile</a></section>}
    <AssignmentRoster data={data} event={event} onSelect={setSelectedTeam}/>
    {!!allocations.length && <details className="a-disclosure"><summary>Move or lock individual teams ({allocations.length})</summary><div className="a-stack">{allocations.map(a => <OwnerEditor key={`${a.id}:${a.revision}`} allocation={a} members={members} api={api} onSaved={async () => { setPreview(null); await onRefresh(); await onSaved?.(); }} />)}</div></details>}
  </section>;
}

export default function AssignmentHub({ data, workspace, event, user, role, api, navigate }) {
  const [view, setView] = useState(null), [error, setError] = useState('');
  const canEdit = ['owner', 'admin'].includes(role);
  const refresh = useCallback(async () => {
    if (!event) return;
    try { const value = await api('GET', `/assignment-plan?event_id=${encodeURIComponent(event.id)}`); setView(value); setError(''); }
    catch (e) { setError(`${e.message} Showing downloaded assignments.`); }
  }, [api, event]);
  useEffect(() => { let active = true; Promise.resolve().then(() => { if (active) refresh(); }); return () => { active = false; }; }, [refresh]);
  const allocations = view?.allocations || (data.team_allocations || []).filter(a => a.team_id === workspace.id && a.event_key === event?.event_key && !a.archived_at);
  const duties = (view?.assignments || data.assignments || []).filter(a => a.team_id === workspace.id && a.event_key === event?.event_key && !a.archived_at && !a.schedule_cancelled);
  const pendingIds = new Set(data.pendingReportIds || []);
  const reports = data.submissions || [];
  const done = duty => Object.hasOwn(duty,'completion')?!!duty.completion:assignmentReports(duty, reports).some(r => (!duty.form_id || r.form_id === duty.form_id) && !pendingIds.has(r.id)&&!r.quality_review_required);
  const queued = duty => assignmentReports(duty, reports).some(r => pendingIds.has(r.id));
  const matches = event?.matches || [];
  const conflicts = view?.conflicts || matches.flatMap(match => {
    const slots = matchOwners({ event, match, assignments: duties }), mine = slots.filter(s => s.owners.includes(user.id));
    return mine.length > 1 ? [{ match_key: match.key, user_id: user.id, team_numbers: mine.map(s => s.teamNumber), kind: 'collision' }] : [];
  });
  const mine = duties.filter(a => a.scout_user_id === user.id || a.primary_scout_user_id === user.id);
  const tasks = mine.filter(a => !done(a)).sort((a, b) => {
    const time = row => row.report_kind === 'pit' ? Infinity : (matches.find(m => m.key === row.match_key)?.predicted_time || matches.find(m => m.key === row.match_key)?.time || Infinity);
    return time(a) - time(b);
  });
  const name = id => (data.memberships || []).find(m => m.user_id === id)?.username || 'Former member';
  const open = duty => navigate(`/${duty.report_kind === 'pit' ? 'pit' : 'match'}?${new URLSearchParams({ event_key: duty.event_key, match_key: duty.match_key || '', match_number: String(duty.match_number || ''), scouted_team: String(duty.team_number), alliance: duty.alliance || '', assignment_id: duty.id, form_id: duty.form_id || '' })}`);
  if (!event) return <section className="a-panel"><h1>Scout</h1><p>No active event. An Admin can activate one in Settings → Events.</p><a className="a-button" href="#/events">Event settings</a></section>;
  return <div className="a-stack"><header><h1>Scout</h1><p className="a-muted">{event.event_name || event.event_key} · Your teams stay yours across the event.</p></header>
    <nav className="a-row" aria-label="Scouting actions"><a className="a-button a-primary" href="#/matches">Match scouting</a><a className="a-button" href="#/pit">Pit scouting</a><button className="a-button" onClick={refresh}>Refresh assignments</button>{canEdit && <a className="a-button" href="#/admin?tab=assignments">Manage assignments in Admin</a>}</nav>
    {error && <p role="status" className="a-muted">{error}</p>}
    <>
      <section className="a-panel a-stack"><h2>My permanent teams</h2><div className="a-team-ownership">{allocations.filter(a => a.owner_user_id === user.id).map(a => { const pit = duties.find(d => d.team_number === a.team_number && d.report_kind === 'pit'); return <article key={a.id}><h3><a href={`#/teams/${a.team_number}`}>Team {a.team_number}</a>{a.locked && <small> · Locked</small>}</h3><p>{pit ? done(pit) ? 'Pit report submitted' : queued(pit) ? 'Pit report pending upload' : 'Pit report needed' : 'Pit duty not generated yet'}</p>{pit && pit.scout_user_id === user.id && !done(pit) && <button className="a-button" onClick={() => open(pit)}>Pit scout {a.team_number}</button>}</article>; })}</div>{!allocations.some(a => a.owner_user_id === user.id) && <p className="a-empty">No permanent teams assigned. Your existing match duties are shown below; ask an Admin to review ownership.</p>}</section>
      {!!conflicts.filter(c => c.user_id === user.id && !isCompleted(matches.find(m => m.key === c.match_key))).length && <section className="a-panel a-stack"><h2>Coverage conflicts</h2>{conflicts.filter(c => c.user_id === user.id && !isCompleted(matches.find(m => m.key === c.match_key))).map(c => <div key={`${c.match_key}:${c.kind}`}><p>{matchLabel(matches.find(m => m.key === c.match_key))}: teams {c.team_numbers.join(', ')} need you at the same time.</p><a className="a-button" href={`#/matches/${encodeURIComponent(c.match_key)}`}>Request one-match cover</a></div>)}</section>}
      <section className="a-panel a-stack"><h2>Next actions</h2>{tasks.length ? tasks.slice(0, 20).map(duty => { const match = matches.find(m => m.key === duty.match_key), handedOff = duty.scout_user_id !== user.id; return <article className="a-duty" key={duty.id}><div><strong>{duty.report_kind === 'pit' ? 'Pit scouting' : matchLabel(match)} · Team {duty.team_number}</strong><p className="a-muted">{handedOff ? `Covered by ${name(duty.scout_user_id)}` : duty.handoff_id ? `You are covering for ${name(duty.primary_scout_user_id)}` : 'Your responsibility'} · {queued(duty) ? 'Pending upload' : isCompleted(match) ? 'Missing report' : 'Awaiting report'}</p></div>{!handedOff && <button className="a-button a-primary" onClick={() => open(duty)}>Scout team {duty.team_number}</button>}{match && !handedOff && !isCompleted(match) && <details className="a-duty-cover"><summary>Request cover for this match</summary><MatchHandoffs api={api} event={event} match={match} user={user} /></details>}</article>; }) : <p className="a-empty">No outstanding duties in the downloaded data. A coordinator can review event coverage.</p>}{tasks.length > 20 && <a href="#/matches">Open full match schedule for more duties</a>}</section>
      <details className="a-panel a-disclosure"><summary>Completed duties ({mine.filter(done).length})</summary><ul>{mine.filter(done).map(d => <li key={d.id}>Team {d.team_number} · {d.report_kind === 'pit' ? 'Pit' : matchLabel(matches.find(m => m.key === d.match_key))} · Server confirmed</li>)}</ul></details>
    </>
  </div>;
}
