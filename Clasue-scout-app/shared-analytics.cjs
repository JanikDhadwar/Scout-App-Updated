const { rows, admin, realReports } = require('./domain.cjs');
const { visibleQuestions } = require('./src/form-conditions.js');

function sharedInputs(db, event) {
  const approved = new Set(event.shared_summary_policy?.metric_ids || []);
  const forms = rows(db, 'forms').filter(f => f.team_id === event.team_id).map(form => ({ id: form.id, team_id: form.team_id, title: form.title,
    questions: (form.questions || []).filter(q => approved.has(`${form.id}:${q.id}`) && ['number', 'scale', 'boolean', 'select'].includes(q.type)).map(q=>({id:q.id,text:q.text,type:q.type})) }));
  const submissions = realReports(db).filter(r => r.team_id === event.team_id && r.event_key === event.event_key && !rows(db, 'submission_states').some(s => s.id === r.id && s.review_required)).flatMap(report => {
    const form = forms.find(f => f.id === report.form_id);
    const originalQuestions=report.questions_snapshot||rows(db,'forms').find(f=>f.id===report.form_id)?.questions||[];
    const questions = visibleQuestions(originalQuestions,report.answers||{}).filter(q => approved.has(`${report.form_id}:${q.id}`) && ['number', 'scale', 'boolean', 'select'].includes(q.type));
    if (!questions.length) return [];
    return [{ id: report.id, team_id: report.team_id, event_key: report.event_key, match_key: report.match_key, report_kind: report.report_kind,
      scouted_team: report.scouted_team, created_at: report.created_at, form_id: report.form_id, form_title: form?.title,
      questions_snapshot: questions.map(q => ({ id: q.id, text: q.text, type: q.type })),
      answers: Object.fromEntries(questions.filter(q => Object.hasOwn(report.answers || {}, q.id)).map(q => [q.id, report.answers[q.id]])) }];
  });
  return { forms, submissions, matches: event.matches || [] };
}
async function analyticsForUser(db, event, userId) {
  const { analyticsForData } = await import('./src/argus/analytics.js');
  const full = admin(db, userId, event.team_id);
  const input = full ? { forms: rows(db, 'forms').filter(f => f.team_id === event.team_id),
    submissions: realReports(db).filter(r => r.team_id === event.team_id && !rows(db,'submission_states').some(s=>s.id===r.id&&s.review_required)), matches: event.matches || [] } : sharedInputs(db, event);
  const result = analyticsForData(input, { id: event.team_id }, event);
  result.evidenceScope = full ? 'Authorized workspace reports' : 'Admin-approved shared measurements; private notes, photos and scout identities are excluded.';
  return result;
}
module.exports = { sharedInputs, analyticsForUser };
