import { useEffect, useRef, useState } from 'react';
import { assignedRobots } from './match-access.js';
import { MatchHandoffs } from './match-handoffs.jsx';
import { matchLabel } from './workspace-model.js';
import { matchTiming, scoutingPath } from './match-launch-model.js';
import { CompactDetails } from './workspace-navigation.jsx';

export function AllianceTeams({match,color,onChoose,selected,allowedTeams}){
 return <div className={`a-robot-strip a-robots-${color}`}><span className="a-sr-only">{color==='red'?'Red alliance':'Blue alliance'}</span>{(match.alliances?.[color]?.team_keys||[]).map(key=>{const number=key.replace(/^frc/,'');return onChoose?<button type="button" key={key} aria-pressed={selected===number} disabled={!!allowedTeams&&!allowedTeams.includes(number)} aria-label={`Scout team ${number}, ${color} alliance`} onClick={()=>onChoose(number)}>{number}</button>:<span key={key}>{number}</span>;})}</div>;
}
export function MatchLaunch({match,event,data,user,navigate,compact=false,api}){
 const [now,setNow]=useState(Date.now),[choosing,setChoosing]=useState(false),[selected,setSelected]=useState(''),dialog=useRef(null),start=useRef(null);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(choosing)dialog.current.showModal();},[choosing]);
 const allowed=assignedRobots({event,match,assignments:data.assignments,userId:user.id}).map(row=>row.teamNumber);
 if(!match)return null;
 function begin(){const assignment=(data.assignments||[]).find(row=>row.scout_user_id===user.id&&row.match_key===match.key&&row.event_key===event.event_key&&row.report_kind!=='pit'&&!row.archived_at);setSelected(assignment?String(assignment.team_number):'');setChoosing(true);}
 function close(){setChoosing(false);start.current?.focus();}
 function scout(){navigate(scoutingPath({match,eventKey:event.event_key,teamNumber:selected,userId:user.id,assignments:data.assignments,forms:data.forms,event}));setChoosing(false);}
 return <section className={`a-match-launch ${compact?'is-compact':''}`} aria-label={`${matchLabel(match)} scouting launch`}>
  <header><div><span className="a-eyebrow">{compact?'Next match':'Match scouting'}</span><h2>{matchLabel(match)}</h2></div><span className="a-match-time">{matchTiming(match,now)}</span></header>
  <div className="a-launch-alliances">{['red','blue'].map(color=><div key={color} className={`a-launch-alliance a-launch-${color}`}><strong>{color==='red'?'Red alliance':'Blue alliance'}</strong><AllianceTeams match={match} color={color}/></div>)}</div>
  <p className="a-muted a-small a-launch-help">Only robots assigned to you in this match can be scouted.</p>
  <button ref={start} className="a-button a-primary a-start-match" onClick={begin} disabled={!allowed.length}><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2v12l10-6z"/></svg>Start scouting</button>
  {api&&(compact?<CompactDetails label="Cover and handoffs"><MatchHandoffs api={api} event={event} match={match} user={user}/></CompactDetails>:<MatchHandoffs api={api} event={event} match={match} user={user}/>)}
  {choosing&&<dialog ref={dialog} className="a-event-transition a-robot-picker" aria-labelledby="robot-picker-title" onClose={close}><div className="a-stack"><div className="a-row"><h2 id="robot-picker-title">Choose your robot</h2><button type="button" className="a-button" onClick={close}>Cancel</button></div><p>{matchLabel(match)} · {event.event_name||event.event_key}</p>{['red','blue'].map(color=><section key={color}><h3>{color==='red'?'Red alliance':'Blue alliance'}</h3><AllianceTeams match={match} color={color} onChoose={setSelected} selected={selected} allowedTeams={allowed}/></section>)}<p className="a-muted">Your report will keep this match, robot and alliance. A matching assignment opens its assigned form.</p><button type="button" className="a-button a-primary" disabled={!selected||!allowed.includes(selected)} onClick={scout}>{selected?`Scout team ${selected}`:'Select a robot to continue'}</button></div></dialog>}
 </section>;
}
