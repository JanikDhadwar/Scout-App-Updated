import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
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
 assert.throws(()=>cache.configuration({CLOUDFLARE_ZONE_ID:env.CLOUDFLARE_ZONE_ID}),/Configure/);
});

test('deployment without Cloudflare credentials skips the external purge and passes installer preflight',async()=>{
 assert.equal(cache.configuration({}),null);
 assert.deepEqual(await cache.purgeCloudflare({env:{},fetcher:()=>assert.fail('An unconfigured deployment must not call Cloudflare.')}),{purged:false,reason:'not_configured'});
 const childEnv={...process.env};delete childEnv.CLOUDFLARE_API_TOKEN;delete childEnv.CLOUDFLARE_ZONE_ID;delete childEnv.SCOUT_PUBLIC_HOST;
 for(const args of [['--check'],[]]){
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../../deploy-cache.cjs',import.meta.url)),...args],{env:childEnv,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/skipp/i);
 }
});

test('partially configured or malformed Cloudflare credentials are not silently skipped',()=>{
 assert.throws(()=>cache.configuration({CLOUDFLARE_API_TOKEN:'private-token'}),/ZONE_ID/);
 assert.throws(()=>cache.configuration({CLOUDFLARE_API_TOKEN:'invalid\ntoken',CLOUDFLARE_ZONE_ID:env.CLOUDFLARE_ZONE_ID}),/token/);
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

test('deploy tests and lints the candidate before building or activating it',()=>{
 const script=fs.readFileSync(new URL('../../../deploy.sh',import.meta.url),'utf8');
 const install=script.indexOf('\nnpm ci '),tests=script.indexOf('\nnpm test\n'),lint=script.indexOf('\nnpm run lint:active\n'),build=script.indexOf('\nARGUS_REVISION='),activate=script.indexOf('\nactivate "$release"');
 assert.ok(install>=0&&tests>install&&lint>tests&&build>lint&&activate>build);
 assert.ok(script.includes('set -Eeuo pipefail'));
 assert.ok(script.includes('Clasue-scout-app instructions scripts | tar'),'Candidate includes instruction sources and test helpers.');
 const archive=script.match(/^git archive "\$revision" (.+?) \| tar -x -C "\$release"$/m);
 assert.ok(archive,'Release packaging uses an explicit tracked-file archive.');
 assert.ok(archive[1].split(/\s+/).includes('deploy.sh'),'Candidate must include deploy.sh because deployment regression tests read it from the staged release root.');
});
