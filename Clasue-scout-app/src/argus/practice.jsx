import { useEffect, useState } from 'react';
import { FormFiller } from '../frc-scout-local.jsx';

export default function Practice({ data, workspace, user, api }) {
  const [selected, setSelected] = useState(null), [finished, setFinished] = useState(0), [history, setHistory] = useState([]), [error, setError] = useState('');
  const forms = (data.forms || []).filter(f => f.team_id === workspace.id && !f.archived && !f.archived_at);
  useEffect(() => { let active = true; api('GET', `/practice?team_id=${encodeURIComponent(workspace.id)}`).then(result => { if (active) { setHistory(result); setError(''); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [api, workspace.id, finished]);
  const exit = () => { setSelected(null); setFinished(n => n + 1); };
  return <div className="a-stack"><section className="a-practice-banner" aria-label="Practice mode"><strong>Practice scouting</strong><p>Sample Team 9999. Training reports never affect competition data, rankings, analysis or real assignments.</p><a className="a-button" href="#/assignments">Return to real assignments</a></section>
    {selected ? <FormFiller key={selected.id} form={selected} user={user} team={workspace} reportKind={selected.kind || 'match'} practice context={{ event_key: 'practice', scouted_team: '9999' }} onDone={exit} onCancel={exit} /> : <>
      <header><h1>Learn the scouting workflow</h1><p className="a-muted">Try one pit form and one match form. Enter sample observations, leave and resume a draft, then submit. Use the same controls you will use at an event.</p></header>
      {['pit', 'match'].map(kind => <section className="a-panel a-stack" key={kind}><h2>Practice {kind} scouting</h2><p>{kind === 'pit' ? 'Imagine interviewing a team in the pits. Record its design and capabilities.' : 'Use a recorded or imagined practice match. Record observations without guessing missing answers.'}</p>{forms.filter(f => (f.kind || 'match') === kind).map(f => <button className="a-button" key={f.id} onClick={() => setSelected(f)}>Practice: {f.title}</button>)}{!forms.some(f => (f.kind || 'match') === kind) && <p>Ask an Admin to create a {kind} form first.</p>}<p className="a-muted">{history.filter(r => r.report_kind === kind).length} confirmed practice submissions.</p></section>)}
      {error && <p role="status">{error} Your saved practice drafts stay on this device.</p>}
    </>}
  </div>;
}
