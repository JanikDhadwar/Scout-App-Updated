const {createHash}=require('node:crypto');
const {normalizeMatch13Team,normalizeMatch13Prediction,match13RegionalRanks}=require('./src/argus/analytics.js');
function createMatch13Client({fetcher=fetch,clock=Date.now}={}){
 const cache=new Map(),pending=new Map(),cooldown=new Map();
 const invalid=()=>{const e=new Error('Choose a valid team, season or event.');e.status=400;throw e;};
 const yearOk=year=>/^\d{4}$/.test(String(year))&&Number(year)>=2002&&Number(year)<=new Date(clock()).getUTCFullYear();
 const teamOk=team=>/^[1-9]\d{0,5}$/.test(String(team));
 async function read(path,key,ttl=600000,tba=false){
  if(!key){const e=new Error(`The team owner can add the ${tba?'Blue Alliance':'Match13'} API key in Settings → Connection settings.`);e.status=503;throw e;}
  const identity=createHash('sha256').update(key).digest('hex'),id=`${tba}:${identity}:${path}`;
  if(cache.get(id)?.until>clock())return cache.get(id).data;if(pending.has(id))return pending.get(id);
  if(cooldown.get(identity)>clock()){const e=new Error('Match13 usage limit reached. Try again later.');e.status=429;throw e;}
  const task=(async()=>{
   let response;try{response=await fetcher(`${tba?'https://www.thebluealliance.com/api/v3':'https://actions.match13.com/v1'}/${path}`,{headers:tba?{'X-TBA-Auth-Key':key}:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000),redirect:'error'});}catch{throw new Error('The ratings service could not be reached. Try again later.');}
   if(!response.ok){const e=new Error(response.status===401||response.status===403?'The saved API key was rejected. Ask the owner to update it in Settings.':response.status===404?'No Match13 data is available for this team, season or event.':response.status===429?'Match13 usage limit reached. Try again later.':'Match13 is temporarily unavailable.');e.status=response.status===404?404:response.status===429?429:502;
    if(response.status===429)cooldown.set(identity,clock()+Math.min(3600,Math.max(60,Number(response.headers?.get('retry-after'))||60))*1000);throw e;}
   let data;try{data=await response.json();}catch{throw new Error('The ratings service returned an unexpected format.');}
   if(cache.size>=300)cache.delete(cache.keys().next().value);cache.set(id,{data,until:clock()+ttl});return data;
  })();pending.set(id,task);try{return await task;}finally{pending.delete(id);}
 }
 async function rating(team,year,key){if(!teamOk(team)||!yearOk(year))invalid();const row=normalizeMatch13Team(await read(`teams/${team}/years/${year}?scope=all`,key));if(!row||row.team!==Number(team)||row.year!==Number(year))throw new Error('Match13 returned an unexpected format.');return row;}
 async function rankings({year,offset='0',team},key){
  if(!yearOk(year)||!/^\d{1,5}$/.test(String(offset))||Number(offset)>10000||(team!==undefined&&!teamOk(team)))invalid();
  const page=Math.floor(Number(offset)/50)+1;
  const raw=await read(`years/${year}/teams?scope=all&page=${page}&limit=50`,key);
  if(!Array.isArray(raw?.teams)||raw.teams.length>50||raw.year!==Number(year))throw new Error('Match13 returned an unexpected format.');
  const rows=team?[await rating(team,year,key)]:raw.teams.map(normalizeMatch13Team);if(rows.some(r=>!r||r.year!==Number(year)))throw new Error('Match13 returned an unexpected format.');
  return {source:'Match13',year:Number(year),offset:team?0:Number(offset),total:Number.isInteger(raw.total)?raw.total:null,rows,fetched_at:new Date(clock()).toISOString(),has_more:!team&&raw.nextPage!=null};
 }
 async function predictions(event,key){
  if(typeof event!=='string'||!/^\d{4}[a-z0-9_-]{1,30}$/.test(event)||!yearOk(event.slice(0,4)))invalid();
  const raw=await read(`events/${event}/matches?scope=all`,key,120000);
  if(raw?.eventKey!==event||!Array.isArray(raw.matches)||raw.matches.length>1000)throw new Error('Match13 returned an unexpected format.');
  const matches=raw.matches.map(normalizeMatch13Prediction);if(matches.some(m=>!m||!m.key.startsWith(`${event}_`)))throw new Error('Match13 returned an unexpected format.');
  return {event,matches,fetched_at:new Date(clock()).toISOString(),source:'Match13'};
 }
 async function regions(team,year,key,tbaKey){
  if(!teamOk(team)||!yearOk(year))invalid();let ratings=[],total=null;const deadline=clock()+30000;
  const checkTime=()=>{if(clock()>deadline)throw new Error('Regional rankings took too long. Try refreshing again.');};
  for(let page=1;page<=10;page++){checkTime();const raw=await read(`years/${year}/teams?scope=all&page=${page}&limit=1000`,key,3600000);if(!Array.isArray(raw?.teams)||raw.teams.length>1000||raw.year!==Number(year))throw new Error('Match13 returned an unexpected format.');if(page===1&&Number.isInteger(raw.total))total=raw.total;ratings.push(...raw.teams.map(normalizeMatch13Team));if(raw.nextPage==null)break;if(page===10)throw new Error('The full global ranking could not be loaded.');}
  if(total!=null&&total!==ratings.length)throw new Error('The full global ranking could not be loaded.');
  if(ratings.some(r=>!r||r.year!==Number(year))||new Set(ratings.map(r=>r.team)).size!==ratings.length)throw new Error('Match13 returned an unexpected format.');
  let metadata=[],districtTeams=[],districtName='District';
  if(tbaKey){
   for(let page=0;page<30;page++){checkTime();const rows=await read(`teams/${year}/${page}/simple`,tbaKey,86400000,true);if(!Array.isArray(rows)||rows.length>500)throw new Error('Official team locations are unavailable.');metadata.push(...rows);if(rows.length<500)break;}
   const events=await read(`team/frc${team}/events/${year}/simple`,tbaKey,86400000,true);const district=Array.isArray(events)?events.find(e=>e.district?.key)?.district:null;
   if(district&&/^\d{4}[a-z]{2,6}$/.test(district.key)){const members=await read(`district/${district.key}/teams/simple`,tbaKey,86400000,true);if(Array.isArray(members)){districtTeams=members.map(t=>t.team_number);districtName=district.display_name||'District';}}
  }
  return {...match13RegionalRanks(ratings,metadata,team,districtTeams,districtName),source:'Match13 ratings / TBA locations',fetched_at:new Date(clock()).toISOString()};
 }
 return {rating,rankings,predictions,regions};
}
module.exports={createMatch13Client};
