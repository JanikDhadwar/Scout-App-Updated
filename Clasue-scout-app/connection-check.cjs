const {DEFAULT_MODEL}=require('./analyst-service.cjs');

// Diagnostic requests never contain workspace records or return provider response bodies.
async function checkConnections({tbaKey,groqKey,model=DEFAULT_MODEL,fetcher=fetch}) {
  async function probe(provider,key,url,options,valid) {
    if(!key)return {state:'missing',message:'No key saved. Ask the workspace owner to add one.'};
    try {
      const response=await fetcher(url,{...options,signal:AbortSignal.timeout(12000)});
      if(!response.ok)return {state:'failed',message:response.status===401||response.status===403?'Key rejected. Update it in connection settings.':response.status===429?'Usage limit reached. Try again later.':`Service unavailable (HTTP ${response.status}). Try again.`};
      if(!valid(await response.json()))return {state:'failed',message:'Unexpected service response. Try again.'};
      return {state:'working',message:provider==='groq'?'Model answered a test request.':'Official data request succeeded.'};
    }catch{return {state:'failed',message:'Service could not be reached. Check the connection and retry.'};}
  }
  const [tba,groq]=await Promise.all([
    probe('tba',tbaKey,'https://www.thebluealliance.com/api/v3/status',{headers:{'X-TBA-Auth-Key':tbaKey,'User-Agent':'Argus-Scouting/2.0'}},body=>Number.isInteger(body?.current_season)),
    probe('groq',groqKey,'https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${groqKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,max_completion_tokens:128,messages:[{role:'user',content:'Connection test. Reply OK.'}]})},body=>!!body?.choices?.[0]?.message?.content?.trim()),
  ]);
  return {tba,groq,checkedAt:new Date().toISOString()};
}
module.exports={checkConnections};
