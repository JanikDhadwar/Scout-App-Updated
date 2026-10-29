// Pure evidence calculations, called only through the shared analytics entry.
import { hasAnswer, visibleQuestions } from '../form-conditions.js';

const bands = ['Preliminary', 'Limited', 'Moderate', 'Strong'];
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const middle = values => { const sorted = [...values].sort((a,b)=>a-b); return sorted.length ? (sorted[Math.floor((sorted.length-1)/2)] + sorted[Math.floor(sorted.length/2)]) / 2 : null; };
const numeric = value => ['number','string'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value));
const normalized = value => typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value);

export function evidenceConfidence({n, missingRate=0, disagreements=0, staleMatches=0, subjective=false, knownSchedule=true}) {
  if (!n) return {label:'Insufficient information', rank:-1, reasons:['No usable linked match observations.']};
  let rank = n < 3 ? 0 : n < 5 ? 1 : n < 8 ? 2 : 3;
  const reasons = [];
  if (missingRate > .2) { rank--; reasons.push('More than 20% of eligible match answers are missing or invalid.'); }
  if (disagreements) { rank--; reasons.push(`${disagreements} linked matches have unresolved disagreements.`); }
  if (staleMatches >= 2) { rank--; reasons.push(`${staleMatches} later completed matches have no usable observation.`); }
  if (subjective) { rank=Math.min(rank,2); reasons.push('Subjective evidence is capped at Moderate.'); }
  if (!knownSchedule) { rank=Math.min(rank,2); reasons.push('Schedule coverage is unknown; confidence is capped at Moderate.'); }
  rank=Math.max(0,rank);
  return {label:bands[rank],rank,reasons};
}

export function teamIntelligence({team, reports, forms, schedule, scheduleOrder}) {
  const complete = match => !!(match.actual_time || match.post_result_time || ['red','blue'].some(color=>match.alliances?.[color]?.score != null && Number(match.alliances[color].score)>=0));
  const expected = schedule.filter(match=>complete(match)&&['red','blue'].some(color=>match.alliances?.[color]?.team_keys?.includes(`frc${team.teamNumber}`)));
  const linked=reports.filter(report=>report.match_key && report.report_kind!=='pit');
  const compare=(a,b)=> {
    const ai=scheduleOrder.get(a.matchKey),bi=scheduleOrder.get(b.matchKey);
    if(ai!=null&&bi!=null)return ai-bi;
    if(ai!=null||bi!=null)return ai!=null?1:-1;
    return Date.parse(a.createdAt||0)-Date.parse(b.createdAt||0)||a.matchKey.localeCompare(b.matchKey);
  };
  const observations=[];
  for(const metric of Object.values(team.metrics)) {
    if(!['number','scale','boolean','select'].includes(metric.type)||!metric.eligible)continue;
    const groups=new Map();
    for(const report of linked.filter(row=>row.form_id===metric.formId)) {
      const questions=report.questions_snapshot||forms.find(form=>form.id===report.form_id)?.questions||[];
      const q=visibleQuestions(questions,report.answers||{}).find(question=>question.id===metric.questionId);
      if(!q)continue;
      const group=groups.get(report.match_key)||{matchKey:report.match_key,createdAt:report.created_at,values:[],sourceIds:[],invalid:false};
      const value=report.answers?.[metric.questionId];
      if(hasAnswer(value)) {
        const valid=['number','scale'].includes(metric.type)? numeric(value)&&(metric.type!=='scale'||Number(value)>=1&&Number(value)<=10)&&(q.min==null||Number(value)>=Number(q.min))&&(q.max==null||Number(value)<=Number(q.max)):metric.type==='boolean'?[true,false,'Yes','No'].includes(value):(q.options||[]).includes(value);
        if(valid){group.values.push(['number','scale'].includes(metric.type)?Number(value):normalized(value));group.sourceIds.push(report.id);}
        else group.invalid=true;
      }
      groups.set(report.match_key,group);
    }
    let absent=0,disagreements=0;
    const values=[];
    for(const group of groups.values()) {
      if(!group.values.length){absent++;continue;}
      const disputed=new Set(group.values).size>1;
      if(disputed)disagreements++;
      if(['number','scale'].includes(metric.type))values.push({...group,value:middle(group.values)});
      else if(!disputed) {
        const value=group.values[0],outcomes=metric.insight?.outcomes;
        if(outcomes && Object.hasOwn(outcomes,value) && ['success','failure'].includes(outcomes[value]))values.push({...group,value:outcomes[value]==='success'?1:0});
      }
    }
    values.sort(compare);
    const n=values.length,last=values.at(-1),recent=values.slice(-4,-1),numbers=values.map(row=>row.value),average=mean(numbers);
    const staleMatches=last ? expected.filter(match=>(scheduleOrder.get(match.key)??-1)>(scheduleOrder.get(last.matchKey)??Infinity)&&!values.some(row=>row.matchKey===match.key)).length : 0;
    const confidence=evidenceConfidence({n,missingRate:groups.size?absent/groups.size:0,disagreements,staleMatches,subjective:metric.insight?.evidence==='subjective',knownSchedule:schedule.some(match=>['red','blue'].some(color=>match.alliances?.[color]?.team_keys?.includes(`frc${team.teamNumber}`)))});
    const outcome=metric.insight?.kind==='success_rate',configured=metric.insight?.kind==='mean'&&!!metric.direction;
    const strength=outcome?(metric.insight.strength??.8):metric.insight?.strength;
    const concern=outcome?(metric.insight.concern??.5):metric.insight?.concern;
    const value=average;
    let classification='observation';
    if(n>=3 && value!=null && (outcome||configured)) {
      if(strength!=null&&(outcome||metric.direction==='higher'?value>=strength:value<=strength))classification='strength';
      else if(concern!=null&&(outcome||metric.direction==='higher'?value<concern:value>concern))classification='concern';
    }
    const previous=mean(recent.map(row=>row.value)),delta=last&&previous!=null?last.value-previous:null;
    observations.push({id:metric.id,metricId:metric.id,label:metric.label,phase:metric.phase,unit:metric.unit,ruleVersion:1,kind:outcome?'success_rate':'mean',classification,value,denominator:n,matchCount:n,successes:outcome?numbers.reduce((a,b)=>a+b,0):null,confidence,eligibleMatches:groups.size,missingMatches:absent,disagreements,staleMatches,sourceIds:[...new Set(values.flatMap(row=>row.sourceIds))],freshness:last?.createdAt||null,values:values.map(({matchKey,value,sourceIds})=>({matchKey,value,sourceIds})),trend:{last:last?{matchKey:last.matchKey,value:last.value,sourceIds:last.sourceIds}:null,previousMean:previous,previousCount:recent.length,eventMean:average,eventCount:n,delta,preliminary:recent.length<3,change:delta==null||!metric.direction?'Unclassified change':delta===0?'Unchanged':(delta>0)===(metric.direction==='higher')?'Improved':'Declined'}});
  }
  const rank=(a,b)=>b.confidence.rank-a.confidence.rank||b.matchCount-a.matchCount||a.metricId.localeCompare(b.metricId);
  const keys=[...new Map(linked.map(row=>[row.match_key,{matchKey:row.match_key,createdAt:row.created_at}])).values()].sort(compare);
  const last=keys.filter(row=>scheduleOrder.has(row.matchKey)||Number.isFinite(Date.parse(row.createdAt))).at(-1);
  const reportedObservations=last?linked.filter(report=>report.match_key===last.matchKey).flatMap(report=>visibleQuestions(report.questions_snapshot||forms.find(form=>form.id===report.form_id)?.questions||[],report.answers||{}).filter(q=>['text','select','boolean'].includes(q.type)&&hasAnswer(report.answers?.[q.id])).map(q=>({label:q.text,type:q.type,value:report.answers[q.id],reportId:report.id}))):[];
  return {ruleVersion:1,strengths:observations.filter(row=>row.classification==='strength').sort(rank).slice(0,3),concerns:observations.filter(row=>row.classification==='concern').sort(rank).slice(0,3),preliminary:observations.filter(row=>row.matchCount>0&&row.matchCount<3).sort(rank),observations:observations.sort(rank),lastMatch:last?{matchKey:last.matchKey,reportedObservations,sourceIds:linked.filter(row=>row.match_key===last.matchKey).map(row=>row.id),measurements:observations.filter(row=>row.values.some(value=>value.matchKey===last.matchKey)).map(row=>({...row,value:row.values.find(value=>value.matchKey===last.matchKey).value})),missingPhases:['auto','teleop','endgame'].filter(phase=>!observations.some(row=>row.phase===phase&&row.values.some(value=>value.matchKey===last.matchKey)))}:null};
}

export function insightText(insight) {
  const value=insight.value==null?'Unavailable':insight.kind==='success_rate'?`${insight.successes} of ${insight.denominator} observed match attempts successful (${Math.round(insight.value*100)}%)`:`${Number(insight.value.toFixed(2))}${insight.unit?` ${insight.unit}`:''} average across ${insight.matchCount} matches`;
  return `${insight.label}: ${value} · ${insight.confidence.label} evidence`;
}
