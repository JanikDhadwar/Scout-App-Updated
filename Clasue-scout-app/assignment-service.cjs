const { createHash, randomUUID } = require('node:crypto');
const { rows, reject, requireAdmin, activeMember, audit, realReports } = require('./domain.cjs');
const { isCompleted } = require('./src/argus/workspace-model.js');
const { matchOwners } = require('./src/argus/match-access.js');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const scoped = (values, event) => values.filter(row => row.team_id === event.team_id && row.event_key === event.event_key && !row.archived_at);
const allocationRows = (db, event) => scoped(rows(db, 'team_allocations'), event);
const planFor = (db, event) => rows(db, 'assignment_plans').find(row => row.event_id === event.id && row.team_id === event.team_id);
const matchesTeam = (match, number) => ['red', 'blue'].some(color => match.alliances?.[color]?.team_keys?.includes(`frc${number}`));
function eventFor(db, id, userId) {
  const event = rows(db, 'scout_events').find(row => row.id === id && !row.data_cleared_at);
  if (!event) reject('Event not found.', 404);
  if (userId) requireAdmin(db, userId, event.team_id);
  return event;
}
function editableEvent(db, event) {
  const team = rows(db, 'teams').find(row => row.id === event.team_id);
  if (event.archived_at || (team?.active_event_id && team.active_event_id !== event.id)) reject('Activate this event before changing assignments.');
}
function random(seed) {
  let value = parseInt(hash(seed).slice(0, 8), 16) || 1;
  return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; };
}
function shuffled(values, next) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
function createScorer(allocations, matches, extraMembers = []) {
  // The schedule graph is fixed throughout a seeded start. Avoid reparsing robot
  // keys and creating maps for every candidate swap on the single server thread.
  const indexes = new Map(allocations.map((a,i)=>[Number(a.team_number),i]));
  const members = new Map([...new Set([...allocations.map(a=>a.owner_user_id), ...extraMembers])].map((id,i)=>[id,i]));
  const slots = matches.map(match=>['red','blue'].flatMap(color=>match.alliances?.[color]?.team_keys||[]).map(key=>indexes.get(Number(key.replace(/^frc/,'')))).filter(i=>i!==undefined));
  const owners = new Int32Array(allocations.length), counts = new Int32Array(members.size), loads = new Int32Array(members.size);
  return () => {
    let excess=0,maxLoad=0,variance=0;loads.fill(0);
    for(let i=0;i<allocations.length;i++)owners[i]=members.get(allocations[i].owner_user_id);
    for(const robots of slots){
      for(const robot of robots){const owner=owners[robot];if(counts[owner]++)excess++;loads[owner]++;}
      for(const robot of robots)counts[owners[robot]]=0;
    }
    for(const load of loads){maxLoad=Math.max(maxLoad,load);variance+=load*load;}
    return [excess,maxLoad,variance];
  };
}
const better = (a, b) => a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2])));
function previewPlan(db, input, userId) {
  const event = eventFor(db, input.event_id, userId); editableEvent(db, event);
  if(!Array.isArray(event.event_teams||[])||(event.event_teams||[]).length>128||!Array.isArray(event.matches||[])||(event.matches||[]).length>400||(event.matches||[]).some(match=>['red','blue'].some(color=>(match.alliances?.[color]?.team_keys?.length||0)>6)))reject('Automatic assignments support up to 128 teams and 400 matches per event.',400);
  const existing = allocationRows(db, event), prior = planFor(db, event);
  const mode = input.mode || 'fill';
  if (!['fill', 'rerandomize', 'add_scouts'].includes(mode)) reject('Choose an assignment action.', 400);
  const incoming = mode === 'add_scouts' ? input.new_scout_ids : [];
  if (mode === 'add_scouts') {
    if (!existing.length) reject('Assign teams once before adding another scout.', 400);
    if (!Array.isArray(incoming) || !incoming.length || incoming.length > 100 || incoming.some(id => typeof id !== 'string' || !activeMember(db, id, event.team_id))) reject('Choose an active team member as the new scout.', 400);
    if (incoming.some(id => existing.some(row => row.owner_user_id === id))) reject('This scout already has teams. Use individual team changes instead.', 400);
  }
  const newIds = [...new Set(incoming)];
  const scoutIds = [...new Set(mode === 'add_scouts'
    ? [...(prior?.scout_ids || existing.map(row => row.owner_user_id)).filter(id => activeMember(db, id, event.team_id)), ...newIds]
    : input.scout_ids || prior?.scout_ids || [])];
  if (!scoutIds.length || scoutIds.length>100 || scoutIds.some(id => !activeMember(db, id, event.team_id))) reject('Select between 1 and 100 active workspace scouts.', 400);
  const seed = typeof input.seed === 'string' && input.seed.length <= 100 ? input.seed : randomUUID();
  const forms = {};
  for (const kind of ['pit', 'match']) {
    const id = (mode === 'add_scouts' && prior?.[`${kind}_form_id`]) || input[`${kind}_form_id`] || prior?.[`${kind}_form_id`];
    forms[kind] = rows(db, 'forms').find(row => row.id === id && row.team_id === event.team_id && !row.archived && !row.archived_at && (row.kind || 'match') === kind);
    if (!forms[kind]) reject(`Choose an active ${kind} form.`, 400);
  }
  const numbers = [...new Set((event.event_teams || []).map(t => Number(t.team_number)).filter(n => Number.isInteger(n) && n > 0))];
  if (!numbers.length) reject('Download event teams before assigning owners.', 400);
  const duplicates = existing.filter((row, i) => existing.findIndex(other => Number(other.team_number) === Number(row.team_number)) !== i);
  if (duplicates.length) reject('Duplicate primary owners require coordinator review.');
  const fixed = existing.filter(row => mode === 'fill' || row.locked || !numbers.includes(Number(row.team_number))).map(row => ({ ...row }));
  const movable = numbers.filter(number => !fixed.some(row => Number(row.team_number) === number));
  const future = (event.matches || []).filter(match => !isCompleted(match));
  let best, bestScore;
  const warnings = [];
  if (mode === 'add_scouts') {
    best = existing.map(row => ({ ...row }));
    const counts = new Map(scoutIds.map(id => [id, best.filter(row => numbers.includes(Number(row.team_number)) && row.owner_user_id === id).length]));
    const next = random(seed);
    // First use teams that nobody owns. Existing scouts never trade teams here.
    for (const number of shuffled(numbers.filter(number => !best.some(row => Number(row.team_number) === number)), next)) {
      const owner = [...newIds].sort((a,b) => counts.get(a)-counts.get(b))[0];
      best.push({team_number:number,owner_user_id:owner,locked:false});counts.set(owner,counts.get(owner)+1);
    }
    const target = Math.floor(numbers.length / scoutIds.length), score = createScorer(best, future, scoutIds);
    for (const recipient of newIds) {
      while (counts.get(recipient) < target) {
        const donors = best.filter(row => numbers.includes(Number(row.team_number)) && !row.locked && !newIds.includes(row.owner_user_id) && counts.get(row.owner_user_id) > target);
        if (!donors.length) break;
        const largest = Math.max(...donors.map(row => counts.get(row.owner_user_id)));
        let chosen, chosenScore;
        for (const row of shuffled(donors.filter(row => counts.get(row.owner_user_id) === largest),next)) {
          const previous = row.owner_user_id;row.owner_user_id = recipient;const trial = score();row.owner_user_id = previous;
          if (!chosen || better(trial,chosenScore)) { chosen = row;chosenScore = trial; }
        }
        counts.set(chosen.owner_user_id,counts.get(chosen.owner_user_id)-1);chosen.owner_user_id = recipient;counts.set(recipient,counts.get(recipient)+1);
      }
      if (counts.get(recipient) < target) warnings.push('Not enough unlocked teams can move to give the new scout a full share. Unlock a team or move one explicitly.');
      if (!counts.get(recipient) && !target) warnings.push('There are fewer teams than participating scouts. Move a team explicitly or use one-match handoffs.');
    }
    bestScore = score();
  } else for (let start = 0; start < 32; start++) {
    const next = random(`${seed}:${start}`), candidate = fixed.map(row => ({ ...row }));
    const counts = new Map(scoutIds.map(id => [id, candidate.filter(row => row.owner_user_id === id).length]));
    for (const number of shuffled(movable, next)) {
      const owner = shuffled(scoutIds, next).sort((a, b) => counts.get(a) - counts.get(b))[0];
      counts.set(owner, counts.get(owner) + 1);
      const old = existing.find(row => Number(row.team_number) === number);
      candidate.push({ ...(old || {}), team_number: number, owner_user_id: owner, locked: old?.locked || false });
    }
    const scoreCandidate=createScorer(candidate,future);
    let score = scoreCandidate();
    const indexes = candidate.map((row, i) => movable.includes(Number(row.team_number)) ? i : -1).filter(i => i >= 0);
    for (let attempt = 0; attempt < Math.min(2000, indexes.length * indexes.length * 2); attempt++) {
      const a = indexes[Math.floor(next() * indexes.length)], b = indexes[Math.floor(next() * indexes.length)];
      if (a === b || candidate[a].owner_user_id === candidate[b].owner_user_id) continue;
      [candidate[a].owner_user_id, candidate[b].owner_user_id] = [candidate[b].owner_user_id, candidate[a].owner_user_id];
      const trial = scoreCandidate();
      if (better(trial, score)) score = trial;
      else [candidate[a].owner_user_id, candidate[b].owner_user_id] = [candidate[b].owner_user_id, candidate[a].owner_user_id];
    }
    if (!best || better(score, bestScore)) { best = candidate; bestScore = score; }
  }
  best.sort((a, b) => a.team_number - b.team_number);
  const normalized = { event_id: event.id, scout_ids: scoutIds, mode, seed, pit_form_id: forms.pit.id, match_form_id: forms.match.id, ...(mode === 'add_scouts' ? {new_scout_ids:newIds} : {}) };
  const fingerprint = hash({ input: normalized, event, existing, plan: prior, assignments: scoped(rows(db, 'assignments'), event),
    members: rows(db, 'memberships').filter(m => m.team_id === event.team_id), forms: Object.values(forms),
    reports: realReports(db).filter(r => r.team_id === event.team_id && r.event_key === event.event_key).map(r => r.id), allocations: best });
  for (const row of fixed) if (!scoutIds.includes(row.owner_user_id)) warnings.push(`Team ${row.team_number} remains with a non-participating scout. Move it explicitly${row.locked ? ' or unlock it' : ''}.`);
  if (!future.length) warnings.push('No upcoming schedule is available. Team ownership and pit duties can be saved; match coverage remains unknown until a schedule is downloaded.');
  const transfers = best.filter(row => existing.some(old => Number(old.team_number) === Number(row.team_number) && old.owner_user_id !== row.owner_user_id)).map(row => ({team_number:row.team_number,from_user_id:existing.find(old => Number(old.team_number) === Number(row.team_number)).owner_user_id,to_user_id:row.owner_user_id}));
  return { input: normalized, fingerprint, allocations: best, transfers, collision_count: bestScore[0], warnings,
    loads: scoutIds.map(id => ({ user_id: id, teams: best.filter(row => row.owner_user_id === id).length })) };
}
function history(db, assignment, previous, actorId, source, handoffId = null) {
  db.responsibility_history = [...rows(db, 'responsibility_history'), { id: randomUUID(), team_id: assignment.team_id,
    event_key: assignment.event_key, assignment_id: assignment.id, from_user_id: previous, to_user_id: assignment.scout_user_id,
    actor_id: actorId, source, handoff_id: handoffId, revision: assignment.revision, created_at: new Date().toISOString() }];
}
function reportFor(db, assignment) {
  return realReports(db).find(report => report.team_id === assignment.team_id && report.event_key === assignment.event_key &&
    report.user_id === assignment.scout_user_id && String(report.scouted_team) === String(assignment.team_number) &&
    (!assignment.form_id || report.form_id === assignment.form_id) &&
    (assignment.report_kind === 'pit' ? report.report_kind === 'pit' : report.report_kind !== 'pit' && report.match_key === assignment.match_key));
}
function reconcile(db, event, actorId) {
  const plan = planFor(db, event); if (!plan) return { added: 0, changed: 0 };
  db.assignments = rows(db, 'assignments');
  let added = 0, changed = 0;
  const matches = event.matches || [];
  for (const allocation of allocationRows(db, event)) {
    if (!activeMember(db, allocation.owner_user_id, event.team_id)) continue;
    const tasks = [{ kind: 'pit', match: null, alliance: null }, ...matches.filter(match => matchesTeam(match, allocation.team_number)).map(match => ({ kind: 'match', match, alliance: ['red', 'blue'].find(color => match.alliances?.[color]?.team_keys?.includes(`frc${allocation.team_number}`)) }))];
    for (const { kind, match, alliance } of tasks) {
      const formId = plan[`${kind}_form_id`];
      const existing = db.assignments.find(row => row.team_id === event.team_id && row.event_key === event.event_key &&
        (row.report_kind || 'match') === kind && String(row.team_number) === String(allocation.team_number) &&
        (row.match_key || null) === (match?.key || null) && !row.archived_at);
      if (existing) {
        // Preserve accepted coverage, completed work and explicit old/manual exceptions.
        if (existing.source === 'generated' && !existing.handoff_id && !reportFor(db, existing) && !isCompleted(match) &&
            (existing.scout_user_id !== allocation.owner_user_id || existing.form_id !== formId || existing.schedule_cancelled)) {
          const previous = existing.scout_user_id;
          Object.assign(existing, { scout_user_id: allocation.owner_user_id, primary_scout_user_id: allocation.owner_user_id,
            allocation_id: allocation.id, form_id: formId, alliance, schedule_cancelled: false, revision: (existing.revision || 0) + 1 });
          history(db, existing, previous, actorId, 'ownership'); changed++;
        }
        continue;
      }
      if (match && isCompleted(match)) continue;
      const id = hash([event.team_id, event.event_key, allocation.team_number, kind, match?.key || null]);
      // A formerly cancelled duty keeps its id/history rather than creating a duplicate.
      if (db.assignments.some(row => row.id === id)) continue;
      const assignment = { id, team_id: event.team_id, event_key: event.event_key, report_kind: kind,
        team_number: allocation.team_number, match_key: match?.key || null, match_number: match?.match_number || null, alliance,
        scout_user_id: allocation.owner_user_id, primary_scout_user_id: allocation.owner_user_id, allocation_id: allocation.id,
        form_id: formId, source: 'generated', revision: 1, created_at: new Date().toISOString() };
      db.assignments.push(assignment); history(db, assignment, null, actorId, 'generated'); added++;
    }
  }
  for (const duty of scoped(db.assignments, event)) if (duty.source === 'generated' && duty.report_kind !== 'pit') {
    const match = matches.find(row => row.key === duty.match_key);
    if ((!match || !matchesTeam(match, duty.team_number)) && !duty.schedule_cancelled) { duty.schedule_cancelled = true; duty.revision++; changed++; }
  }
  if (added || changed) event.assignment_revision = (event.assignment_revision || 0) + 1;
  return { added, changed };
}
function mirrorLegacy(db, event) {
  const assignment = {};
  for (const row of allocationRows(db, event)) {
    if (!assignment[row.owner_user_id]) assignment[row.owner_user_id] = { teams: [] };
    assignment[row.owner_user_id].teams.push(row.team_number);
  }
  event.assignment = assignment;
}
function applyPlan(db, input, userId) {
  const event = eventFor(db, input.event_id, userId); editableEvent(db, event);
  if (typeof input.request_id !== 'string' || !/^[-\w]{1,100}$/.test(input.request_id)) reject('A plan request ID is required.', 400);
  const oldPlan = planFor(db, event), applied = oldPlan?.applied?.find(row => row.id === input.request_id);
  if (applied) { if (applied.fingerprint !== input.fingerprint) reject('This request ID belongs to a different plan.'); return { ...viewPlan(db, event), added: 0, replayed: true }; }
  const preview = previewPlan(db, input, userId);
  if (!input.fingerprint || input.fingerprint !== preview.fingerprint) reject('Assignments, members, schedule or reports changed. Preview again; no changes were saved.');
  const now = new Date().toISOString();
  const allocations = preview.allocations.map(row => ({ ...row, id: row.id || randomUUID(), team_id: event.team_id,
    event_id: event.id, event_key: event.event_key, revision: (row.revision || 0) + 1, updated_at: now }));
  db.team_allocations = [...rows(db, 'team_allocations').filter(row => !(row.team_id === event.team_id && row.event_key === event.event_key && !row.archived_at)), ...allocations];
  const plan = { ...oldPlan, id: oldPlan?.id || randomUUID(), ...preview.input, team_id: event.team_id, revision: (oldPlan?.revision || 0) + 1,
    applied: [...(oldPlan?.applied || []).slice(-19), { id: input.request_id, fingerprint: input.fingerprint }] };
  db.assignment_plans = [...rows(db, 'assignment_plans').filter(row => row.id !== oldPlan?.id), plan];
  mirrorLegacy(db, event);
  event.excluded = rows(db, 'memberships').filter(m => m.team_id === event.team_id && !plan.scout_ids.includes(m.user_id)).map(m => m.user_id);
  event.assignment_revision = (event.assignment_revision || 0) + 1;
  const changes = reconcile(db, event, userId);
  audit(db, { teamId: event.team_id, eventKey: event.event_key, actorId: userId, action: plan.mode === 'add_scouts' ? 'assignments.add_scouts' : 'assignments.randomize', targetId: event.id,
    detail: { mode: plan.mode, seed: plan.seed, participants: plan.scout_ids.length, teams: allocations.length, ...changes } });
  return { ...viewPlan(db, event), ...changes };
}
function updateAllocation(db, id, input, userId) {
  const allocation = rows(db, 'team_allocations').find(row => row.id === id && !row.archived_at);
  if (!allocation) reject('Team allocation not found.', 404);
  const event = eventFor(db, allocation.event_id, userId); editableEvent(db, event);
  if (input.revision !== allocation.revision) reject('Team ownership changed. Reload before saving.');
  if (input.locked !== undefined && typeof input.locked !== 'boolean') reject('Invalid lock setting.', 400);
  const owner = input.owner_user_id || allocation.owner_user_id;
  if (!activeMember(db, owner, event.team_id)) reject('Choose an active workspace member.', 400);
  const previous = allocation.owner_user_id;
  allocation.owner_user_id = owner; allocation.locked = input.locked ?? allocation.locked; allocation.revision++;
  event.assignment_revision = (event.assignment_revision || 0) + 1;
  mirrorLegacy(db, event); reconcile(db, event, userId);
  audit(db, { teamId: event.team_id, eventKey: event.event_key, actorId: userId, action: 'ownership.update', targetId: id,
    detail: { team_number: allocation.team_number, from_user_id: previous, to_user_id: owner, locked: allocation.locked } });
  return allocation;
}
function viewPlan(db, event) {
  const assignments = scoped(rows(db, 'assignments'), event).map(row => ({ ...row, completion: reportFor(db, row)?.id || null,
    member_missing: !activeMember(db, row.scout_user_id, event.team_id) }));
  const conflicts = [];
  for (const match of event.matches || []) {
    const slots = matchOwners({ event, match, assignments });
    const owners = new Map();
    for (const slot of slots) {
      if (slot.owners.length !== 1 || !activeMember(db, slot.owners[0], event.team_id)) conflicts.push({ match_key: match.key, team_numbers: [slot.teamNumber], user_id: null, kind: slot.owners.length > 1 ? 'duplicate_owner' : 'unassigned' });
      for (const id of slot.owners) owners.set(id, [...(owners.get(id) || []), slot.teamNumber]);
    }
    for (const [id, teams] of owners) if (teams.length > 1) conflicts.push({ match_key: match.key, team_numbers: teams, user_id: id, kind: 'collision' });
  }
  const allocations = allocationRows(db, event);
  return { event_id: event.id, revision: event.assignment_revision || 0, plan: planFor(db, event) || null, allocations, assignments, conflicts,
    unowned: (event.event_teams || []).filter(t => !allocations.some(a => Number(a.team_number) === Number(t.team_number))).map(t => t.team_number) };
}
module.exports = { eventFor, previewPlan, applyPlan, updateAllocation, reconcile, viewPlan, history, reportFor, allocationRows };
