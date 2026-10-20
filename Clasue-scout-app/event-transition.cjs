const {createHash}=require('node:crypto');
const stores=['submissions','pit_scouts','assignments','picklists','match_handoffs'];
const rows=(db,store)=>Array.isArray(db[store])?db[store]:[];
function reject(message,status=409){throw Object.assign(new Error(message),{status});}
function activeEvent(db,teamId){
 const team=rows(db,'teams').find(row=>row.id===teamId);
 const events=rows(db,'scout_events').filter(row=>row.team_id===teamId&&!row.data_cleared_at);
 return events.find(row=>row.id===team?.active_event_id&&!row.archived_at)||null;
}
function previewTransition(db,teamId,nextEventId){
 const team=rows(db,'teams').find(row=>row.id===teamId);
 if(!team)reject('Team not found.',404);
 const next=rows(db,'scout_events').find(row=>row.id===nextEventId&&row.team_id===teamId);
 if(!next)reject('Choose an event in your team.',404);
 if(next.data_cleared_at)reject('This event was cleared. Add a different event.');
 if(next.archived_at)reject('Restore the selected event before using it.');
 const current=activeEvent(db,teamId);
 if(current?.id===next.id)reject('This event is already active.');
 const outgoing=row=>!!current&&row.team_id===teamId&&row.event_key===current.event_key;
 const data=Object.fromEntries(stores.map(store=>[store,rows(db,store).filter(outgoing)]));
 const forms=rows(db,'forms').filter(row=>row.team_id===teamId);
 const fingerprint=createHash('sha256').update(JSON.stringify({teamId,current,next,data,forms})).digest('hex');
 return {fingerprint,current:current?{id:current.id,event_key:current.event_key,event_name:current.event_name}:null,next:{id:next.id,event_key:next.event_key,event_name:next.event_name},counts:{...Object.fromEntries(stores.map(store=>[store,data[store].length])),forms:forms.filter(row=>!row.archived&&!row.archived_at).length},export:structuredClone({schemaVersion:1,event:current,...data,forms})};
}
function applyTransition(db,{teamId,nextEventId,expected,preserveHistory}){
 if(preserveHistory!==true)reject('Update Argus before changing events. Event changes now preserve historical data.',409);
 const previous=rows(db,'teams').find(row=>row.id===teamId)?.event_transition;
 if(previous&&previous.fingerprint===expected&&previous.nextEventId===nextEventId&&previous.preserveHistory)return {team:rows(db,'teams').find(row=>row.id===teamId),event:rows(db,'scout_events').find(row=>row.id===nextEventId),preserved:previous.preserved};
 const preview=previewTransition(db,teamId,nextEventId);
 if(typeof expected!=='string'||expected!==preview.fingerprint)reject('Event data changed. Reload the preview and export again before deleting.');
 const team=rows(db,'teams').find(row=>row.id===teamId);team.active_event_id=nextEventId;team.event_transition={fingerprint:expected,nextEventId,preserveHistory:true,preserved:preview.counts};
 return {team,event:rows(db,'scout_events').find(row=>row.id===nextEventId),preserved:preview.counts};
}
module.exports={activeEvent,previewTransition,applyTransition};
