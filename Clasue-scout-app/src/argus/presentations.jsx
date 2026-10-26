import { useState } from 'react';

export function PresentationPicker({ analytics, onPresent }) {
  const [query, setQuery] = useState('');
  const teams = analytics.teams.filter(team => `${team.teamNumber} ${team.nickname || ''}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="a-stack">
    <header className="a-page-heading"><h1>Present</h1><p className="a-muted">Choose a team to open its presentation. Use the arrow keys to change slides, or download a PDF or PowerPoint.</p></header>
    <label className="a-presentation-search">Find a team to present<input className="a-input" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Team number or name"/></label>
    <section className="a-panel"><div className="a-table-wrap a-presentation-teams" role="region" aria-label="Teams to present" tabIndex={0}><table><thead><tr><th>Team</th><th>Matches</th><th>Present</th></tr></thead><tbody>{teams.map(team=><tr key={team.teamNumber}><th>{team.teamNumber} {team.nickname}</th><td>{team.matchCount}</td><td><button className="a-button a-primary" aria-label={`Present team ${team.teamNumber}`} onClick={()=>onPresent(team.teamNumber)}>Present</button></td></tr>)}</tbody></table></div>{!teams.length&&<p className="a-empty">{query?'No matching team. Try another number or name.':'Add event teams or collect scouting reports to prepare a presentation.'}</p>}</section>
    <section className="a-panel a-row"><div className="a-grow"><h2>Pit display</h2><p className="a-muted">Show your team’s upcoming matches and predictions on a shared screen.</p></div><a className="a-button" href="#/display">Open pit display</a></section>
  </div>;
}
