const { rows, reject, requireAdmin, realReports, audit } = require('./domain.cjs');
const { isCompleted } = require('./src/argus/workspace-model.js');
const { createHash } = require('node:crypto');

function teamCoverage(db, event, duties = []) {
  const reports = realReports(db).filter(r => r.team_id === event.team_id && r.event_key === event.event_key);
  return [...new Map((event.event_teams || []).map(team=>[String(team.team_number),team])).values()].map(team => {
    const number = String(team.team_number);
    const own = reports.filter(r => String(r.scouted_team) === number);
    const slots = (event.matches || []).filter(m => isCompleted(m) && ['red', 'blue'].some(c => m.alliances?.[c]?.team_keys?.includes(`frc${number}`)))
      .filter(m => !own.some(r => r.report_kind !== 'pit' && r.match_key === m.key))
      .map(m => ({ match_key: m.key, duty: duties.find(d => String(d.team_number) === number && d.match_key === m.key && d.report_kind !== 'pit' && !d.schedule_cancelled),
        dismissal: rows(db, 'coverage_dismissals').find(d => d.event_id === event.id && d.team_id === event.team_id && String(d.team_number) === number && d.match_key === m.key) || null }));
    const pitMissing=!own.some(r=>r.report_kind==='pit');
    const pitDismissal=rows(db,'coverage_dismissals').find(d=>d.event_id===event.id&&d.team_id===event.team_id&&String(d.team_number)===number&&d.report_kind==='pit')||null;
    const missing=slots.filter(s=>!s.dismissal?.dismissed),dismissed=slots.filter(s=>s.dismissal?.dismissed);
    const owner=rows(db,'team_allocations').find(a=>a.team_id===event.team_id&&a.event_key===event.event_key&&String(a.team_number)===number&&!a.archived_at);
    const scheduleKnown=Array.isArray(event.matches)&&event.matches.length>0;
    const revision=createHash('sha256').update(JSON.stringify([event.team_id,event.id,number,pitMissing,pitDismissal?.revision||0,slots.map(s=>[s.match_key,s.dismissal?.revision||0]).sort((a,b)=>a[0].localeCompare(b[0]))])).digest('hex');
    return { team_number: number, team_name: team.nickname || team.name || '', pit_missing: pitMissing,
      pit_dismissal:pitMissing?pitDismissal:null, owner_user_id:owner?.owner_user_id||null,
      pit_scout_user_id:duties.find(d=>String(d.team_number)===number&&d.report_kind==='pit'&&!d.schedule_cancelled)?.scout_user_id||owner?.owner_user_id||null,
      schedule_known:scheduleKnown,revision,
      status:pitMissing&&!pitDismissal?.dismissed?'red':missing.length?'yellow':scheduleKnown?'green':'unknown',
      missing_matches: missing, dismissed_matches: dismissed };
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

// Clear operational warnings only. Evidence, duty completion and analytics are untouched.
function changeTeamDismissal(db,event,input,userId){
  requireAdmin(db,userId,event.team_id);
  if(typeof input.dismissed!=='boolean')reject('Choose dismiss or restore.',400);
  const team=teamCoverage(db,event).find(t=>t.team_number===String(input.team_number));
  if(!team)reject('Event team not found.',404);
  if(input.expected_revision!==team.revision)reject('Team coverage changed. Refresh before trying again.');
  const targets=(input.dismissed?team.missing_matches:team.dismissed_matches).map(slot=>({match_key:slot.match_key,old:slot.dismissal}));
  if(team.pit_missing&&!!team.pit_dismissal?.dismissed!==input.dismissed)targets.push({report_kind:'pit',match_key:null,old:team.pit_dismissal});
  if(!targets.length)reject('No matching warnings remain. Refresh the overview.');
  const now=new Date().toISOString();
  for(const target of targets){
    const record={...target.old,team_id:event.team_id,event_id:event.id,event_key:event.event_key,team_number:team.team_number,match_key:target.match_key,
      ...(target.report_kind?{report_kind:target.report_kind}:{}),dismissed:input.dismissed,revision:(target.old?.revision||0)+1,actor_id:userId,updated_at:now};
    db.coverage_dismissals=[...rows(db,'coverage_dismissals').filter(d=>d!==target.old),record];
  }
  audit(db,{teamId:event.team_id,eventKey:event.event_key,actorId:userId,action:input.dismissed?'coverage.team.dismiss':'coverage.team.restore',targetId:event.id,
    detail:{team_number:team.team_number,pit:targets.some(t=>t.report_kind==='pit'),match_keys:targets.filter(t=>t.match_key).map(t=>t.match_key)}});
  return teamCoverage(db,event).find(t=>t.team_number===team.team_number);
}
module.exports = { teamCoverage, changeDismissal, changeTeamDismissal };
