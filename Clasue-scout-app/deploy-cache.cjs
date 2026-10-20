const fs=require('node:fs');

function configuration(env=process.env) {
  const token=env.CLOUDFLARE_API_TOKEN,zoneId=env.CLOUDFLARE_ZONE_ID,hostname=env.SCOUT_PUBLIC_HOST||'6390scout.app';
  if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token)||!/^[A-Za-z0-9_-]+$/.test(token))throw Error('Configure the private Cloudflare deploy token before deploying.');
  if(!/^[a-f0-9]{32}$/i.test(zoneId||''))throw Error('Configure CLOUDFLARE_ZONE_ID in the private deployment settings.');
  if(!/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/i.test(hostname))throw Error('Configure a valid SCOUT_PUBLIC_HOST.');
  return {token,zoneId,hostname:hostname.toLowerCase()};
}

async function purgeCloudflare({env=process.env,fetcher=fetch}={}) {
  const {token,zoneId,hostname}=configuration(env);
  const endpoint=`https://api.cloudflare.com/client/v4/zones/${zoneId}`;
  async function request(url,options={}) {
    try {
      const response=await fetcher(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw Error();
      const body=await response.json();if(body.success!==true)throw Error();return body.result;
    }catch{throw Error('Cloudflare cache verification/purge failed. Check token permissions and retry deployment.');}
  }
  // A whole-zone purge is allowed only for this app's dedicated zone, not a parent/shared zone.
  const zone=await request(endpoint);
  if(zone?.name?.toLowerCase()!==hostname)throw Error('Cloudflare zone does not match SCOUT_PUBLIC_HOST; refusing a shared-zone purge.');
  await request(`${endpoint}/purge_cache`,{method:'POST',body:JSON.stringify({purge_everything:true})});
  return {purged:true};
}
module.exports={configuration,purgeCloudflare};
if(require.main===module){(async()=>{const envIndex=process.argv.indexOf('--env');if(envIndex!==-1){const filename=process.argv[envIndex+1];if(filename&&fs.existsSync(filename))process.loadEnvFile(filename);}if(process.argv.includes('--check')){configuration();console.log('Private Cloudflare deployment configuration is present.');}else{await purgeCloudflare();console.log('Cloudflare cache purged.');}})().catch(error=>{console.error(error.message);process.exitCode=1;});}
