import { useEffect, useMemo, useState } from 'react';
import { answerQuestion } from './analytics.js';
import './analyst.css';
import { createGroqProvider } from './provider-adapter.js';


const labels={calculation:'Verified local calculation',observation:'Scout observations',insufficient:'Insufficient information',interpretation:'Groq interpretation. Check the cited evidence.'};

export function Analyst({analytics,onOpenTeam,onCompare,onOpenReport,api,workspaceId,eventKey}){
 const [question,setQuestion]=useState('');
 const [provider,setProvider]=useState({configured:false}),[mode,setMode]=useState('auto'),[busy,setBusy]=useState(false);
 const client=useMemo(()=>api?createGroqProvider({request:api,workspaceId,eventKey}):null,[api,workspaceId,eventKey]);
 useEffect(()=>{let active=true;client?.status().then(status=>{if(active)setProvider(status);}).catch(()=>{if(active)setProvider({configured:false});});return()=>{active=false;};},[client]);
 const useGroq=!!provider.configured&&mode!=='local';
 const numbers=(analytics?.teams||[]).slice(0,2).map(team=>team.teamNumber);
 const prompts=['Which teams need more scouting data?',...(numbers.length?[`Summarize team ${numbers[0]}`]:[]),...(numbers.length>1?[`Compare team ${numbers.join(' and ')}`]:[])];
 const [messages,setMessages]=useState([]);
 const [error,setError]=useState('');
 const scopeKey=`${analytics?.scope?.teamId || ''}:${analytics?.scope?.eventKey || ''}`;
 // A changed workspace/event never displays the preceding scope's private answer history.
 const visible=messages.filter(message=>message.scopeKey===scopeKey);
 const ask=async value=>{
  if(busy)return;
  const query=value.trim();if(!query)return;
  if(query.length>1000){setError('Keep your question under 1,000 characters.');return;}
  if(!analytics){setError('Wait for event analytics to load.');return;}
  let answer;setBusy(true);setError('');
  try{answer=useGroq?await client.explain(query):answerQuestion(query,analytics);}catch(error){answer=answerQuestion(query,analytics);setError(`${error.message||'Groq is unavailable.'} A local answer is shown below.`);}finally{setBusy(false);}
  setMessages(previous=>[...previous,{id:globalThis.crypto.randomUUID(),scopeKey,question:query,answer}]);
  setQuestion('');
 };
 return <section className="a-analyst a-stack" aria-labelledby="analyst-title">
  <header className="a-analyst-heading"><div><p className="a-analyst-eyebrow">Evidence analyst</p><h2 id="analyst-title">Ask your scouting data</h2><p className="a-muted">Read-only answers from the selected event and your authorized workspace.</p></div><span className="a-analyst-mode">{useGroq?'Groq connected':'Local mode'}</span></header>
  <div className="a-analyst-provider a-panel"><strong>{provider.configured?'Groq is connected':'Groq needs an API key'}</strong><p>{provider.configured?'Groq receives your question and a limited summary of authorized team measurements and report references. Photos, drawings, scout names and notes stay out of provider requests. AI interpretations may be incorrect.':'The workspace owner can connect Groq in Settings by importing the private connection file. Local questions work without a key.'}</p>{provider.configured?<label>Answer with<select className="a-input" value={useGroq?'groq':'local'} onChange={event=>setMode(event.target.value)} disabled={busy}><option value="groq">Groq AI</option><option value="local">Local calculations</option></select></label>:<a href="#/settings">Set up connections in Settings</a>}</div>
  <div className="a-analyst-prompts" aria-label="Example questions">{prompts.map(prompt=><button key={prompt} className="a-button" type="button" disabled={busy} onClick={()=>ask(prompt)}>{prompt}</button>)}</div>
  {!visible.length&&<div className="a-empty"><h3>Start with a team, a metric, or a coverage question</h3><p>Ask for a team summary, compare named teams, rank an existing numeric question, or find gaps in scouting coverage. Rankings require matching questions and units. Unknown scoring rules and predictions remain unavailable.</p></div>}
  <div className="a-analyst-conversation" role="log" aria-label="Evidence analyst answers" aria-live="polite" aria-relevant="additions">
   {visible.map(message=>{
    const {answer}=message,teams=(analytics?.teams || []).filter(team=>answer.teamNumbers.includes(team.teamNumber));
    const sources=(answer.sourceIds || []).map(id=>({id,report:teams.flatMap(team=>team.history).find(report=>report.id===id)}));
    return <article className="a-analyst-answer a-panel" key={message.id}>
     <p className="a-analyst-question">{message.question}</p><p className="a-analyst-result-label">{labels[answer.kind] || 'Local evidence result'}</p>
     <div className="a-analyst-answer-text">{answer.text || 'No evidence is available for this query.'}</div>
     {teams.length>0&&<div className="a-analyst-teams">{teams.map(team=><div className="a-analyst-team" key={team.teamNumber}><button className="a-button" type="button" disabled={!onOpenTeam} onClick={()=>onOpenTeam?.(team.teamNumber)}>Team {team.teamNumber}</button><span>{team.reportCount} reports / {team.matchCount} linked matches</span><span className="a-muted">Newest report: {team.confidence.freshness || 'Unavailable'}</span></div>)}{teams.length>=2&&onCompare&&<button type="button" className="a-button" onClick={()=>onCompare(teams.slice(0,4).map(team=>team.teamNumber))}>Compare {Math.min(4,teams.length)} teams</button>}</div>}
     {!!answer.limitations?.length&&<div className="a-analyst-limitations"><strong>Limits of this answer</strong><ul>{answer.limitations.map((item,index)=><li key={`${index}:${item}`}>{item}</li>)}</ul></div>}
     <details className="a-analyst-evidence"><summary>Evidence: {sources.length} source {sources.length===1?'report':'reports'}</summary>{sources.length?<ul>{sources.map(({id,report})=><li key={id}><button type="button" className="a-button" disabled={!onOpenReport||!report} onClick={()=>onOpenReport?.(id)}>{report?.match_key || 'Match unlinked'} / Report {id}</button><span className="a-muted">{report?.created_at || 'Report time unavailable'}</span></li>)}</ul>:<p className="a-muted">No source reports support this question in the current scope.</p>}</details>
    </article>;
   })}
  </div>
  <form className="a-analyst-form a-panel" onSubmit={event=>{event.preventDefault();ask(question);}}><label htmlFor="analyst-question">Ask a follow-up question</label><div className="a-analyst-input-row"><textarea id="analyst-question" className="a-input" value={question} onChange={event=>setQuestion(event.target.value)} maxLength={1000} rows={3} placeholder="For example: Summarize team 254" aria-describedby="analyst-question-help"/><button className="a-button" type="submit" disabled={busy||!question.trim()||!analytics}>{busy?'Checking evidence…':useGroq?'Ask Groq':'Ask locally'}</button></div><p id="analyst-question-help" className="a-muted">Name teams or metrics in each follow-up. Queries do not assume context from an earlier answer.</p>{error&&<p role="alert" className="a-danger">{error}</p>}{visible.length>0&&<button type="button" className="a-button" onClick={()=>setMessages([])}>Clear conversation</button>}</form>
 </section>;
}
export default Analyst;
