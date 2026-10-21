const {normalizeStatboticsTeam}=require('./src/argus/analytics.js');

function createStatboticsClient({fetcher=fetch,clock=Date.now}={}){
 const cache=new Map(),pending=new Map();
 async function rankings({year,offset='0',team}={}){
  if(!/^\d{4}$/.test(String(year))||Number(year)<2002||Number(year)>new Date(clock()).getUTCFullYear()||!/^\d{1,5}$/.test(String(offset))||Number(offset)>10000||(team!==undefined&&!/^[1-9]\d{0,5}$/.test(String(team)))){
   const error=new Error('Choose a valid season, team number and page.');error.status=400;throw error;
  }
  const path=team?`team_year/${team}/${year}`:`team_years?year=${year}&metric=epa&ascending=false&limit=50&offset=${Number(offset)}`;
  const stored=cache.get(path);if(stored?.until>clock())return stored.data;
  if(pending.has(path))return pending.get(path);
  const task=(async()=>{
   const response=await fetcher(`https://api.statbotics.io/v3/${path}`,{signal:AbortSignal.timeout(8000),redirect:'error',headers:{'User-Agent':'Argus-Scouting','Accept':'application/json'}});
   if(!response.ok){const error=new Error(response.status===404?'No Statbotics rating found for this team and season.':'Statbotics is temporarily unavailable. Try again later.');error.status=response.status===404?404:502;throw error;}
   const raw=await response.json(),list=team?[raw]:raw;
   if(!Array.isArray(list)||list.length>50)throw new Error('Statbotics returned an unexpected format.');
   const rows=list.map(normalizeStatboticsTeam);
   if(rows.some(row=>!row||row.year!==Number(year)||(team&&row.team!==Number(team))))throw new Error('Statbotics returned an unexpected format.');
   const data={source:'Statbotics',year:Number(year),offset:team?0:Number(offset),rows,fetched_at:new Date(clock()).toISOString(),has_more:!team&&rows.length===50};
   if(cache.size>=200)cache.delete(cache.keys().next().value);
   cache.set(path,{data,until:clock()+120000});return data;
  })();
  pending.set(path,task);try{return await task;}finally{pending.delete(path);}
 }
 return {rankings};
}
module.exports={createStatboticsClient};
