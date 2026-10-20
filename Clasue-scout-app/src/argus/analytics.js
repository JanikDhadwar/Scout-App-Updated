import { visibleQuestions, hasAnswer } from '../form-conditions.js';

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
 const owned=reports.filter(report=>!teamId || report.team_id===teamId);
 const current=owned.filter(report=>eventKey && report.event_key===eventKey);
 const legacy=owned.filter(report=>!report.event_key);
 const directory=new Map((teams.length ? teams : event?.event_teams || []).map(team=>[String(team.team_number ?? team.number),team]));
 [...current,...legacy].forEach(report=>{if(report.scouted_team!=null&&!directory.has(String(report.scouted_team)))directory.set(String(report.scouted_team),{team_number:report.scouted_team});});
 const descriptors=new Map();
 const addQuestions=(formId,questions,title)=>questions.forEach(question=>{
   const id=`${formId}:${question.id}`, config=event?.analytics_config?.[id] || {};
   if(!descriptors.has(id))descriptors.set(id,{id,formId,questionId:question.id,label:config.label || question.text,type:question.type,formTitle:title || '',phase:['auto','teleop','endgame'].includes(config.phase)?config.phase:null,unit:config.unit || null,direction:['higher','lower'].includes(config.direction)?config.direction:null});
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
     const observations=relevant.filter(report=>hasAnswer(report.answers?.[descriptor.questionId])).map(report=>({reportId:report.id,matchKey:kind==='pit'?null:report.match_key || null,reportKind:report.report_kind || 'unspecified',createdAt:report.created_at,value:report.answers[descriptor.questionId]}));
     const base={...descriptor,eligible:relevant.length,missing:relevant.length-observations.length,invalid:0,sourceIds:observations.map(value=>value.reportId),observations};
     if(['number','scale'].includes(descriptor.type)){
       const valid=observations.filter(item=>finite(item.value) && (descriptor.type!=='scale' || Number(item.value)>=1 && Number(item.value)<=10));
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
 return {schemaVersion:1,generatedAt:asOf,event:event ? {key:eventKey,name:event.event_name || event.name || eventKey}:null,scope:{teamId,eventKey},metrics:metricList,teams:outputTeams,limitations:['No total points or phase points are calculated without a verified scoring model.','Form questions retain their own units; metrics from different forms are not merged.']};
}

export function analyticsForData(data={},workspace,event){return buildAnalytics({forms:data.forms || [],reports:data.submissions || [],event,teams:event?.event_teams || [],matches:data.matches || [],scope:{teamId:workspace?.id,eventKey:event?.event_key}});}

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
 return [
  {title:`Team ${team.teamNumber}`,subtitle:team.nickname || 'Scouting profile',lines:[meta,`${team.pitReportCount || 0} pit reports; pit observations are excluded from match performance.`,`Freshest report: ${team.confidence.freshness || 'Unavailable'}`,`${team.unlinkedReportCount} legacy reports excluded`],sourceIds:sources},
  {title:'Performance overview',subtitle:'Verified calculations',lines:stats.length?stats:['No numeric scouting observations for this event.'],sourceIds:sources},
  {title:'Scoring breakdown',subtitle:'Explicit metric phase mappings; no inferred points',lines:['auto','teleop','endgame'].map(phase=>`${{auto:'Autonomous',teleop:'Teleoperated',endgame:'Endgame'}[phase]}: ${numeric.filter(metric=>metric.phase===phase).map(metric=>`${metric.label} ${formatValue(metric.mean)}${metric.unit?` ${metric.unit}`:''}`).join('; ') || 'No mapped observations'}`),sourceIds:sources},
  {title:'Performance trends',subtitle:'Official schedule order when available; otherwise report time',lines:numeric.length?numeric.map(metric=>`${metric.label}: ${metric.values.map(item=>`${item.matchKey || 'Unlinked report'} ${formatValue(item.value)}`).join(' → ')}. Population SD ${formatValue(metric.stddev)} (n=${metric.n}).`):['More numeric observations are needed to describe trends.'],sourceIds:sources},
  {title:'Strengths and limitations',subtitle:'Scout observations and evidence gaps',lines:[...team.notes.slice(-5).map(note=>`${note.label}: “${String(note.value)}” [${note.reportId}]`),...team.confidence.limitations,...(!team.notes.length?['No written scout observations are available.']:[])],sourceIds:sources},
  {title:'Match history',subtitle:'Scouting reports; official results remain separate',lines:team.history.length?team.history.map(report=>`${report.report_kind==='pit'?'Pit scouting':report.match_key || 'Match not linked'} · ${report.form_title || 'Scouting report'} · ${report.submitted_by || 'Scout'} · ${report.created_at || 'Time unknown'} [${report.id}]`):['No event-linked reports.'],sourceIds:sources},
  {title:'Strategy summary',subtitle:'Evidence to review before alliance decisions',lines:[`${team.confidence.coveragePercent==null?'Coverage unknown':`${formatValue(team.confidence.coveragePercent)}% match coverage`}. ${team.confidence.disagreements.length} conflicting observations.`,`${team.confidence.smallSamples.length} metrics have fewer than three samples.`,...(!numeric.length?['Collect numeric observations before comparing performance.']:['Compare the same question and units across candidate teams.']), 'Confirm robot capabilities with scouts; alliance role predictions are not calculated.'],sourceIds:sources},
 ];
}

/** Local read-only query router. It never calls a model or executes note content. */
export function answerQuestion(question,analytics){
 const query=String(question).toLowerCase(),numbers=[...new Set((query.match(/\b\d{1,5}\b/g)||[]))];
 const selected=analytics.teams.filter(team=>numbers.includes(team.teamNumber));
 const result=(text,teams,kind='calculation')=>({kind,text,teamNumbers:teams.map(team=>team.teamNumber),sourceIds:[...new Set(teams.flatMap(team=>team.history.map(report=>report.id)))],limitations:analytics.limitations});
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
