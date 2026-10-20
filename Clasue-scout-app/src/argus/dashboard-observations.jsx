import { lazy, Suspense, useState } from 'react';
import { eventMetricDistribution, formatValue } from './analytics.js';
const DistributionChart=lazy(()=>import('./analytics-views.jsx').then(module=>({default:module.DistributionChart})));

export function DashboardObservations({analytics,onOpenTeam}){
 const metrics=analytics.metrics.filter(metric=>['number','scale'].includes(metric.type)),[chosen,setChosen]=useState('');
 const metric=metrics.find(row=>row.id===chosen)||metrics[0];
 const teams=metric?analytics.teams.map(team=>({team,summary:team.metrics[metric.id]})).sort((a,b)=>{
  if(!metric.direction)return a.team.teamNumber-b.team.teamNumber;
  const av=a.summary?.mean,bv=b.summary?.mean;if(av==null)return bv==null?0:1;if(bv==null)return -1;return metric.direction==='lower'?av-bv:bv-av;
 }):[];
 const distribution=metric?eventMetricDistribution(analytics,metric.id):{values:[]};
 return <section className="a-stack a-dashboard-evidence"><div className="a-section-heading"><div><h2>Scouting observations</h2><p className="a-muted a-small">Match evidence only. Select a field to compare the same measurement.</p></div>{metric&&<label className="a-metric-choice"><span className="a-sr-only">Dashboard metric</span><select className="a-input" aria-label="Dashboard metric" value={metric.id} onChange={e=>setChosen(e.target.value)}>{metrics.map(row=><option value={row.id} key={row.id}>{row.formTitle}: {row.label}</option>)}</select></label>}</div>
 {metric?<div className="a-dashboard-grid"><section className="a-panel"><div className="a-section-heading"><h3>Team observations</h3><a href="#/analytics">All analytics</a></div><div className="a-table-wrap" role="region" aria-label="Team observations" tabIndex={0}><table><thead><tr><th>Team</th><th>Average{metric.unit?` (${metric.unit})`:''}</th><th>Samples</th><th>Linked matches</th></tr></thead><tbody>{teams.slice(0,6).map(({team,summary})=><tr key={team.teamNumber}><th><button className="a-team-number" onClick={()=>onOpenTeam(team.teamNumber)}>{team.teamNumber}</button></th><td>{formatValue(summary?.mean)}</td><td>{summary?.n||0}</td><td>{team.matchCount}</td></tr>)}</tbody></table></div><p className="a-muted a-small">{metric.direction?`Ordered by ${metric.direction==='lower'?'lower':'higher'} values, as configured for this field.`:'Ordered by team number; no preferred direction is configured.'} Missing answers are not zero. Samples can include unlinked match observations. Open a team for sources.</p></section><section className="a-panel"><h3>Match sample distribution</h3>{distribution.values.length?<Suspense fallback={<p className="a-muted">Loading chart…</p>}><DistributionChart metric={distribution}/></Suspense>:<p className="a-empty">Collect valid, match-linked answers to see this distribution.</p>}<p className="a-muted a-small">One median per team and linked match. Pit and unlinked observations are excluded.</p></section></div>:<section className="a-panel"><p className="a-empty">Add numeric fields to your match form to compare observations here. Season scoring is never guessed from question names.</p></section>}
 </section>;
}
