import { visibleQuestions, hasAnswer } from '../form-conditions.js';
import { teamIntelligence, insightText } from './intelligence.js';
export { evidenceConfidence, insightText } from './intelligence.js';

const externalNumber=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
export function normalizeMatch13Team(row){
 if(!Number.isInteger(row?.teamNumber)||row.teamNumber<1||!Number.isInteger(row.year))return null;
 return {team:row.teamNumber,year:row.year,xp:externalNumber(row.xp),auto:externalNumber(row.xAuto),teleop:externalNumber(row.xTele),endgame:externalNumber(row.xEnd),epa:externalNumber(row.epa),rank:Number.isInteger(row.rank)&&row.rank>0?row.rank:null};
}
export function normalizeMatch13Prediction(row){
 if(typeof row?.key!=='string'||!row.teams||typeof row.teams!=='object')return null;
 const teams=Object.keys(row.teams).map(Number);if(!teams.length||teams.length>6||teams.some(n=>!Number.isInteger(n)||n<1))return null;
 const probability=externalNumber(row.pred?.winProb);
 return {key:row.key,teams,redScore:externalNumber(row.pred?.redScore),blueScore:externalNumber(row.pred?.blueScore),redWinProbability:probability!=null&&probability>=0&&probability<=1?probability:null};
}
export function match13PredictionForMatch(predictions,match,team){
 const row=predictions?.find(p=>p.key===match?.key);if(!row)return null;
 const teams=color=>(match.alliances?.[color]?.team_keys||[]).map(key=>Number(String(key).replace(/^frc/,'')));
 const red=teams('red'),blue=teams('blue');
 if(JSON.stringify([...red,...blue].sort((a,b)=>a-b))!==JSON.stringify([...row.teams].sort((a,b)=>a-b)))return null;
 const alliance=red.includes(Number(team))?'red':blue.includes(Number(team))?'blue':null;if(!alliance)return null;
 return {...row,alliance,winProbability:row.redWinProbability==null?null:alliance==='red'?row.redWinProbability:1-row.redWinProbability};
}
export function match13RegionalRanks(ratings,metadata,team,districtTeams=[],districtName='District'){
 const target=ratings.find(r=>r.team===Number(team)),location=metadata.find(m=>Number(m.team_number)===Number(team));
 const complete=ratings.every(r=>metadata.some(m=>Number(m.team_number)===r.team));
 const rank=(name,subset)=>!target||!subset.some(r=>r.team===target.team)||target.rank==null?null:{name,rank:1+subset.filter(r=>r.rank!=null&&r.rank<target.rank).length,total:subset.length};
 const country=location?.country,state=location?.state_prov;
 return {complete,world:target?{name:'World',rank:target.rank,total:ratings.length}:null,
 country:country?rank(country,ratings.filter(r=>metadata.some(m=>Number(m.team_number)===r.team&&m.country===country))):null,
 state:country&&state?rank(state,ratings.filter(r=>metadata.some(m=>Number(m.team_number)===r.team&&m.country===country&&m.state_prov===state))):null,
 district:districtTeams.length?rank(districtName,ratings.filter(r=>districtTeams.includes(r.team))):null};
}

// External model estimates stay separate from report-derived scouting calculations.
export function normalizeStatboticsTeam(row) {
 if(!Number.isInteger(row?.team)||row.team<1||!Number.isInteger(row.year))return null;
 const number=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
 const integer=value=>Number.isInteger(value)&&value>=0?value:null;
 const points=row.epa?.total_points;
 return {team:row.team,year:row.year,name:typeof row.name==='string'?row.name.slice(0,120):'',
  epa:number(typeof points==='object'&&points!==null?points.mean:points),
  rank:integer(row.epa?.ranks?.total?.rank),total:integer(row.epa?.ranks?.total?.team_count),
  matches:integer(row.record?.count),wins:integer(row.record?.wins),losses:integer(row.record?.losses),ties:integer(row.record?.ties)};
}

const finite = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value));
const median = values => { const sorted=[...values].sort((a,b)=>a-b), half=Math.floor(sorted.length/2);return sorted.length ? sorted.length%2 ? sorted[half] : (sorted[half-1]+sorted[half])/2 : null; };
const stamp = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
export const formatValue = value => value == null ? '—' : typeof value === 'number' ? new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(value) : String(value);
const questionsFor = (report,forms) => report.questions_snapshot || report.form_snapshot?.questions || forms.find(form=>form.id===report.form_id)?.questions || [];
const matchKey = match => match.key || match.match_key || match.id;
const includesTeam = (match,number) => ['red','blue'].some(alliance=>(match.alliances?.[alliance]?.team_keys || []).some(key=>String(key)===`frc${number}`));
const completed = match => !!(match.actual_time || match.post_result_time || ['red','blue'].some(color=>Number(match.alliances?.[color]?.score)>=0 && match.alliances?.[color]?.score != null));

/** Pure scoped analytics. No scoring weights or semantic question-name inference.
 * Numeric means use one median per linked match; unlinked reports stay individual.
 * Missing/invalid/eligible refer to raw observations, not match medians.
 */
export function buildAnalytics({forms=[],reports=[],event=null,teams=[],matches=[],scope={},asOf=new Date().toISOString()}={}) {
 const teamId=scope.teamId,eventKey=scope.eventKey || event?.event_key;
 const scopedForms=forms.filter(form=>!teamId || form.team_id===teamId);
 const owned=reports.filter(report=>(!teamId || report.team_id===teamId)&&!report.quality_review_required&&!report.practice&&report.mode!=='practice'&&!report.pending&&!report.removed);
 const current=owned.filter(report=>eventKey && report.event_key===eventKey);
 const legacy=owned.filter(report=>!report.event_key);
 const directory=new Map((teams.length ? teams : event?.event_teams || []).map(team=>[String(team.team_number ?? team.number),team]));
 [...current,...legacy].forEach(report=>{if(report.scouted_team!=null&&!directory.has(String(report.scouted_team)))directory.set(String(report.scouted_team),{team_number:report.scouted_team});});
 const descriptors=new Map();
 const addQuestions=(formId,questions,title)=>questions.forEach(question=>{
   const id=`${formId}:${question.id}`, config=event?.analytics_config?.[id] || {};
   if(!descriptors.has(id))descriptors.set(id,{id,formId,questionId:question.id,label:config.label || question.text,type:question.type,formTitle:title || '',category:['scoring','defense','support','reliability'].includes(config.category)?config.category:null,phase:['auto','teleop','endgame'].includes(config.phase)?config.phase:null,unit:config.unit || null,direction:['higher','lower'].includes(config.direction)?config.direction:null,insight:config.insight||null,options:question.type==='boolean'?['Yes','No']:Array.isArray(question.options)?question.options:[],suggestedInsight:question.insightDefault||null,suggestedPhase:question.phase||null});
 });
 scopedForms.forEach(form=>addQuestions(form.id,form.questions || [],form.title));
 current.forEach(report=>addQuestions(report.form_id,questionsFor(report,scopedForms),report.form_title));
 const metricList=[...descriptors.values()];
 const schedule=matches.filter(match=>!match.event_key || match.event_key===eventKey);
 const levels=['qm','ef','qf','sf','f'];
 const scheduleOrder=new Map([...schedule].sort((a,b)=>{
   const aTime=a.actual_time || a.predicted_time || a.time,bTime=b.actual_time || b.predicted_time || b.time;
   if(aTime && bTime && aTime!==bTime)return aTime-bTime;
   return levels.indexOf(a.comp_level)-levels.indexOf(b.comp_level) || (Number(a.set_number)||0)-(Number(b.set_number)||0) || (Number(a.match_number)||0)-(Number(b.match_number)||0);
 }).map((match,index)=>[matchKey(match),index]));
 const orderValues=(a,b)=>{
   if(scheduleOrder.has(a.matchKey) && scheduleOrder.has(b.matchKey))return scheduleOrder.get(a.matchKey)-scheduleOrder.get(b.matchKey);
   if(scheduleOrder.has(a.matchKey)!==scheduleOrder.has(b.matchKey))return scheduleOrder.has(a.matchKey)?-1:1;
   return stamp(a.createdAt)-stamp(b.createdAt);
 };
 const outputTeams=[...directory].filter(([number])=>number!=='undefined').sort(([a],[b])=>Number(a)-Number(b)).map(([number,identity])=>{
   const source=current.filter(report=>String(report.scouted_team)===number);
   const matchSource=source.filter(report=>report.report_kind!=='pit');
   const pitSource=source.filter(report=>report.report_kind==='pit');
   const unlinked=legacy.filter(report=>String(report.scouted_team)===number);
   const observedMatches=[...new Set(matchSource.filter(report=>report.match_key).map(report=>report.match_key))];
   const expected=schedule.filter(match=>includesTeam(match,number) && completed(match));
   const covered=expected.filter(match=>observedMatches.includes(matchKey(match)));
   const missingMatches=expected.filter(match=>!observedMatches.includes(matchKey(match))).map(match=>matchKey(match));
   const summarize=(metricSource,kind)=>{
   const metrics={},disagreements=[],notes=[];
   for(const descriptor of metricList) {
     const relevant=metricSource.filter(report=>report.form_id===descriptor.formId && visibleQuestions(questionsFor(report,scopedForms),report.answers || {}).some(q=>q.id===descriptor.questionId));
     const observations=relevant.filter(report=>hasAnswer(report.answers?.[descriptor.questionId])).map(report=>{const question=questionsFor(report,scopedForms).find(q=>q.id===descriptor.questionId);return {reportId:report.id,matchKey:kind==='pit'?null:report.match_key || null,reportKind:report.report_kind || 'unspecified',createdAt:report.created_at,value:report.answers[descriptor.questionId],min:question?.min,max:question?.max};});
     const base={...descriptor,eligible:relevant.length,missing:relevant.length-observations.length,invalid:0,sourceIds:observations.map(value=>value.reportId),observations};
     if(['number','scale'].includes(descriptor.type)){
       const valid=observations.filter(item=>finite(item.value) && (descriptor.type!=='scale' || Number(item.value)>=1 && Number(item.value)<=10)&&(item.min==null||Number(item.value)>=Number(item.min))&&(item.max==null||Number(item.value)<=Number(item.max)));
       const groups=new Map();valid.forEach(item=>{const key=item.matchKey || `report:${item.reportId}`;groups.set(key,[...(groups.get(key) || []),item]);});
       const values=[...groups].map(([key,items])=>({key,matchKey:items[0].matchKey,createdAt:items[0].createdAt,value:median(items.map(item=>Number(item.value))),sourceIds:items.map(item=>item.reportId)})).sort(orderValues);
       for(const [key,items] of groups)if(items[0].matchKey && new Set(items.map(item=>Number(item.value))).size>1)disagreements.push({metricId:descriptor.id,label:descriptor.label,matchKey:key,values:items.map(item=>Number(item.value)),sourceIds:items.map(item=>item.reportId)});
       const numbers=values.map(item=>item.value),n=numbers.length,mean=n?numbers.reduce((sum,value)=>sum+value,0)/n:null;
       metrics[descriptor.id]={...base,n,observationCount:valid.length,invalid:observations.length-valid.length,values,mean,median:median(numbers),min:n?Math.min(...numbers):null,max:n?Math.max(...numbers):null,stddev:n?Math.sqrt(numbers.reduce((sum,value)=>sum+(value-mean)**2,0)/n):null,aggregation:kind==='pit'?'Separate pit observations; excluded from match performance.':'One median per linked match; separate observations when match is unknown.'};
     } else if(['select','boolean'].includes(descriptor.type)){
       const counts=new Map();observations.forEach(item=>counts.set(String(item.value),(counts.get(String(item.value)) || 0)+1));
       const groups=new Map();observations.filter(item=>item.matchKey).forEach(item=>groups.set(item.matchKey,[...(groups.get(item.matchKey) || []),item]));
       for(const [key,items] of groups)if(new Set(items.map(item=>String(item.value))).size>1)disagreements.push({metricId:descriptor.id,label:descriptor.label,matchKey:key,values:items.map(item=>String(item.value)),sourceIds:items.map(item=>item.reportId)});
       metrics[descriptor.id]={...base,n:observations.length,counts:[...counts].map(([value,count])=>({value,count})),aggregation:'Counts of scout observations, including repeat reports.'};
     } else {
       metrics[descriptor.id]={...base,n:observations.length};
       if(descriptor.type==='text')observations.forEach(item=>notes.push({...item,label:descriptor.label}));
     }
   }
   return {metrics,disagreements,notes};
   };
   const matchSummary=summarize(matchSource,'match'),pitSummary=summarize(pitSource,'pit');
   const {metrics,disagreements}=matchSummary,pitMetrics=pitSummary.metrics;
   const notes=[...matchSummary.notes,...pitSummary.notes].sort((a,b)=>stamp(a.createdAt)-stamp(b.createdAt));
   const newest=[...source].sort((a,b)=>stamp(b.created_at)-stamp(a.created_at))[0];
   const allMetrics=[...Object.values(metrics),...Object.values(pitMetrics)];
   const missingObservations=allMetrics.reduce((sum,item)=>sum+item.missing,0);
   const invalidObservations=allMetrics.reduce((sum,item)=>sum+item.invalid,0);
   return {teamNumber:number,nickname:identity.nickname || identity.name || '',reportCount:source.length,matchReportCount:matchSource.length,pitReportCount:pitSource.length,matchedReportCount:matchSource.filter(report=>report.match_key).length,unlinkedReportCount:unlinked.length,unlinkedReports:unlinked,matchCount:observedMatches.length,metrics,pitMetrics,notes,history:[...source].sort((a,b)=>stamp(a.created_at)-stamp(b.created_at)),confidence:{expectedMatches:expected.length || null,coveragePercent:expected.length ? covered.length/expected.length*100 : null,missingMatches,missingObservations,invalidObservations,disagreements,smallSamples:Object.values(metrics).filter(item=>['number','scale','boolean','select'].includes(item.type)&&item.n>0&&item.n<3).map(item=>item.id),freshness:newest?.created_at || null,coverageDefinition:'Distinct completed official matches containing this team, covered by at least one event-linked match report. Repeated reports count once. Pit reports never count toward match coverage.',limitations:[...(!expected.length?['No completed team schedule is available; match coverage is unknown.']:[]),...(matchSource.some(report=>!report.match_key)?['Some current-event reports lack match links; these remain separate observations.']:[]),...(pitSource.length?['Pit observations are shown separately and excluded from match performance.']:[]),...(unlinked.length?['Legacy reports have no event link and are excluded from current-event metrics.']:[])]}};
 });
 for(const team of outputTeams)team.intelligence=teamIntelligence({team,reports:current.filter(row=>String(row.scouted_team)===team.teamNumber),forms:scopedForms,schedule,scheduleOrder});
 return {schemaVersion:1,generatedAt:asOf,event:event ? {key:eventKey,name:event.event_name || event.name || eventKey}:null,scope:{teamId,eventKey},metrics:metricList,teams:outputTeams,limitations:['No total points or phase points are calculated without a verified scoring model.','Form questions retain their own units; metrics from different forms are not merged.']};
}

export function analyticsForData(data={},workspace,event){return buildAnalytics({forms:data.forms || [],reports:data.submissions || [],event,teams:event?.event_teams || [],matches:data.matches || [],scope:{teamId:workspace?.id,eventKey:event?.event_key}});}

export function eventMetricDistribution(analytics,metricId){
 const metric=analytics.metrics.find(row=>row.id===metricId);
 if(!metric||!['number','scale'].includes(metric.type))return {values:[],min:null,max:null,n:0};
 const values=analytics.teams.flatMap(team=>(team.metrics[metricId]?.values||[]).filter(row=>row.matchKey&&Number.isFinite(row.value)).map(row=>({...row,teamNumber:team.teamNumber})));
 let min=null,max=null;for(const row of values){min=min==null?row.value:Math.min(min,row.value);max=max==null?row.value:Math.max(max,row.value);}
 return {...metric,values,min,max,n:values.length};
}

/** Form-level evidence summary for the report library, not a season score.
 * Caller supplies authorized, filtered reports; numeric duplicates use one median
 * per event/team/match. Unknown event/match links remain separate observations.
 */
export function summarizeReportFields(reports=[],forms=[]) {
 const fields=new Map();
 for(const report of reports)for(const question of questionsFor(report,forms)){
   const reportKind=report.report_kind==='pit'?'pit':'match',key=`${report.form_id}:${question.id}:${reportKind}`;
   if(!fields.has(key))fields.set(key,{id:key,reportKind,formId:report.form_id,questionId:question.id,label:question.text,type:question.type,formTitle:report.form_title||forms.find(form=>form.id===report.form_id)?.title||report.form_id});
 }
 return [...fields.values()].map(field=>{
   const eligible=reports.filter(report=>report.form_id===field.formId&&(report.report_kind==='pit'?'pit':'match')===field.reportKind&&visibleQuestions(questionsFor(report,forms),report.answers||{}).some(question=>question.id===field.questionId));
   const answered=eligible.filter(report=>hasAnswer(report.answers?.[field.questionId]));
   const base={...field,eligible:eligible.length,missing:eligible.length-answered.length,n:answered.length,invalid:0,sourceIds:answered.map(report=>report.id)};
   if(['number','scale'].includes(field.type)){
     const valid=answered.filter(report=>finite(report.answers[field.questionId])&&(field.type!=='scale'||Number(report.answers[field.questionId])>=1&&Number(report.answers[field.questionId])<=10));
     const groups=new Map();
     for(const report of valid){const key=report.report_kind!=='pit'&&report.event_key&&report.match_key&&report.scouted_team?JSON.stringify([report.event_key,String(report.scouted_team),report.match_key]):`report:${report.id}`;groups.set(key,[...(groups.get(key)||[]),Number(report.answers[field.questionId])]);}
     const values=[...groups.values()].map(median);
     return {...base,n:values.length,observationCount:valid.length,invalid:answered.length-valid.length,mean:values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null,min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null};
   }
   if(['select','boolean'].includes(field.type)){const counts=new Map();for(const report of answered){const value=String(report.answers[field.questionId]);counts.set(value,(counts.get(value)||0)+1);}return {...base,counts:[...counts].map(([value,count])=>({value,count,percent:count/answered.length*100}))};}
   return base;
 });
}

export function presentationSections(analytics,team){
 if(!team)return [];
 const numeric=Object.values(team.metrics).filter(metric=>['number','scale'].includes(metric.type) && metric.n);
 const meta=`${analytics.event?.name || 'No event selected'} · ${team.reportCount} reports · ${team.matchCount} linked matches`;
 const stats=numeric.map(metric=>`${metric.label}: ${formatValue(metric.mean)}${metric.unit?` ${metric.unit}`:''} average · n=${metric.n} · range ${formatValue(metric.min)}–${formatValue(metric.max)}`);
 const sources=team.history.map(report=>report.id);
 const candidate=[...(team.intelligence?.lastMatch?[`Last recorded match: ${team.intelligence.lastMatch.matchKey}. Reported robot observations; official results remain separate.`]:[]),...(team.intelligence?.strengths||[]).map(row=>`Strength: ${insightText(row)}`),...(team.intelligence?.concerns||[]).map(row=>`Concern: ${insightText(row)}`),...(team.intelligence?.observations||[]).filter(row=>row.matchCount>0).slice(0,3).map(row=>`${insightText(row)}; ${row.disagreements} disagreements.`),...numeric.slice(0,3).map(row=>`${row.label}: population SD ${formatValue(row.stddev)} (n=${row.n}).`),...Object.values(team.pitMetrics||{}).filter(row=>row.n&&row.counts).slice(0,3).map(row=>`Reported pit capability — ${row.label}: ${row.counts.map(item=>`${item.value} (${item.count})`).join(', ')}. Not match-verified.`),...(team.picklistPositions||[]).map(row=>`${row.title}: position ${row.position}`)];
 if(!team.reportCount)return [{title:`Team ${team.teamNumber}`,subtitle:team.nickname||'Alliance candidate',lines:['Insufficient scouting information.',...candidate],sourceIds:[]}];
 return [
  {title:`Team ${team.teamNumber}`,subtitle:team.nickname || 'Alliance candidate summary',lines:[meta,...candidate,`${team.pitReportCount || 0} pit reports; pit observations are excluded from match performance.`,`Freshest report: ${team.confidence.freshness || 'Unavailable'}`,`${team.unlinkedReportCount} legacy reports excluded`],sourceIds:sources},
  {title:'Performance overview',subtitle:'Verified calculations',lines:stats.length?stats:['No numeric scouting observations for this event.'],sourceIds:sources},
  {title:'Scoring breakdown',subtitle:'Explicit metric phase mappings; no inferred points',lines:['auto','teleop','endgame'].map(phase=>`${{auto:'Autonomous',teleop:'Teleoperated',endgame:'Endgame'}[phase]}: ${numeric.filter(metric=>metric.phase===phase).map(metric=>`${metric.label} ${formatValue(metric.mean)}${metric.unit?` ${metric.unit}`:''}`).join('; ') || 'No mapped observations'}`),sourceIds:sources},
  {title:'Performance trends',subtitle:'Official schedule order when available; otherwise report time',lines:numeric.length?numeric.map(metric=>`${metric.label}: ${metric.values.map(item=>`${item.matchKey || 'Unlinked report'} ${formatValue(item.value)}`).join(' → ')}. Population SD ${formatValue(metric.stddev)} (n=${metric.n}).`):['More numeric observations are needed to describe trends.'],sourceIds:sources},
  {title:'Strengths and limitations',subtitle:'Scout observations and evidence gaps',lines:[...(team.notesIncluded?team.notes.slice(-5).map(note=>`${note.label}: “${String(note.value)}” [${note.reportId}]`):['Private notes omitted.']),...team.confidence.limitations],sourceIds:sources},
  {title:'Match history',subtitle:'Scouting reports; official results remain separate',lines:team.history.length?team.history.map(report=>`${report.report_kind==='pit'?'Pit scouting':report.match_key || 'Match not linked'} · ${report.form_title || 'Scouting report'} · ${report.created_at || 'Time unknown'} [${report.id}]`):['No event-linked reports.'],sourceIds:sources},
  {title:'Strategy summary',subtitle:'Evidence to review before alliance decisions',lines:[`${team.confidence.coveragePercent==null?'Coverage unknown':`${formatValue(team.confidence.coveragePercent)}% match coverage`}. ${team.confidence.disagreements.length} conflicting observations.`,`${team.confidence.smallSamples.length} metrics have fewer than three samples.`,...(!numeric.length?['Collect numeric observations before comparing performance.']:['Compare the same question and units across candidate teams.']), 'Confirm robot capabilities with scouts; alliance role predictions are not calculated.'],sourceIds:sources},
 ];
}

/** Local read-only query router. It never calls a model or executes note content. */
export function partnerShortlist(analytics,metricId,exclude=[]){
 const metric=analytics.metrics.find(m=>m.id===metricId&&['number','scale'].includes(m.type)&&['higher','lower'].includes(m.direction));
 if(!metric)return [];
 return analytics.teams.filter(team=>!exclude.map(String).includes(team.teamNumber)&&team.metrics[metricId]?.mean!=null)
  .sort((a,b)=>(a.metrics[metricId].mean-b.metrics[metricId].mean)*(metric.direction==='higher'?-1:1)||Number(a.teamNumber)-Number(b.teamNumber));
}
export function answerQuestion(question,analytics){
 const query=String(question).toLowerCase(),numbers=[...new Set((query.match(/\b\d{1,5}\b/g)||[]))];
 const selected=analytics.teams.filter(team=>numbers.includes(team.teamNumber));
 const result=(text,teams,kind='calculation')=>({kind,text,teamNumbers:teams.map(team=>team.teamNumber),sourceIds:[...new Set(teams.flatMap(team=>team.history.map(report=>report.id)))],limitations:analytics.limitations});
 if(/partner|alliance/.test(query)){
  const metric=analytics.metrics.find(m=>query.includes(String(m.label).toLowerCase())&&['higher','lower'].includes(m.direction));
  const ranked=metric?partnerShortlist(analytics,metric.id,numbers):[];
  if(!ranked.length)return result('Insufficient information for an alliance shortlist. Name a measured field with an Admin-configured preferred direction. This compares evidence only; it does not predict alliance performance.',[],'insufficient');
  return result(`Candidate review by ${metric.label} (${metric.unit||'question units'}, ${metric.direction} preferred):\n${ranked.slice(0,8).map(t=>`Team ${t.teamNumber}: mean ${formatValue(t.metrics[metric.id].mean)}, n=${t.metrics[metric.id].n}, ${t.confidence.coveragePercent==null?'coverage unknown':`${formatValue(t.confidence.coveragePercent)}% coverage`}`).join('\n')}\nThis is a single-metric evidence shortlist, not an overall robot score or predicted alliance result. Review pit capabilities, disagreements and missing data.`,ranked.slice(0,8));
 }
 if(/coverage|more (scouting )?data|missing|confidence/.test(query))return result(analytics.teams.map(team=>`Team ${team.teamNumber}: ${team.reportCount} reports, ${team.matchCount} linked matches, ${team.confidence.coveragePercent==null?'coverage unknown':`${formatValue(team.confidence.coveragePercent)}% coverage`}; ${team.confidence.disagreements.length} disagreements.`).join('\n'),analytics.teams);
 if(selected.length && /compare|summari[sz]e|recent|strength|evidence|team|consistent/.test(query))return result(selected.map(team=>`Team ${team.teamNumber}: ${team.reportCount} event reports; ${team.matchCount} linked matches. ${Object.values(team.metrics).filter(metric=>metric.mean!=null).map(metric=>`${metric.label}: mean ${formatValue(metric.mean)}${metric.unit?` ${metric.unit}`:''}, SD ${formatValue(metric.stddev)}, n=${metric.n}`).join('; ') || 'No numeric observations.'} ${team.unlinkedReportCount} legacy reports excluded. ${/strength|evidence/.test(query)?team.notes.slice(-3).map(note=>`Scout observation [${note.reportId}]: ${String(note.value)}`).join(' '):''}`).join('\n'),selected);
 const phase=/autonomous|\bauto\b/.test(query)?'auto':/teleop/.test(query)?'teleop':/endgame/.test(query)?'endgame':null;
 const metric=analytics.metrics.find(item=>['number','scale'].includes(item.type) && (phase?item.phase===phase:query.includes(item.label.toLowerCase())));
 if(metric && /highest|lowest|rank|consistent|average/.test(query)){
  const key=/consistent/.test(query)?'stddev':'mean',ascending=/lowest|consistent/.test(query),ranked=analytics.teams.filter(team=>team.metrics[metric.id]?.[key]!=null).sort((a,b)=>(a.metrics[metric.id][key]-b.metrics[metric.id][key])*(ascending?1:-1));
  return result(`${metric.label} (${key==='stddev'?'population standard deviation':'average'}; ${metric.unit || 'question units'}):\n${ranked.map(team=>`Team ${team.teamNumber}: ${formatValue(team.metrics[metric.id][key])}, n=${team.metrics[metric.id].n}`).join('\n') || 'No observations.'}`,ranked);
 }
 return result('Insufficient information for that question. Try “Summarize team 254”, “Compare team 254 and 1678”, “Which teams need more scouting data?”, or ask for the highest average of an existing numeric question. Season scoring and predictions require a verified scoring model.',[],'insufficient');
}

/** Relative event percentiles, never season points. Only linked match evidence ranks teams. */
export function allianceSelectionSheet(analytics,exclude=[]) {
 const categories=[['scoring','Scoring'],['defense','Defense'],['support','Support'],['reliability','Reliability']];
 return categories.map(([key,label])=>{
  const metrics=(analytics?.metrics||[]).filter(m=>m.category===key&&['number','scale'].includes(m.type)&&['higher','lower'].includes(m.direction));
  const candidates=(analytics?.teams||[]).filter(t=>!exclude.map(String).includes(String(t.teamNumber)));
  const rows=candidates.map(team=>{
   const measurements=metrics.map(metric=>{
    const values=(team.metrics?.[metric.id]?.values||[]).filter(v=>v.matchKey&&typeof v.value==='number'&&Number.isFinite(v.value));
    return {...metric,mean:values.length?values.reduce((sum,v)=>sum+v.value,0)/values.length:null,n:values.length,sourceIds:[...new Set(values.flatMap(v=>v.sourceIds||[]))]};
   });
   return {teamNumber:team.teamNumber,measurements,sourceIds:[...new Set(measurements.flatMap(m=>m.sourceIds))],coverage:team.confidence?.coveragePercent??null,disagreements:team.confidence?.disagreements?.length||0};
  });
  for(const row of rows){
   const scores=row.measurements.filter(m=>m.mean!=null).map(m=>{
    const peers=rows.map(r=>r.measurements.find(x=>x.id===m.id)?.mean).filter(v=>v!=null);
    const worse=peers.filter(v=>m.direction==='lower'?v>m.mean:v<m.mean).length;
    const tied=peers.filter(v=>v===m.mean).length;
    return peers.length<=1?50:100*(worse+(tied-1)/2)/(peers.length-1);
   });
   // Partial categories remain unranked, rather than rewarding missing weak fields.
   row.complete=metrics.length>0&&scores.length===metrics.length;
   row.score=row.complete?scores.reduce((a,b)=>a+b,0)/scores.length:null;
  }
  rows.sort((a,b)=>(a.score==null?1:0)-(b.score==null?1:0)||(b.score??0)-(a.score??0)||Number(a.teamNumber)-Number(b.teamNumber));
  return {key,label,metrics,teams:rows};
 });
}
