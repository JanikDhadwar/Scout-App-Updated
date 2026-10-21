import { useRef, useState } from 'react';
import { formatValue } from './analytics.js';

export function GlobalRankings({api,season}){
 const currentYear=new Date().getFullYear();
 const [year,setYear]=useState(/^\d{4}$/.test(String(season))?Number(season):currentYear);
 const [team,setTeam]=useState(''),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=useRef(0);
 async function load(offset=0,query={year,team}){
  const id=++request.current;setBusy(true);setError('');setResult(null);
  try{
   const params=new URLSearchParams({year:String(query.year),offset:String(offset)});
   if(query.team.trim())params.set('team',query.team.trim());
   const data=await api('GET',`/statbotics/rankings?${params}`);
   if(id===request.current)setResult({...data,query});
  }catch(e){if(id===request.current)setError(e.message||'Global rankings could not be loaded.');}
  finally{if(id===request.current)setBusy(false);}
 }
 return <details className="a-disclosure a-global-rankings"><summary>Global rankings</summary><section className="a-panel a-stack" aria-label="Statbotics global rankings">
  <div><h2>Statbotics global rankings</h2><p className="a-muted a-small">EPA (Expected Points Added) estimates a robot’s scoring contribution. These are external season ratings, separate from official event standings and your scouting observations. Compare point ratings within the same season.</p></div>
  <form className="a-row" onSubmit={e=>{e.preventDefault();load();}}>
   <label>Ranking season<input className="a-input" type="number" min="2002" max={currentYear} step="1" required value={year} disabled={busy} onChange={e=>setYear(e.target.value)}/></label>
   <label className="a-grow">Team number (optional)<input className="a-input" inputMode="numeric" pattern="[1-9][0-9]{0,5}" placeholder="All teams" value={team} disabled={busy} onChange={e=>setTeam(e.target.value)}/></label>
   <button className="a-button a-primary" disabled={busy}>{busy?'Loading rankings…':'Load global rankings'}</button>
  </form>
  {error&&<p role="alert" className="a-danger">{error}</p>}
  {result&&<><p className="a-small" role="status">{result.year} season · Fetched {new Date(result.fetched_at).toLocaleString()}. Fetch time is not the time of the latest official match.</p>
   <div className="a-table-wrap" role="region" aria-label="Global EPA rankings" tabIndex={0}><table><caption>Statbotics {result.year} season EPA ratings</caption><thead><tr><th scope="col">Global rank</th><th scope="col">Team</th><th scope="col">EPA</th><th scope="col">Matches</th><th scope="col">Wins / losses / ties</th></tr></thead><tbody>{result.rows.map(row=><tr key={row.team}><td>{row.rank==null?'Unknown':`${row.rank}${row.total==null?'':` / ${row.total}`}`}</td><th scope="row"><a href={`https://www.statbotics.io/team/${row.team}/${result.year}`} target="_blank" rel="noreferrer">{row.team} {row.name}</a></th><td>{formatValue(row.epa)}</td><td>{formatValue(row.matches)}</td><td>{[row.wins,row.losses,row.ties].map(formatValue).join(' / ')}</td></tr>)}</tbody></table></div>
   {!result.rows.length&&<p className="a-empty">No ratings available for this season.</p>}
   {!result.query.team&&<nav className="a-row" aria-label="Global rankings pages"><button className="a-button" disabled={busy||result.offset===0} onClick={()=>load(Math.max(0,result.offset-50),result.query)}>Previous 50</button><span className="a-small">{result.rows.length?`Rows ${result.offset+1}–${result.offset+result.rows.length}`:'No rows'}</span><button className="a-button" disabled={busy||!result.has_more} onClick={()=>load(result.offset+50,result.query)}>Next 50</button></nav>}
  </>}
  <p className="a-muted a-small">Online connection required. No key needed. <a href={`https://www.statbotics.io/teams?year=${encodeURIComponent(year)}`} target="_blank" rel="noreferrer">Open Statbotics</a></p>
 </section></details>;
}
