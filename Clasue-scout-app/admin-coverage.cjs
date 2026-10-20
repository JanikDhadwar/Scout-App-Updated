const { rows, reject, requireAdmin, realReports, audit } = require('./domain.cjs');
const { isCompleted } = require('./src/argus/workspace-model.js');

function teamCoverage(db, event, duties = []) {
  const reports = realReports(db).filter(r => r.team_id === event.team_id && r.event_key === event.event_key);
  return (event.event_teams || []).map(team => {
    const number = String(team.team_number);
    const own = reports.filter(r => String(r.scouted_team) === number);
    const slots = (event.matches || []).filter(m => isCompleted(m) && ['red', 'blue'].some(c => m.alliances?.[c]?.team_keys?.includes(`frc${number}`)))
      .filter(m => !own.some(r => r.report_kind !== 'pit' && r.match_key === m.key))
      .map(m => ({ match_key: m.key, duty: duties.find(d => String(d.team_number) === number && d.match_key === m.key && d.report_kind !== 'pit' && !d.schedule_cancelled),
        dismissal: rows(db, 'coverage_dismissals').find(d => d.event_id === event.id && d.team_id === event.team_id && d.team_number === number && d.match_key === m.key) || null }));
    return { team_number: number, team_name: team.nickname || team.name || '', pit_missing: !own.some(r => r.report_kind === 'pit'),
      missing_matches: slots.filter(s => !s.dismissal?.dismissed), dismissed_matches: slots.filter(s => s.dismissal?.dismissed) };
  }).sort((a, b) => Number(a.team_number) - Number(b.team_number));
}

function changeDismissal(db, event, input, userId) {
  requireAdmin(db, userId, event.team_id);
  if (typeof input.dismissed !== 'boolean') reject('Choose dismiss or restore.', 400);
  const team = teamCoverage(db, event).find(t => t.team_number === String(input.team_number));
  const slot = team && [...team.missing_matches, ...team.dismissed_matches].find(s => s.match_key === input.match_key);
  if (!slot) reject('This team has no missing report for that completed match. Refresh the overview.');
  const old = slot.dismissal;
  if (input.revision !== (old?.revision || 0)) reject('This warning changed. Refresh before trying again.');
  const record = { team_id: event.team_id, event_id: event.id, event_key: event.event_key, team_number: team.team_number,
    match_key: slot.match_key, dismissed: input.dismissed, revision: (old?.revision || 0) + 1, actor_id: userId, updated_at: new Date().toISOString() };
  db.coverage_dismissals = [...rows(db, 'coverage_dismissals').filter(d => d !== old), record];
  audit(db, { teamId: event.team_id, eventKey: event.event_key, actorId: userId, action: input.dismissed ? 'coverage.dismiss' : 'coverage.restore', targetId: event.id,
    detail: { team_number: team.team_number, match_key: slot.match_key } });
  return record;
}
module.exports = { teamCoverage, changeDismissal };
