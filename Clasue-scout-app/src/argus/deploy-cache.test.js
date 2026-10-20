import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import cache from '../../deploy-cache.cjs';
const env={CLOUDFLARE_API_TOKEN:'private-token',CLOUDFLARE_ZONE_ID:'a'.repeat(32),SCOUT_PUBLIC_HOST:'6390scout.app'};
test('deployment purge verifies the dedicated zone and purges all edge content without disclosing credentials',async()=>{
 const calls=[];
 const result=await cache.purgeCloudflare({env,fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({success:true,result:url.endsWith('/purge_cache')?{id:'receipt'}:{name:'6390scout.app'}})};}});
 assert.equal(result.purged,true);assert.equal(calls.length,2);assert.equal(calls[1].options.method,'POST');assert.deepEqual(JSON.parse(calls[1].options.body),{purge_everything:true});assert.ok(!JSON.stringify(result).includes(env.CLOUDFLARE_API_TOKEN));
 let purged=false;
 await assert.rejects(cache.purgeCloudflare({env,fetcher:async(url)=>{if(url.endsWith('/purge_cache'))purged=true;return {ok:true,json:async()=>({success:true,result:{name:'shared-parent.app'}})};}}),/refusing/);assert.equal(purged,false);
 await assert.rejects(cache.purgeCloudflare({env,fetcher:async()=>{throw Error('private-token');}}),error=>!error.message.includes('private-token'));
 await assert.rejects(cache.purgeCloudflare({env,fetcher:async()=>({ok:true,json:async()=>({success:false,errors:['private-token']})})}),/failed/);
 assert.throws(()=>cache.configuration({}),/Configure/);
});
test('deploy only completes after healthy activation and edge purge, with explicit cache-failure retry',()=>{
 const script=fs.readFileSync(new URL('../../../deploy.sh',import.meta.url),'utf8');
 assert.ok(script.includes('stage=cache_config'));assert.ok(script.includes('stage=cache_purge'));assert.ok(script.includes('activated-revision'));
 assert.ok(script.includes('ARGUS_REVISION="$revision" npm run build'));
 const finish=script.slice(script.indexOf('finish_cache()'),script.indexOf('# A failed edge purge'));
 assert.ok(finish.indexOf('deploy-cache.cjs')<finish.indexOf('deployed-revision'));
 assert.ok(script.includes('if healthy; then finish_cache; exit 0; fi'));
 const active=script.slice(script.indexOf('if sudo -n'));
 assert.ok(active.indexOf('activated-revision')<active.indexOf('finish_cache'));
});
