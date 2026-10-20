const { randomUUID } = require('node:crypto');
const { rows, reject, role, membership, activeMember, requireAdmin, audit } = require('./domain.cjs');

function changeMember(db, { actorId, id, action, nextRole }) {
  const member = rows(db, 'memberships').find(row => row.id === id);
  if (!member) reject('Member not found.', 404);
  const actorRole = role(db, actorId, member.team_id);
  requireAdmin(db, actorId, member.team_id);
  if (member.role === 'owner') reject('Use ownership transfer to change the owner.');
  if (actorRole !== 'owner' && (member.role !== 'member' || action !== 'remove')) reject('Only the Owner may manage privileged roles.', 403);
  if (action === 'role' && !['admin', 'member'].includes(nextRole)) reject('Invalid role.', 400);
  if (!['remove', 'role'].includes(action)) reject('Invalid member action.', 400);
  const previous = member.role;
  if (action === 'remove') db.memberships = rows(db, 'memberships').filter(row => row.id !== id);
  else member.role = nextRole;
  audit(db, { teamId: member.team_id, actorId, action: `member.${action}`, targetId: id,
    detail: { user_id: member.user_id, previous_role: previous, role: action === 'remove' ? null : nextRole } });
  return { ok: true };
}
function requestTransfer(db, { actorId, teamId, targetId, now = Date.now() }) {
  if (role(db, actorId, teamId) !== 'owner') reject('Owner permission required.', 403);
  if (actorId === targetId || !activeMember(db, targetId, teamId)) reject('Choose another active member.', 400);
  for (const offer of rows(db, 'ownership_transfers')) if (offer.team_id === teamId && offer.status === 'pending') offer.status = 'cancelled';
  const transfer = { id: randomUUID(), team_id: teamId, from_user_id: actorId, to_user_id: targetId,
    status: 'pending', expires_at: now + 900000, created_at: new Date(now).toISOString() };
  db.ownership_transfers = [...rows(db, 'ownership_transfers'), transfer];
  audit(db, { teamId, actorId, action: 'ownership.offer', targetId: transfer.id, detail: { to_user_id: targetId } });
  return transfer;
}
function respondTransfer(db, { actorId, id, action, now = Date.now() }) {
  const transfer = rows(db, 'ownership_transfers').find(row => row.id === id);
  if (!transfer) reject('Transfer not found.', 404);
  if (!['accept', 'decline', 'cancel'].includes(action)) reject('Choose Accept, Decline or Cancel.', 400);
  if ((action === 'cancel' ? transfer.from_user_id : transfer.to_user_id) !== actorId) reject('This transfer belongs to another user.', 403);
  const status = { accept: 'accepted', decline: 'declined', cancel: 'cancelled' }[action];
  if (transfer.status === status) return { ok: true, status };
  if (transfer.status !== 'pending' || transfer.expires_at <= now) reject('This transfer expired or was already changed.');
  if (action === 'accept') {
    if (role(db, transfer.from_user_id, transfer.team_id) !== 'owner' || !activeMember(db, actorId, transfer.team_id)) reject('Ownership or membership changed.');
    const team = rows(db, 'teams').find(row => row.id === transfer.team_id);
    if (team.owner_id !== transfer.from_user_id) reject('Ownership changed.');
    membership(db, transfer.from_user_id, transfer.team_id).role = 'admin';
    membership(db, actorId, transfer.team_id).role = 'owner'; team.owner_id = actorId;
  }
  transfer.status = status; transfer.responded_at = new Date(now).toISOString();
  audit(db, { teamId: transfer.team_id, actorId, action: `ownership.${status}`, targetId: id });
  return { ok: true, status };
}
module.exports = { changeMember, requestTransfer, respondTransfer };
