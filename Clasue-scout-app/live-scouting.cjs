const {createHmac,randomBytes}=require('node:crypto');
const {activeEvent}=require('./event-transition.cjs');
const rows=(db,name)=>db[name]||[];
function createRevision(){
 const secret=randomBytes(32);
 return (db,teamId)=>{
  const stores=['forms','submissions','scout_events','memberships','announcements','pit_scouts','assignments','picklists','team_allocations','submission_states','report_tombstones'];
  const data=Object.fromEntries(stores.map(name=>[name,rows(db,name).filter(row=>row.team_id===teamId)]));
  data.teams=rows(db,'teams').filter(row=>row.id===teamId);
  const ids=new Set(data.memberships.map(row=>row.user_id));data.users=rows(db,'users').filter(u=>ids.has(u.id)).map(u=>({id:u.id,username:u.username,disabled:!!(u.disabled||u.disabled_at)}));
  // HMAC prevents dictionary attacks against lower-privilege scouts' opaque
  // change tokens. Neither the serialized input nor the key leaves the server.
  return createHmac('sha256',secret).update(JSON.stringify(data)).digest('hex');
 };
}
function createMatchRefresh({readDB,writeDB,fetchMatches,now=Date.now}){
 const cache=new Map();
 return function refresh(eventId,key){
  const previous=cache.get(eventId);if(previous&&(previous.pending||now()-previous.time<30000))return previous.promise;
  if(cache.size>=200){const old=[...cache].find(([,v])=>!v.pending);if(old)cache.delete(old[0]);else return Promise.resolve({status:'unavailable',message:'Official updates are busy. Keeping the downloaded schedule.'});}
  const entry={pending:true,time:now()};
  entry.promise=(async()=>{
   try{
    const original=rows(readDB(),'scout_events').find(e=>e.id===eventId);
    if(!original||!key||activeEvent(readDB(),original.team_id)?.id!==eventId)throw Error('Not available');
    const matches=await fetchMatches(original.event_key,key);
    if(!Array.isArray(matches)||matches.some(m=>!m||typeof m.key!=='string'||m.event_key&&m.event_key!==original.event_key))throw Error('Unexpected schedule');
    const db=readDB(),current=rows(db,'scout_events').find(e=>e.id===eventId);
    if(!current||current.event_key!==original.event_key||activeEvent(db,current.team_id)?.id!==eventId)throw Error('Event changed');
    if(!matches.length&&current.matches?.length)throw Error('The official schedule is temporarily empty');
    const combined=new Map((current.matches||[]).map(m=>[m.key,m]));
    for(const match of matches){const old=combined.get(match.key);combined.set(match.key,{...old,...match,alliances:{...old?.alliances,...match.alliances,...Object.fromEntries(['red','blue'].filter(color=>match.alliances?.[color]).map(color=>[color,{...old?.alliances?.[color],...match.alliances[color]}]))}});}
    const next=matches.map(match=>combined.get(match.key)),changed=JSON.stringify(next)!==JSON.stringify(current.matches||[]),fetched_at=new Date(now()).toISOString();
    if(changed){current.matches=next;current.official_fetched_at=fetched_at;writeDB(db);}
    return {status:'live',fetched_at};
   }catch{return {status:'unavailable',message:'Official updates are unavailable. Keeping the downloaded schedule.'};}
   finally{entry.pending=false;}
  })();cache.set(eventId,entry);return entry.promise;
 };
}
module.exports={createRevision,createMatchRefresh};
