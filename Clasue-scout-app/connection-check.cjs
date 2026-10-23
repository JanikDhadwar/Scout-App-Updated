// Connection diagnostics never call a generative provider.
async function checkConnections({tbaKey,fetcher=fetch}) {
 let tba={state:'missing',message:'No key saved. Ask the workspace owner to add one.'};
 if(tbaKey)try{
  const response=await fetcher('https://www.thebluealliance.com/api/v3/status',{headers:{'X-TBA-Auth-Key':tbaKey,'User-Agent':'Argus-Scouting'},signal:AbortSignal.timeout(12000)});
  tba=!response.ok?{state:'failed',message:response.status===401||response.status===403?'Key rejected. Update it in connection settings.':response.status===429?'Usage limit reached. Try again later.':'Official data service unavailable. Try again.'}:Number.isInteger((await response.json())?.current_season)?{state:'working',message:'Official data request succeeded.'}:{state:'failed',message:'Unexpected service response.'};
 }catch{tba={state:'failed',message:'Service could not be reached. Check the connection and retry.'};}
 return {tba,groq:{state:'disabled',message:'Replaced by local calculations.'},checkedAt:new Date().toISOString()};
}
module.exports={checkConnections};
