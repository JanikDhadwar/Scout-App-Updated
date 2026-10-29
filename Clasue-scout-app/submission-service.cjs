const { isDeepStrictEqual } = require('node:util');
const { visibleQuestions, hasAnswer, validateConditions } = require('./src/form-conditions.js');
const { rows, reject, requireAdmin, audit, reportRemoved } = require('./domain.cjs');
const { validateImageDataUrl } = require('./media-validation.cjs');

function validateReport(db, form, report) {
  if (!report.answers || typeof report.answers !== 'object' || Array.isArray(report.answers)) return 'Report answers must be an object.';
  if (report.practice || report.practice_session_id || report.mode === 'practice') return 'Practice reports must use Practice scouting.';
  if (Object.hasOwn(report, 'removed') || Object.hasOwn(report, 'removed_at')) return 'Report state is managed by the server.';
  if (report.event_key && !rows(db, 'scout_events').some(event => event.team_id === report.team_id && event.event_key === report.event_key && !event.data_cleared_at)) return 'Choose an event in this workspace.';
  let questions = form.questions || [];
  if (report.questions_snapshot && !isDeepStrictEqual(report.questions_snapshot, questions)) {
    const version = rows(db, 'form_versions').find(row => row.form_id === form.id && isDeepStrictEqual(row.questions, report.questions_snapshot));
    // Old saved drafts remain recoverable rather than being rewritten/rejected for a schema change.
    if (version) questions = version.questions;
    else return null; // Flagged for review by the upload handler; not used as trusted shared evidence.
  }
  for (const q of visibleQuestions(questions, report.answers)) {
    const value = report.answers[q.id];
    if (q.required && !hasAnswer(value)) return `Required: ${q.text}`;
    if (!hasAnswer(value)) continue;
    if (['number', 'scale'].includes(q.type)) {
      if (!['number', 'string'].includes(typeof value) || !Number.isFinite(Number(value))) return `Enter a valid number for ${q.text}.`;
      if (q.type === 'scale' && (Number(value) < 1 || Number(value) > 10)) return `${q.text} must be between 1 and 10.`;
      if (q.min != null && Number(value) < Number(q.min) || q.max != null && Number(value) > Number(q.max)) return `${q.text} is outside its configured range.`;
    }
    if (q.type === 'select' && !(q.options || []).includes(value)) return `Choose an available option for ${q.text}.`;
    if (q.type === 'boolean' && ![true, false, 'Yes', 'No'].includes(value)) return `Choose Yes or No for ${q.text}.`;
    if (['photo', 'draw', 'drawing'].includes(q.type) && !validateImageDataUrl(value)) return `Choose a valid image for ${q.text}.`;
  }
  return null;
}
function validateForm(form) {
  if(form.guidance_mode!=null&&!['quick','guided'].includes(form.guidance_mode))return 'Choose Quick or Guided guidance.';
  if (!Array.isArray(form.questions) || form.questions.length > 200) return 'Use a question list with at most 200 questions.';
  if (new Set(form.questions.map(q => q.id)).size !== form.questions.length || form.questions.some(q => !q.id || typeof q.text !== 'string')) return 'Questions require unique IDs and labels.';
  for(const q of form.questions){
    for(const field of ['hint','example'])if(q[field]!=null&&(typeof q[field]!=='string'||q[field].length>1200))return 'Question hints and examples must be short text.';
    if(q.review_greater_than&&(!form.questions.slice(0,form.questions.indexOf(q)).some(other=>other.id===q.review_greater_than&&other.type==='number')||q.type!=='number'))return 'Review comparisons must reference an earlier numeric question.';
  }
  return validateConditions(form.questions);
}
function changeReportState(db, { id, actorId, removed, reason, revision }) {
  const report = rows(db, 'submissions').find(row => row.id === id);
  if (!report) reject('Report not found.', 404);
  requireAdmin(db, actorId, report.team_id);
  const state = rows(db, 'submission_states').find(row => row.id === id);
  if (revision !== (state?.revision || 0)) reject('Report state changed. Reload before continuing.');
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) reject('Enter a reason under 500 characters.', 400);
  const next = { ...state, id, team_id: report.team_id, removed, reason: reason.trim(), revision: (state?.revision || 0) + 1,
    actor_id: actorId, updated_at: new Date().toISOString() };
  db.submission_states = [...rows(db, 'submission_states').filter(row => row.id !== id), next];
  audit(db, { teamId: report.team_id, eventKey: report.event_key, actorId, action: removed ? 'report.remove' : 'report.restore', targetId: id,
    detail: { reason: reason.trim() } });
  return next;
}
module.exports = { validateReport, validateForm, changeReportState, reportRemoved };
