const { rows, admin, realReports } = require('./domain.cjs');
const { visibleQuestions } = require('./src/form-conditions.js');
const cache=new Map();
let cacheBytes=0;
const clearAnalyticsCache=()=>{cache.clear();cacheBytes=0;};
const publicQuestion=q=>({id:q.id,text:q.text,type:q.type,...(Array.isArray(q.options)?{options:q.options}:{}),...(Number.isFinite(q.min)?{min:q.min}:{}),...(Number.isFinite(q.max)?{max:q.max}:{})});

function sharedInputs(db, event) {
  const approved = new Set(event.shared_summary_policy?.metric_ids || []);
  const forms = rows(db, 'forms').filter(f => f.team_id === event.team_id).map(form => ({ id: form.id, team_id: form.team_id, title: form.title,
    questions: (form.questions || []).filter(q => approved.has(`${form.id}:${q.id}`) && ['number', 'scale', 'boolean', 'select'].includes(q.type)).map(publicQuestion) }));
  const submissions = realReports(db).filter(r => r.team_id === event.team_id && r.event_key === event.event_key && !rows(db, 'submission_states').some(s => s.id === r.id && s.review_required)).flatMap(report => {
    const form = forms.find(f => f.id === report.form_id);
    const originalQuestions=report.questions_snapshot||rows(db,'forms').find(f=>f.id===report.form_id)?.questions||[];
    const questions = visibleQuestions(originalQuestions,report.answers||{}).filter(q => approved.has(`${report.form_id}:${q.id}`) && ['number', 'scale', 'boolean', 'select'].includes(q.type));
    if (!questions.length) return [];
    return [{ id: report.id, team_id: report.team_id, event_key: report.event_key, match_key: report.match_key, report_kind: report.report_kind,
      scouted_team: report.scouted_team, created_at: report.created_at, form_id: report.form_id, form_title: form?.title,
      questions_snapshot: questions.map(publicQuestion),
      answers: Object.fromEntries(questions.filter(q => Object.hasOwn(report.answers || {}, q.id)).map(q => [q.id, report.answers[q.id]])) }];
  });
  return { forms, submissions, matches: event.matches || [] };
}
async function analyticsForUser(db, event, userId) {
  const { analyticsForData } = await import('./src/argus/analytics.js');
  const full = admin(db, userId, event.team_id);
  const input = full ? { forms: rows(db, 'forms').filter(f => f.team_id === event.team_id),
    submissions: realReports(db).filter(r => r.team_id === event.team_id && !rows(db,'submission_states').some(s=>s.id===r.id&&s.review_required)), matches: event.matches || [] } : sharedInputs(db, event);
  const key=JSON.stringify([full?'admin':'approved',event,input.forms.map(f=>[f.id,f.revision]),input.submissions.map(r=>r.id)]);
  const saved=cache.get(key);if(saved&&saved.until>Date.now())return saved.result;
  const result = analyticsForData(input, { id: event.team_id }, event);
  const reportReference=report=>Object.fromEntries(['id','team_id','event_key','match_key','match_number','alliance','report_kind','form_id','form_title','scouted_team','user_id','submitted_by','created_at'].filter(key=>report[key]!==undefined).map(key=>[key,report[key]]));
  for(const team of result.teams){
    team.history=team.history.map(reportReference);team.unlinkedReports=team.unlinkedReports.map(reportReference);
    for(const metrics of [team.metrics,team.pitMetrics])for(const metric of Object.values(metrics))if(['photo','draw','drawing'].includes(metric.type))metric.observations=[];
  }
  result.evidenceScope = full ? 'Authorized workspace reports' : 'Admin-approved shared measurements; private notes, photos and scout identities are excluded.';
  const bytes=Buffer.byteLength(key)+Buffer.byteLength(JSON.stringify(result));
  if(bytes<=16*1024*1024){
    if(cache.has(key)){cacheBytes-=cache.get(key).bytes;cache.delete(key);}
    while(cache.size&&(cache.size>=32||cacheBytes+bytes>32*1024*1024)){const first=cache.keys().next().value;cacheBytes-=cache.get(first).bytes;cache.delete(first);}
    cache.set(key,{result,bytes,until:Date.now()+30000});cacheBytes+=bytes;
  }
  return result;
}
module.exports = { sharedInputs, analyticsForUser, clearAnalyticsCache };
