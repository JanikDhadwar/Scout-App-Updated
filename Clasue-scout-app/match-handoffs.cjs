const {randomUUID,createHash}=require('node:crypto');
const {matchOwners}=require('./src/argus/match-access.js');
const rows=(db,key)=>Array.isArray(db[key])?db[key]:[];
const reject=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
function matchContext(db,teamId,eventId,matchKey,now){
 const event=rows(db,'scout_events').find(row=>row.team_id===teamId&&row.id===eventId&&!row.archived_at&&!row.data_cleared_at),match=event?.matches?.find(row=>row.key===matchKey);
 if(!event||!match)reject('Choose a scheduled match in your active event.',404);
 const team=rows(db,'teams').find(row=>row.id===teamId);
 if(team?.active_event_id&&team.active_event_id!==eventId)reject('Use the active event for handoffs.');
 const start=Number(match.predicted_time||match.time)*1000;
 const started=!!(match.actual_time||match.post_result_time)||['red','blue'].some(color=>Number(match.alliances?.[color]?.score)>=0&&match.alliances?.[color]?.score!=null);
 return {event,match,slots:matchOwners({event,match,assignments:rows(db,'assignments')}),canHandoff:!started&&Number.isFinite(start)&&start>now,start};
}
function member(db,teamId,id){return rows(db,'memberships').some(row=>row.team_id===teamId&&row.user_id===id)&&rows(db,'users').some(row=>row.id===id&&!row.disabled&&!row.disabled_at);}
function fingerprint(db,context,slot){
 const assignments=rows(db,'assignments').filter(row=>row.team_id===context.event.team_id&&row.event_key===context.event.event_key&&row.match_key===context.match.key&&String(row.team_number)===slot.teamNumber&&row.report_kind!=='pit'&&!row.archived_at);
 return createHash('sha256').update(JSON.stringify({eventId:context.event.id,matchKey:context.match.key,team:slot.teamNumber,owners:slot.owners,assignments})).digest('hex');
}
function hasReport(db,context,number){return rows(db,'submissions').some(row=>row.team_id===context.event.team_id&&row.event_key===context.event.event_key&&row.match_key===context.match.key&&String(row.scouted_team)===String(number)&&row.report_kind!=='pit');}
function handoffContext(db,{teamId,eventId,matchKey,userId,now=Date.now(),isOnline=()=>false}){
 if(!member(db,teamId,userId))reject('Team membership required.',403);
 const context=matchContext(db,teamId,eventId,matchKey,now);
 const mine=context.slots.filter(slot=>slot.owners.length===1&&slot.owners[0]===userId).map(slot=>({teamNumber:slot.teamNumber,alliance:slot.alliance,ownerRevision:fingerprint(db,context,slot),hasReport:hasReport(db,context,slot.teamNumber),pending:rows(db,'match_handoffs').some(row=>row.team_id===teamId&&row.event_id===eventId&&row.match_key===matchKey&&row.team_number===slot.teamNumber&&row.status==='pending'&&row.expires_at>now)}));
 const eligible=rows(db,'memberships').filter(row=>row.team_id===teamId&&row.user_id!==userId&&member(db,teamId,row.user_id)&&isOnline(row.user_id)&&!context.slots.some(slot=>slot.owners.includes(row.user_id))).map(row=>({id:row.user_id,username:rows(db,'users').find(user=>user.id===row.user_id)?.username||row.username||'Scout'}));
 return {mine,eligible,canHandoff:context.canHandoff,reason:context.canHandoff?'':'Handoffs close when the match starts. A future scheduled or predicted start time is required.'};
}
function createHandoff(db,{id,teamId,eventId,matchKey,teamNumber,toUserId,ownerRevision,userId,now=Date.now(),isOnline=()=>false}){
 if(typeof id!=='string'||!id||id.length>200)reject('A handoff request ID is required.',400);
 if(!member(db,teamId,userId))reject('Team membership required.',403);
 const existing=rows(db,'match_handoffs').find(row=>row.id===id);
 if(existing){if(existing.team_id===teamId&&existing.from_user_id===userId&&existing.to_user_id===toUserId&&existing.event_id===eventId&&existing.match_key===matchKey&&existing.team_number===String(teamNumber)&&existing.owner_revision===ownerRevision)return existing;reject('This handoff request ID is already in use.');}
 const context=matchContext(db,teamId,eventId,matchKey,now),slot=context.slots.find(row=>row.teamNumber===String(teamNumber));
 if(!slot||slot.owners.length!==1||slot.owners[0]!==userId)reject('Only the assigned scout can offer this robot.',403);
 if(!context.canHandoff)reject('The match has started or its start time is unavailable.');
 if(fingerprint(db,context,slot)!==ownerRevision)reject('Your assignment changed. Refresh before offering a handoff.');
 if(hasReport(db,context,teamNumber))reject('This robot already has a submitted match report.');
 if(!member(db,teamId,toUserId)||toUserId===userId||context.slots.some(row=>row.owners.includes(toUserId)))reject('Choose a teammate with no robots assigned in this match.');
 if(!isOnline(toUserId))reject('The selected scout is offline. Both scouts must be connected to Argus.');
 if(rows(db,'match_handoffs').some(row=>row.team_id===teamId&&row.event_id===eventId&&row.match_key===matchKey&&row.team_number===String(teamNumber)&&row.status==='pending'&&row.expires_at>now))reject('This robot already has a pending handoff. Cancel it before offering another.');
 const row={id,team_id:teamId,event_id:eventId,event_key:context.event.event_key,match_key:matchKey,match_number:context.match.match_number,team_number:String(teamNumber),alliance:slot.alliance,from_user_id:userId,to_user_id:toUserId,owner_revision:ownerRevision,status:'pending',revision:1,created_at:new Date(now).toISOString(),expires_at:Math.min(now+300000,context.start)};
 db.match_handoffs=[...rows(db,'match_handoffs'),row];return row;
}
function respondHandoff(db,{id,userId,action,revision,now=Date.now(),isOnline=()=>false}){
 const row=rows(db,'match_handoffs').find(row=>row.id===id);
 if(!row||!member(db,row.team_id,userId))reject('Handoff not found.',404);
 if(!['accept','decline','cancel'].includes(action))reject('Choose Accept, Decline or Cancel.',400);
 if((action==='cancel'?row.from_user_id:row.to_user_id)!==userId)reject('This handoff belongs to another scout.',403);
 const status={accept:'accepted',decline:'declined',cancel:'cancelled'}[action];
 if(row.status===status)return row;
 if(row.status!=='pending'||row.revision!==revision)reject('This handoff already changed. Refresh its current status.');
 if(action==='accept'){
  const context=matchContext(db,row.team_id,row.event_id,row.match_key,now),slot=context.slots.find(slot=>slot.teamNumber===row.team_number);
  if(row.expires_at<=now||!context.canHandoff)reject('This handoff expired or the match has started.');
  if(!member(db,row.team_id,row.from_user_id)||!isOnline(row.from_user_id))reject('The sending scout is offline. Reconnect before accepting.');
  if(!slot||slot.owners.length!==1||slot.owners[0]!==row.from_user_id||fingerprint(db,context,slot)!==row.owner_revision)reject('The original assignment changed. This handoff cannot be accepted.');
  if(context.slots.some(slot=>slot.owners.includes(userId)))reject('You already have a robot to scout in this match.');
  if(hasReport(db,context,row.team_number))reject('This robot already has a submitted match report.');
  const existing=rows(db,'assignments').filter(assignment=>assignment.team_id===row.team_id&&assignment.event_key===row.event_key&&assignment.match_key===row.match_key&&String(assignment.team_number)===row.team_number&&assignment.report_kind!=='pit'&&!assignment.archived_at);
  if(existing.length)for(const assignment of existing){assignment.scout_user_id=userId;assignment.revision=(assignment.revision||0)+1;assignment.handoff_id=row.id;}
  else {const forms=rows(db,'forms').filter(form=>form.team_id===row.team_id&&!form.archived&&!form.archived_at&&(form.kind||'match')==='match');const eventForms=[...new Set(rows(db,'assignments').filter(a=>a.team_id===row.team_id&&a.event_key===row.event_key&&a.report_kind!=='pit'&&!a.archived_at&&a.form_id).map(a=>a.form_id))].filter(id=>forms.some(form=>form.id===id)),formId=forms.length===1?forms[0].id:(eventForms.length===1?eventForms[0]:'');db.assignments=[...rows(db,'assignments'),{id:randomUUID(),team_id:row.team_id,event_key:row.event_key,match_key:row.match_key,match_number:row.match_number,team_number:Number(row.team_number),alliance:row.alliance,scout_user_id:userId,report_kind:'match',form_id:formId,revision:1,handoff_id:row.id,created_at:new Date(now).toISOString()}];}
  context.event.assignment_revision=(context.event.assignment_revision||0)+1;
 }
 row.status=status;row.revision++;row.responded_at=new Date(now).toISOString();return row;
}
module.exports={handoffContext,createHandoff,respondHandoff};
