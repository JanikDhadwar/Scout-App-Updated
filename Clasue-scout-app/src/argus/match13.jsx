import {useEffect,useRef,useState} from 'react';
import {formatValue,match13PredictionForMatch} from './analytics.js';

export function Match13Settings({api,workspaceId,role}){
 const [configured,setConfigured]=useState(null),[key,setKey]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;api('GET',`/integrations/status?workspaceId=${encodeURIComponent(workspaceId)}`).then(s=>{if(active)setConfigured(s.match13Configured);}).catch(()=>{});return()=>{active=false;};},[api,workspaceId]);
 async function save(e){e.preventDefault();setBusy(true);try{await api('POST','/integrations/configure',{workspaceId,MATCH13_API_KEY:key});setKey('');setConfigured(true);setMessage('Match13 key saved privately on the server. Open a team profile to load its ratings.');window.dispatchEvent(new Event('argus-connections-updated'));}catch{setMessage('Could not save the Match13 key. Check your connection and owner permissions.');}finally{setBusy(false);}}
 return <section className="a-panel a-stack"><h2>Match13 ratings and predictions</h2><p>{configured===null?'Checking connection…':configured?'API key saved.':'An API key is needed.'} Ratings include offseason events.</p>{role==='owner'?<form className="a-stack" onSubmit={save}><p>Create a key on your <a href="https://www.match13.com/docs/api" target="_blank" rel="noreferrer">Match13 account</a>, then save it here. It is never returned to the browser or committed to Git.</p><label>Match13 API key<input className="a-input" type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} disabled={busy} placeholder="m13_live_…"/></label><button className="a-button" disabled={busy||!key.trim()}>{busy?'Saving…':'Save Match13 key'}</button></form>:<p className="a-muted">The team owner can save the Match13 key here.</p>}{message&&<p role="status">{message}</p>}</section>;
}

export function Match13Rating({api,workspaceId,team,year}){
 const identity=`${workspaceId}:${team}:${year}`;
 const [data,setData]=useState(null),[regions,setRegions]=useState(null),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!api||!workspaceId||!/^\d{4}$/.test(String(year)))return;let active=true;
  const query=new URLSearchParams({workspaceId,team:String(team),year:String(year)});
  api('GET',`/match13/rating?${query}`).then(value=>{if(active)setData({identity,...value});}).catch(e=>{if(active)setData({identity,error:e.message});});
  api('GET',`/match13/regions?${query}`).then(value=>{if(active)setRegions({identity,...value});}).catch(()=>{if(active)setRegions({identity,error:true});});
  return()=>{active=false;};
 },[api,workspaceId,team,year,identity,retry]);
 const current=data?.identity===identity?data:null,rankings=regions?.identity===identity?regions:null;
 return <section className="a-stack a-match13-rating" aria-label={`Match13 ratings for team ${team}`}><div className="a-row"><h2>Match13 · {year}</h2><button className="a-button" onClick={()=>{setData(null);setRegions(null);setRetry(r=>r+1);}}>Refresh ratings</button></div><p className="a-muted a-small">XP estimates scoring contribution. Includes offseason events; compare values within the same year. External estimates, separate from scouting observations.</p>
 {!current?<p role="status">Loading Match13 ratings…</p>:current.error?<p role="status">{current.error} <a href="#/settings">Connection settings</a></p>:<><dl className="a-match13-values">{[['XP',current.rating.xp],['Auto',current.rating.auto],['Teleop',current.rating.teleop],['Endgame',current.rating.endgame]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{formatValue(value)}</dd></div>)}</dl><p className="a-muted a-small">Global rank: {current.rating.rank==null?'Unavailable':`#${current.rating.rank}`}. Fetched {new Date(current.fetched_at).toLocaleString()}.</p></>}
 <dl className="a-match13-values">{['world','country','district','state'].map(scope=>{const rank=rankings?.[scope];return <div key={scope}><dt>{rank?.name||{world:'World',country:'Country',district:'District',state:'State / province'}[scope]}</dt><dd>{rank?.rank!=null?`#${rank.rank} / ${rank.total}`:rankings?'Unavailable':'Loading…'}</dd></div>;})}</dl>
 {rankings?.error&&<p className="a-muted a-small">Regional rankings are unavailable. They require Match13 ratings and official team locations.</p>}{rankings&&!rankings.error&&!rankings.complete&&<p className="a-muted a-small">Regional counts include teams with known TBA locations only; location coverage is incomplete.</p>}
 <a className="a-small" href={`https://www.match13.com/team/${team}?year=${year}`} target="_blank" rel="noreferrer">View team on Match13</a></section>;
}

export function Match13Predictions({api,workspaceId,eventKey,team,children}){
 const [result,setResult]=useState(null),refresh=useRef(null);
 useEffect(()=>{let active=true;async function load(){try{const value=await api('GET',`/match13/predictions?${new URLSearchParams({workspaceId,event:eventKey})}`);if(active)setResult({...value,workspaceId});}catch(e){if(active)setResult({event:eventKey,workspaceId,error:e.message});}}
  refresh.current=load;if(eventKey)load();const timer=setInterval(()=>{if(document.visibilityState!=='hidden')load();},120000);return()=>{active=false;clearInterval(timer);refresh.current=null;};
 },[api,workspaceId,eventKey]);
 const current=result?.event===eventKey&&result?.workspaceId===workspaceId?result:null;
 const prediction=match=>match13PredictionForMatch(current?.matches,match,team);
 return <section className="a-stack" aria-label="Match13 match predictions"><div className="a-row"><h2>Upcoming matches and predictions</h2><button className="a-button" onClick={()=>refresh.current?.()}>Refresh predictions</button></div><p className="a-muted a-small">Match13 estimates include offseason play. Win chance is for Team {team}’s alliance. These are predictions, not results.</p>{current?.error&&<p role="status">{current.error} <a href="#/settings">Connection settings</a></p>}{!current&&<p className="a-muted a-small">Loading predictions…</p>}{children(prediction)}{current?.fetched_at&&<p className="a-muted a-small">Predictions fetched {new Date(current.fetched_at).toLocaleString()}. Updates every two minutes. Official schedule supplies alliance colors; Match13 supplies match keys and participant sets.</p>}</section>;
}
export function PredictionValue({prediction}){
 return prediction?<div className="a-stack a-small"><span className="a-alliance-red">Red: {formatValue(prediction.redScore)}</span><span className="a-alliance-blue">Blue: {formatValue(prediction.blueScore)}</span><strong>{prediction.winProbability==null?'Win chance unavailable':`${formatValue(prediction.winProbability*100)}% alliance win chance`}</strong></div>:<span className="a-muted a-small">Prediction unavailable</span>;
}
