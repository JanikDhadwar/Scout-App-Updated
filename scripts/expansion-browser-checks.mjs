import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../Clasue-scout-app/package.json',import.meta.url));
const {chromium}=require('playwright');
const {default:AxeBuilder}=require('@axe-core/playwright');
const baseURL=process.env.QA_BASE_URL;
assert.ok(baseURL&&['127.0.0.1','localhost'].includes(new URL(baseURL).hostname),'An isolated fixture URL is required.');
const artifacts=fs.mkdtempSync(path.join(os.tmpdir(),'argus-expansion-qa-')),results=[],errors=[],timings={},accessibility=[];
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,serviceWorkers:'block'}),page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
const route=async value=>{await page.evaluate(value=>{location.hash=value;},value);await page.waitForTimeout(250);};
const api=async(url,body,method=body?'POST':'GET')=>page.evaluate(async({url,body,method})=>{const r=await fetch('/api'+url,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()};},{url,body,method});
const check=async(name,run)=>{try{await run();results.push({name,status:'passed'});}catch(error){results.push({name,status:'failed',error:error.stack});await page.screenshot({path:path.join(artifacts,`failure-${results.length}.png`),fullPage:true});}};
const shots=async name=>{for(const width of [1440,1280,1024,768,390,360]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} overflow at ${width}`);await page.screenshot({path:path.join(artifacts,`${name}-${width}.png`),fullPage:true});if([1440,390].includes(width)){const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22a','wcag22aa']).analyze();accessibility.push({name,width,violations:audit.violations,incomplete:audit.incomplete});assert.deepEqual(audit.violations,[],`${name} accessibility at ${width}`);}}await page.setViewportSize({width:1440,height:1000});};
try{
 await page.goto(baseURL+'/#/login');await page.getByLabel('Username',{exact:true}).fill('qa_owner');await page.getByLabel('Password',{exact:true}).fill('ArgusQA2026!');await page.locator('.auth-submit').click();await page.locator('.argus-app').waitFor();
 const event=(await api('/scout_events/qa-event')).data;
 await page.route('**/api/tba/**',r=>r.fulfill({json:r.request().url().includes('/matches')?event.matches:{key:event.event_key,name:event.event_name,webcasts:[]}}));
 let outage=false;
 await page.route('**/api/match13/predictions?*',r=>r.fulfill(outage?{status:502,json:{error:'Synthetic provider outage'}}:{json:{event:event.event_key,matches:[{key:'2026qa_qm4',teams:[254,6390,111,1678,2056,222],redScore:100,blueScore:90,redWinProbability:.75}],alliance_snapshot:Object.fromEntries(event.matches.map(match=>[match.key,['red','blue'].map(color=>match.alliances[color].team_keys)])),fetched_at:new Date().toISOString()}}));
 await check('three opponents, evidence links, forecasts and responsive briefing',async()=>{
  await route('/display');await page.evaluate(()=>{document.addEventListener('click',event=>{if(!event.target.closest('a')?.getAttribute('href')?.startsWith('#/matches/2026qa_qm4'))return;const started=performance.now();const observer=new MutationObserver(()=>{if(document.querySelector('.a-opponent-grid')?.children.length===3){observer.disconnect();requestAnimationFrame(()=>{window.__briefingPaintMilliseconds=performance.now()-started;});}});observer.observe(document.body,{childList:true,subtree:true});},{once:true,capture:true});});await page.getByRole('link',{name:'Qual 4',exact:true}).click();
  await page.getByRole('region',{name:'Match intelligence',exact:true}).waitFor();await page.waitForFunction(()=>Number.isFinite(window.__briefingPaintMilliseconds));timings.warmBriefingMilliseconds=Math.round(await page.evaluate(()=>window.__briefingPaintMilliseconds));
  assert.equal(await page.locator('.a-opponent-grid>article').count(),3);assert.deepEqual(await page.locator('.a-opponent-grid>article>h2').allTextContents(),['Team 1678','Team 2056','Team 222']);
  await page.getByText('75% alliance win chance',{exact:true}).waitFor();await page.getByText('Performance, confidence, and sources',{exact:true}).first().click();await shots('match-intelligence');
  outage=true;await page.getByRole('button',{name:'Refresh predictions',exact:true}).click();await page.getByRole('status').filter({hasText:'Cached estimate'}).waitFor();assert.equal(await page.getByText('75% alliance win chance',{exact:true}).count(),1);
 });
 await check('Present All ordering, snapshots and combined downloads',async()=>{
  await route('/teams');await page.getByRole('button',{name:'Present All',exact:true}).click();await page.getByRole('heading',{name:'Present All',exact:true}).waitFor();
  for(let step=0;step<3;step++)await page.getByRole('button',{name:'Move team 1678 up',exact:true}).click();
  const presentationStart=performance.now();await page.getByRole('button',{name:'Start presentation',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();timings.firstPresentationMilliseconds=Math.round(performance.now()-presentationStart);assert.equal(await dialog.getByRole('combobox',{name:'Team',exact:true}).inputValue(),'1678');
  await shots('present-all');await dialog.getByRole('button',{name:'Next',exact:true}).focus();await page.keyboard.press('ArrowRight');await page.getByRole('status').filter({hasText:'Section 2 of'}).waitFor();
  let cancelledDownload=false;const cancelledHandler=()=>{cancelledDownload=true;};page.on('download',cancelledHandler);
  const workerDelay=async route=>{await new Promise(resolve=>setTimeout(resolve,500));await route.continue();};await page.route('**/assets/presentation-export.worker-*.js',workerDelay);
  for(const label of ['Export PDF','Export PowerPoint']){await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('button',{name:'Cancel export',exact:true}).click();await page.getByRole('alert').filter({hasText:'Export cancelled'}).waitFor();await page.waitForTimeout(700);assert.equal(cancelledDownload,false,`${label} cancellation must not download a late file`);}page.off('download',cancelledHandler);await page.unroute('**/assets/presentation-export.worker-*.js',workerDelay);
  for(const [label,extension] of [['Export PDF','pdf'],['Export PowerPoint','pptx']]){const [file]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:label,exact:true}).click()]);const destination=path.join(artifacts,`all-teams.${extension}`);await file.saveAs(destination);assert.ok(fs.statSync(destination).size>1000);}
  const pdf=fs.readFileSync(path.join(artifacts,'all-teams.pdf')).toString('latin1');assert.ok(pdf.indexOf('Team 1678')<pdf.indexOf('Team 111'));assert.ok(!pdf.includes('qa_owner'));assert.ok(!pdf.includes('Autonomous zero observed'));
  const list=(await api('/picklists/qa-picklist')).data;assert.equal((await api('/picklists/qa-picklist',{name:list.name,entries:[...list.entries].reverse(),revision:list.revision},'PATCH')).status,200);
  await page.getByRole('button',{name:'New data available — refresh',exact:true}).waitFor({timeout:15000});await page.getByRole('button',{name:'New data available — refresh',exact:true}).click();
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 });
 await check('template preview, copy, guidance and final review are additive',async()=>{
  const before=(await api('/forms')).data;await route('/pit');await page.getByRole('button',{name:'Use a template',exact:true}).click();await page.getByRole('button',{name:'Preview Beginner pit',exact:true}).click();await shots('template-preview');
  await page.getByRole('button',{name:'Copy template and edit',exact:true}).click();assert.equal(await page.getByLabel('Scouting guidance',{exact:true}).inputValue(),'guided');await page.getByLabel('Form title',{exact:true}).fill('QA copied beginner pit');await page.getByRole('button',{name:'Save form',exact:true}).click();
  await page.waitForFunction(async n=>(await(await fetch('/api/forms')).json()).length===n+1,before.length);
  const forms=(await api('/forms')).data,copy=forms.find(form=>form.title==='QA copied beginner pit');assert.equal(copy.template_origin.id,'beginner-pit');assert.ok(before.every(form=>forms.some(after=>after.id===form.id&&after.questions.length===form.questions.length)));
  await route(`/pit?form_id=${copy.id}&event_key=2026qa`);await page.getByRole('region',{name:'Final scouting review'}).waitFor();
  assert.ok(await page.evaluate(()=>{const cards=[...document.querySelectorAll('.question-card')],review=document.querySelector('[aria-label="Final scouting review"]');return !!(cards.at(-1).compareDocumentPosition(review)&Node.DOCUMENT_POSITION_FOLLOWING);}));await shots('guided-form');
 });
 await check('illustrated private training and architecture-free Help',async()=>{
  await route('/practice');await page.getByText('Observe a match',{exact:true}).click();const fields=page.locator('fieldset');await fields.filter({has:page.getByText('Autonomous outcome',{exact:true})}).getByLabel('Failed',{exact:true}).check();await page.getByRole('button',{name:'Check observations',exact:true}).first().click();await page.getByRole('region',{name:'Private practice feedback'}).waitFor();await shots('guided-practice');
  await route('/help');await page.getByLabel('Search instructions',{exact:true}).fill('internal architecture');assert.equal(await page.getByRole('link',{name:'Internal architecture',exact:true}).count(),0);await page.getByLabel('Search instructions',{exact:true}).fill('');await shots('help');
 });
 assert.deepEqual(errors,[]);
}finally{await browser.close();fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify({results,errors,timings,accessibility},null,2));console.log(JSON.stringify({artifacts,results,errors,timings,accessibilityStates:accessibility.length},null,2));}
if(results.some(result=>result.status==='failed')||errors.length)process.exitCode=1;
