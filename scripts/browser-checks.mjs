import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../Clasue-scout-app/package.json', import.meta.url));
const { chromium } = require('playwright');
const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:4173';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(baseURL).hostname),'Use a local fixture server only.');
const artifacts = process.env.QA_ARTIFACT_DIR || fs.mkdtempSync(path.join(os.tmpdir(),'argus-browser-qa-'));
fs.mkdirSync(artifacts,{recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true,...(process.env.EDGE_EXECUTABLE?{executablePath:process.env.EDGE_EXECUTABLE}:{})});
const context = await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,serviceWorkers:'allow'});
const page = await context.newPage(); page.setDefaultTimeout(12000);
const results=[],errors=[];
page.on('pageerror',error=>errors.push(error.message));
const route=async(destination,target=page)=>{await target.evaluate(value=>{location.hash=value;},destination);await target.waitForTimeout(200);};
const api=(target,url,method='GET',body)=>target.evaluate(async({url,method,body})=>{const r=await fetch(`/api${url}`,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()};},{url,method,body});
const login=async(target,username)=>{await target.goto(`${baseURL}/#/login`,{waitUntil:'networkidle'});await target.getByLabel('Username',{exact:true}).fill(username);await target.getByLabel('Password',{exact:true}).fill('ArgusQA2026!');await target.locator('.auth-submit').click();await target.locator('.argus-app').waitFor();};
const check=async(name,run)=>{try{await run();results.push({name,status:'passed'});}catch(error){results.push({name,status:'failed',error:error.message});await page.screenshot({path:path.join(artifacts,`failure-${results.length}.png`),fullPage:true}).catch(()=>{});}finally{await context.setOffline(false);await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close())).catch(()=>{});console.log(JSON.stringify(results.at(-1)));}};
const widths=[1440,1280,1024,768,390,360];
try {
 await check('public welcome, account entry and offline public reload',async()=>{
  await page.goto(baseURL,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'Your team’s scouting, from the stands to alliance selection.',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Username',{exact:true}).count(),0);
  await page.getByRole('heading',{name:'Built by the Flusters',exact:true}).waitFor();
  for(const width of widths){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(artifacts,`welcome-${width}.png`),fullPage:true});}
  await page.getByRole('link',{name:'Start now',exact:true}).first().click();
  await page.getByRole('heading',{name:'Create an account',exact:true}).waitFor();
  await page.getByRole('link',{name:'About Argus',exact:true}).click();
  await page.getByRole('link',{name:'Log in',exact:true}).first().click();
  await page.getByRole('heading',{name:'Sign in',exact:true}).waitFor();
  await page.goBack();await page.locator('.argus-public').waitFor();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.locator('.argus-public').waitFor();
  await context.setOffline(false);await page.setViewportSize({width:1440,height:1000});
 });
 await login(page,'qa_owner');
 if(process.env.QA_NODE_ENV==='production'){
  const session=(await context.cookies()).find(cookie=>cookie.name==='argus_session');assert.ok(session?.secure&&session.httpOnly&&session.sameSite==='Strict','Production sessions require Secure, HttpOnly and SameSite=Strict.');
 }
 const teams=await api(page,'/teams');assert.ok(teams.data.some(t=>t.id==='qa-workspace'&&t.name==='QA robotics'),'Synthetic fixture required.');
 await check('role-aware onboarding, replay, main routes and no topbar event switch',async()=>{
  await route('/dashboard');await page.getByRole('region',{name:'Welcome guide'}).waitFor();await page.getByRole('button',{name:'Skip guide',exact:true}).click();
  for(const destination of ['assignments','admin','practice','help','analyst','teams','matches','analytics','strategy','events','settings']){await route(`/${destination}`);await page.locator('#workspace-main h1,#workspace-main h2').first().waitFor();}
  assert.equal(await page.locator('.a-topbar a[href="#/events"]').count(),0);
  await route('/help');await page.getByRole('button',{name:'Replay welcome guide',exact:true}).click();await page.getByRole('region',{name:'Welcome guide'}).waitFor();await page.getByRole('button',{name:'Skip guide',exact:true}).click();
 });
 await check('Match13 rankings show sourced values, team lookup, pagination and service errors',async()=>{
  let mode='success';
  const intercept=async request=>{
   if(mode==='error')return request.fulfill({status:502,json:{error:'Match13 is temporarily unavailable. Try again later.'}});
   const query=new URL(request.request().url()).searchParams,offset=Number(query.get('offset')||0),team=Number(query.get('team')||254);
   await request.fulfill({json:{source:'Match13',year:2026,offset,total:4000,fetched_at:'2026-10-20T12:00:00Z',has_more:!query.has('team')&&offset===0,rows:[{team,year:2026,xp:0,auto:0,teleop:0,endgame:0,rank:offset+3,total:4000,matches:null,wins:0,losses:0,ties:0}]}});
  };
  await page.route('**/api/match13/rankings?*',intercept);
  try{
   await route('/teams');await page.locator('summary').filter({hasText:/^Global rankings$/}).click();
   const panel=page.getByRole('region',{name:'Match13 global rankings',exact:true});
   await panel.getByRole('button',{name:'Load global rankings',exact:true}).click();
   await panel.getByRole('region',{name:'Global XP rankings',exact:true}).waitFor();assert.match(await panel.innerText(),/3 \/ 4000/);
   for(const width of widths){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(artifacts,`global-rankings-${width}.png`),fullPage:true});}
   await panel.getByRole('button',{name:'Next 50',exact:true}).click();await panel.getByText('53 / 4000',{exact:true}).waitFor();
   await panel.getByLabel('Team number (optional)',{exact:true}).fill('6390');await panel.getByRole('button',{name:'Load global rankings',exact:true}).click();await panel.getByRole('link',{name:'Team 6390',exact:true}).waitFor();assert.equal(await panel.getByRole('button',{name:'Next 50',exact:true}).count(),0);
   mode='error';await panel.getByRole('button',{name:'Load global rankings',exact:true}).click();await panel.getByRole('alert').filter({hasText:'Match13 is temporarily unavailable'}).waitFor();assert.equal(await panel.getByRole('table').count(),0);
  }finally{await page.unroute('**/api/match13/rankings?*',intercept);await page.setViewportSize({width:1440,height:1000});}
 });
 await check('Match13 profile components, geographic ranks and pit predictions include offseason and handle outages',async()=>{
  let outage=false;
  const rating=async r=>{const q=new URL(r.request().url()).searchParams;await r.fulfill({json:{rating:{team:Number(q.get('team')),year:2026,xp:203.2,auto:40.3,teleop:162.2,endgame:0.7,rank:58},fetched_at:'2026-10-21T12:00:00Z'}});};
  const regions=r=>r.fulfill({json:{complete:true,world:{name:'World',rank:58,total:3708},country:{name:'USA',rank:44,total:2934},district:{name:'Pacific Northwest',rank:5,total:126},state:{name:'Washington',rank:5,total:86}}});
  const predictions=r=>r.fulfill(outage?{status:502,json:{error:'Match13 is temporarily unavailable.'}}:{json:{event:'2026qa',matches:[{key:'2026qa_qm4',teams:[254,6390,1678,2056],redScore:100,blueScore:90,redWinProbability:0.75}],fetched_at:'2026-10-21T12:00:00Z'}});
  await page.route('**/api/match13/rating?*',rating);await page.route('**/api/match13/regions?*',regions);await page.route('**/api/match13/predictions?*',predictions);
  try{
   await route('/teams/254');const profile=page.getByRole('region',{name:'Match13 ratings for team 254',exact:true});await profile.getByText('203.2',{exact:true}).waitFor();await profile.getByText('#44 / 2934',{exact:true}).waitFor();assert.match(await profile.innerText(),/Includes offseason/);
   for(const width of widths){await page.setViewportSize({width,height:1000});await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(artifacts,'match13-profile-'+width+'.png'),fullPage:true});}
   await route('/display');await page.getByText('75% alliance win chance',{exact:true}).waitFor();await page.getByText('Red: 100',{exact:true}).waitFor();await page.getByText('Blue: 90',{exact:true}).waitFor();
   for(const width of widths){await page.setViewportSize({width,height:1000});await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(artifacts,'match13-pit-'+width+'.png'),fullPage:true});}
   outage=true;await page.getByRole('button',{name:'Refresh predictions',exact:true}).click();await page.getByRole('status').filter({hasText:'Match13 is temporarily unavailable.'}).waitFor();assert.equal(await page.getByText('75% alliance win chance',{exact:true}).count(),0);await page.getByRole('region',{name:'Team upcoming matches',exact:true}).waitFor();
  }finally{await page.unroute('**/api/match13/rating?*',rating);await page.unroute('**/api/match13/regions?*',regions);await page.unroute('**/api/match13/predictions?*',predictions);await page.setViewportSize({width:1440,height:1000});}
 });
 await check('compact phone navigation retains tools, disclosures and modal keyboard access',async()=>{
  await page.setViewportSize({width:390,height:844});await route('/dashboard');
  assert.equal(await page.locator('.a-sidebar nav a').count(),5);
  for(const route of ['assignments','analyst','practice','help','history','reminders','admin'])assert.equal(await page.locator(`.a-sidebar nav a[href="#/${route}"]`).count(),0);
  const summary=page.locator('.a-compact-details').filter({has:page.locator(':scope > summary').filter({hasText:'Event summary'})});
  assert.equal(await summary.getAttribute('open'),null);await summary.locator(':scope > summary').click();assert.ok(await summary.locator('.a-scoreboard').isVisible());await summary.locator(':scope > summary').click();
  const observations=page.locator('.a-compact-details').filter({has:page.locator(':scope > summary').filter({hasText:'Scouting observations'})});assert.equal(await observations.getAttribute('open'),null);
  await page.screenshot({path:path.join(artifacts,'compact-home-390.png'),fullPage:true});
  await page.getByRole('button',{name:'More',exact:true}).click();const more=page.getByRole('dialog',{name:'More',exact:true});await more.waitFor();
  await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>!!document.activeElement.closest('#mobile-more')));
  await more.getByText('Analysis tools',{exact:true}).click();await more.getByRole('link',{name:'Scouting analyst',exact:true}).click();await more.waitFor({state:'hidden'});await page.getByRole('heading',{name:'Scouting analyst',exact:true}).waitFor();
  const tools=page.locator('.a-page-tools');assert.equal(await tools.getAttribute('open'),null);await tools.locator(':scope > summary').click();await page.getByRole('navigation',{name:'Section tools'}).getByRole('link',{name:'Analytics',exact:true}).click();
  await page.getByRole('button',{name:'More',exact:true}).click();await page.keyboard.press('Escape');await more.waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('.a-mobile-nav button[aria-controls="mobile-more"]').getAttribute('aria-expanded')==='false');
  await page.getByRole('button',{name:'More',exact:true}).click();await page.setViewportSize({width:1280,height:1000});await more.waitFor({state:'hidden'});
  await route('/dashboard');assert.ok(await page.locator('.a-scoreboard').isVisible());
 });
 await check('sidebar preference and keyboard search',async()=>{
  await page.setViewportSize({width:1280,height:700});await page.getByRole('button',{name:'Hide menu',exact:true}).click();await page.reload({waitUntil:'networkidle'});assert.ok(await page.locator('.a-sidebar').isHidden());await page.getByRole('button',{name:'Show menu',exact:true}).click();
  await page.keyboard.press('Control+k');const dialog=page.getByRole('dialog');await dialog.getByRole('combobox').fill('254');await dialog.getByRole('option').first().waitFor();await page.keyboard.press('Enter');await dialog.waitFor({state:'hidden'});
 });
 await check('team profiles, comparisons and local analyst fallback',async()=>{
  await route('/teams/254');for(const tab of await page.getByRole('tab').all()){await tab.click();assert.equal(await tab.getAttribute('aria-selected'),'true');}
  for(const value of ['254,1678','254,1678,2056,6390']){await route(`/compare?teams=${value}`);await page.getByRole('region',{name:'Team comparison statistics'}).waitFor();}
  await route('/analyst');await page.getByRole('button',{name:'Summarize team 254',exact:true}).click();await page.getByText('Verified local calculation',{exact:true}).waitFor();await page.getByLabel('Ask a follow-up question',{exact:true}).fill('Predict the champion');await page.getByRole('button',{name:'Ask locally',exact:true}).click();await page.getByText('Insufficient information',{exact:true}).waitFor();
 });
 await check('picklist reorder, persistent unsaved edits, saved revisions and real exports',async()=>{
  await route('/strategy');await page.getByLabel('Saved picklist').selectOption('qa-picklist');await page.getByRole('button',{name:'Move team 1678 up',exact:true}).click();await page.getByRole('button',{name:'Save picklist',exact:true}).click();await page.getByText('Picklist saved on the server.',{exact:true}).waitFor();
  await page.waitForFunction(async()=>{const r=await(await fetch('/api/picklists/qa-picklist')).json();return r.entries[0].team_number===1678;});
  const note=`Unsaved note ${Date.now()}`;await page.getByLabel('Team 254 strategy notes',{exact:true}).fill(note);await route('/dashboard');await route('/strategy');assert.equal(await page.getByLabel('Team 254 strategy notes',{exact:true}).inputValue(),note);
  await page.getByRole('button',{name:'Save picklist',exact:true}).click();await page.getByText('Picklist saved on the server.',{exact:true}).waitFor();
  await route('/present/254');await page.getByRole('button',{name:'Next',exact:true}).waitFor();await page.keyboard.press('ArrowRight');await page.getByRole('status').filter({hasText:'Section 2 of 7'}).waitFor();
  for(const [label,extension] of [['Export PDF','pdf'],['Export PowerPoint','pptx']]){const [file]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:label,exact:true}).click()]);await file.saveAs(path.join(artifacts,`team-254.${extension}`));assert.ok(fs.statSync(path.join(artifacts,`team-254.${extension}`)).size>1000);}
  await page.keyboard.press('Escape');
 });
 await check('season-independent alliance sheet generates a separate persistent picklist without AI',async()=>{
  const requests=[];const capture=request=>{if(/groq|\/analyst\//i.test(request.url()))requests.push(request.url());};page.on('request',capture);
  try{
   await route('/analytics');await page.getByLabel('Alliance role for Autonomous pieces',{exact:true}).selectOption('scoring');await page.getByRole('button',{name:'Save metric definitions',exact:true}).click();
   await page.waitForFunction(async()=>{const row=await(await fetch('/api/scout_events/qa-event')).json();return row.analytics_config['qa-match-form:auto'].category==='scoring';});
   await route('/strategy');const sheet=page.getByRole('region',{name:'Scoring selection sheet',exact:true});await sheet.waitFor();assert.equal(await sheet.locator('tbody tr').first().locator('th').innerText(),'1678');assert.ok((await sheet.innerText()).includes('Small sample'));assert.ok(!(await sheet.locator('tbody').innerText()).includes('6390'));
   for(const width of widths){await page.setViewportSize({width,height:1000});await page.screenshot({path:path.join(artifacts,`alliance-sheet-${width}.png`),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
   await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Create scoring picklist',exact:true}).click();await page.getByRole('button',{name:'Save picklist',exact:true}).click();await page.getByText('Picklist saved on the server.',{exact:true}).waitFor();
   const lists=(await api(page,'/picklists')).data;const generated=lists.find(l=>l.name==='Scoring selection');assert.ok(generated);assert.equal(generated.entries[0].team_number,1678);assert.ok(lists.some(l=>l.id==='qa-picklist'));
   await route('/dashboard');await route('/strategy');await page.getByLabel('Saved picklist').selectOption(generated.id);assert.equal(await page.getByLabel('Picklist name',{exact:true}).inputValue(),'Scoring selection');
   await route('/analyst');await page.getByRole('button',{name:'Summarize team 254',exact:true}).click();await page.getByText('Verified local calculation',{exact:true}).waitFor();assert.deepEqual(requests,[]);
  }finally{page.off('request',capture);}
 });
 await check('one-match handoff acceptance preserves permanent owners and other matches',async()=>{
  const receiverContext=await browser.newContext({viewport:{width:390,height:1000},serviceWorkers:'allow'}),receiver=await receiverContext.newPage();
  try{await login(receiver,'qa_idle');await api(receiver,'/handoffs?team_id=qa-workspace');await api(page,'/handoffs?team_id=qa-workspace');await route('/matches/2026qa_qm4');
   await page.getByRole('button',{name:'Handoff team 254',exact:true}).click();const offer=page.getByRole('dialog',{name:'Handoff team 254',exact:true});await offer.getByRole('combobox').selectOption('qa-idle');await offer.getByRole('button',{name:'Send handoff request',exact:true}).click();await offer.waitFor({state:'hidden'});
   await receiver.getByRole('button',{name:'Accept team 254',exact:true}).waitFor();await receiver.getByRole('button',{name:'Accept team 254',exact:true}).click();await receiver.getByText('Recent handoffs',{exact:true}).click();await receiver.getByRole('button',{name:'Open assigned match',exact:true}).click();
   const current=(await api(page,'/handoffs/context?team_id=qa-workspace&event_id=qa-event&match_key=2026qa_qm4')).data;
   assert.deepEqual(current.mine.map(r=>r.teamNumber),['6390']);
   const other=(await api(page,'/handoffs/context?team_id=qa-workspace&event_id=qa-event&match_key=2026qa_qm3')).data;assert.equal(other.mine.length,2);
   assert.equal((await api(page,'/team_allocations')).data.find(a=>a.team_number===254).owner_user_id,'qa-owner');
   await receiver.screenshot({path:path.join(artifacts,'accepted-handoff-390.png'),fullPage:true});
  }finally{await receiverContext.close();}
 });
 await check('autosaved real draft survives offline reload and synchronizes once',async()=>{
  await route('/sync');await page.getByRole('button',{name:'Sync & prepare device',exact:true}).click();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await route('/match?event_key=2026qa&match_key=2026qa_qm4&scouted_team=6390&form_id=qa-match-form&assignment_id=qa-assignment');const note=`Offline evidence ${Date.now()}`;
  await page.getByLabel('Autonomous pieces',{exact:true}).fill('0');await page.getByLabel('Scout notes',{exact:true}).fill(note);await page.getByText('Draft saved as you go',{exact:true}).waitFor();await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.getByLabel('Scout notes',{exact:true}).waitFor();assert.equal(await page.getByLabel('Scout notes',{exact:true}).inputValue(),note);
  await page.getByRole('button',{name:'Submit scouting report',exact:true}).click();await page.getByRole('heading',{name:'Report saved.',exact:true}).waitFor();await page.goto(baseURL,{waitUntil:'domcontentloaded'});await page.locator('.argus-app').waitFor();assert.equal(await page.locator('.argus-public').count(),0,'Prepared scouts bypass the public welcome page on an offline root reload');await context.setOffline(false);await route('/sync');await page.getByRole('button',{name:'Sync & prepare device',exact:true}).click();await page.waitForFunction(async note=>{const r=await(await fetch('/api/submissions')).json();return r.filter(x=>x.answers?.notes===note).length===1;},note);
 });
 await check('ownership preview, selected scouts, generated duties and locked manual changes persist',async()=>{
  await route('/assignments');await page.getByRole('button',{name:'Manage ownership',exact:true}).click();await page.getByText('Choose scouts and forms',{exact:true}).click();await page.getByRole('checkbox',{name:'qa_idle',exact:true}).uncheck();
  await page.getByRole('button',{name:'Randomize teams',exact:true}).click();await page.getByRole('region',{name:'Ownership preview'}).waitFor();await page.getByRole('button',{name:'Apply assignments',exact:true}).click();await page.getByText(/Ownership saved\./).waitFor();
  const owners=(await api(page,'/team_allocations')).data;assert.equal(owners.length,4);assert.ok(!owners.some(a=>a.owner_user_id==='qa-idle'));
  const duties=(await api(page,'/assignments')).data;for(const a of owners)assert.ok(duties.some(d=>d.report_kind==='pit'&&d.team_number===a.team_number&&d.scout_user_id===a.owner_user_id));assert.ok(duties.some(d=>d.handoff_id&&d.scout_user_id==='qa-idle'));
  await page.getByText(/Move or lock individual teams/).click();await page.getByRole('checkbox',{name:'Lock team 254',exact:true}).check();await page.getByRole('button',{name:'Save team 254',exact:true}).click();await page.waitForFunction(async()=>{const a=await(await fetch('/api/team_allocations')).json();return a.find(x=>x.team_number===254).locked;});
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Manage ownership',exact:true}).click();await page.getByText(/Move or lock individual teams/).click();assert.ok(await page.getByRole('checkbox',{name:'Lock team 254',exact:true}).isChecked());
 });
 await check('simple Admin randomizer and searchable scout/team roster keep preview reversible',async()=>{
  await route('/admin?tab=assignments');await page.getByRole('heading',{name:'Team assignments',exact:true}).waitFor();
  const roster=page.getByRole('region',{name:'Who scouts each team',exact:true});await roster.locator('.a-roster-row').filter({hasText:'qa_idle'}).waitFor();await roster.getByText('No teams assigned',{exact:true}).waitFor();
  await page.getByText('Choose scouts and forms',{exact:true}).click();await page.getByRole('button',{name:'Clear selection',exact:true}).click();assert.ok(await page.getByRole('button',{name:'Randomize teams',exact:true}).isDisabled());
  await page.getByRole('button',{name:'Select everyone',exact:true}).click();await page.getByText('Choose scouts and forms',{exact:true}).click();
  const before=(await api(page,'/team_allocations')).data;await page.getByRole('button',{name:'Randomize teams',exact:true}).click();await page.getByRole('region',{name:'Ownership preview',exact:true}).waitFor();
  assert.deepEqual((await api(page,'/team_allocations')).data,before,'Randomize only previews until confirmed');await page.getByRole('button',{name:'Cancel preview',exact:true}).click();
  await roster.getByRole('button',{name:'By team',exact:true}).click();await roster.getByLabel('Find a scout or team',{exact:true}).fill('254');await roster.getByRole('button',{name:'Team 254 · Locked',exact:true}).click();
  const selected=page.getByRole('region',{name:'Assignment for team 254',exact:true});await selected.getByText('Assigned scout:',{exact:true}).waitFor();assert.equal(await selected.getByLabel('Permanent owner',{exact:true}).inputValue(),before.find(a=>a.team_number===254).owner_user_id);
  for(const width of widths){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(artifacts,`assignment-roster-${width}.png`),fullPage:true});}
  await selected.getByRole('link',{name:'Open team profile',exact:true}).click();await page.getByText('Assigned scout:',{exact:true}).waitFor();await page.getByRole('link',{name:'View assignment',exact:true}).click();await page.getByRole('region',{name:'Assignment for team 254',exact:true}).waitFor();
  await page.setViewportSize({width:1440,height:1000});await route('/teams/254');
 });
 await check('Admin missing reports, actor history, reversible report removal and shared publication',async()=>{
  await route('/admin');await page.getByRole('heading',{name:'Admin control centre',exact:true}).waitFor();await page.getByRole('heading',{name:'Scouting by team',exact:true}).waitFor();
  assert.equal(await page.locator('.a-coverage-tile').count(),4);
  const beforeReports=(await api(page,'/submissions')).data;
  const coverage=(await api(page,'/admin/overview?event_id=qa-event')).data.team_coverage;
  const team=coverage.find(t=>t.status==='red'&&t.missing_matches.length),tile=()=>page.locator('.a-coverage-tile').filter({has:page.locator('strong').filter({hasText:team.team_number})});
  await tile().click();const teamDialog=page.getByRole('dialog',{name:new RegExp('Team '+team.team_number)});
  await teamDialog.getByText('Permanent owner:',{exact:true}).waitFor();assert.ok(await teamDialog.getByText(/Responsible:/).first().isVisible());
  await teamDialog.getByRole('button',{name:'Dismiss missed match',exact:true}).first().click();await teamDialog.getByText('Dismissed matches (1)',{exact:true}).waitFor();
  await teamDialog.getByRole('button',{name:'Dismiss team warnings',exact:true}).click();await teamDialog.getByText('No outstanding warnings',{exact:true}).waitFor();
  await teamDialog.getByRole('button',{name:'Close',exact:true}).click();assert.ok((await tile().getAttribute('class')).includes('is-green'));
  assert.deepEqual((await api(page,'/submissions')).data,beforeReports,'Dismissals do not invent data');
  await page.reload({waitUntil:'networkidle'});await tile().click();await teamDialog.getByText('No outstanding warnings',{exact:true}).waitFor();
  await teamDialog.getByRole('button',{name:'Restore team warnings',exact:true}).click();await teamDialog.getByText('Pit not scouted',{exact:true}).waitFor();
  await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>!!document.activeElement.closest('.a-coverage-dialog')));
  await page.keyboard.press('Escape');await teamDialog.waitFor({state:'hidden'});assert.ok((await tile().getAttribute('class')).includes('is-red'));
  await page.getByRole('button',{name:'Forms and reports',exact:true}).click();await page.getByLabel('Reason for removal or restoration').fill('QA removal recovery');const first=page.locator('.a-duty').filter({has:page.getByRole('button',{name:'Remove report',exact:true})}).first();await first.getByRole('button',{name:'Remove report',exact:true}).click();await page.getByRole('button',{name:'Restore report',exact:true}).first().waitFor();await page.getByRole('button',{name:'Restore report',exact:true}).first().click();
  await page.getByRole('button',{name:'Shared data',exact:true}).click();await page.getByRole('checkbox',{name:'QA match report: Autonomous pieces',exact:true}).check();await page.getByRole('button',{name:'Save approved measurements',exact:true}).click();await page.getByText(/Approved summaries saved/).waitFor();
  await page.getByRole('button',{name:'Activity',exact:true}).click();await page.getByText('report.restore',{exact:true}).first().waitFor();
 });
 await check('Scouter API/route protection and approved evidence exclude private raw reports',async()=>{
  const ctx=await browser.newContext({viewport:{width:390,height:1000}}),scout=await ctx.newPage();
  try{await login(scout,'qa_member');assert.equal((await api(scout,'/admin/overview?event_id=qa-event')).status,403);assert.equal((await api(scout,'/submissions/qa-zero')).status,404);await route('/admin',scout);await scout.getByRole('heading',{name:'Administrator access required'}).waitFor();
   const shared=await api(scout,'/events/qa-event/analytics');assert.equal(shared.status,200);assert.ok(!JSON.stringify(shared.data).includes('Scout notes'));assert.ok(!JSON.stringify(shared.data).includes('qa_owner'));await route('/analytics',scout);await scout.getByRole('heading',{name:'Analytics',exact:true}).waitFor();
   await scout.screenshot({path:path.join(artifacts,'scouter-approved-390.png'),fullPage:true});
  }finally{await ctx.close();}
 });
 await check('practice uses existing form autosave and never enters competition data',async()=>{
  const before=(await api(page,'/submissions')).data.length;await route('/practice');await page.getByRole('button',{name:'Practice: QA pit report',exact:true}).click();const note=`Practice only ${Date.now()}`;await page.getByLabel('Scout notes',{exact:true}).fill(note);await page.getByText('Draft saved as you go',{exact:true}).waitFor();await route('/help');await page.getByRole('heading',{name:'Help and learning',exact:true}).waitFor();await route('/practice');await page.getByRole('button',{name:'Practice: QA pit report',exact:true}).click();assert.equal(await page.getByLabel('Scout notes',{exact:true}).inputValue(),note);
  await page.getByRole('button',{name:'Submit scouting report',exact:true}).click();await page.getByRole('heading',{name:'Practice report saved.',exact:true}).waitFor();await page.waitForFunction(async note=>(await(await fetch('/api/practice?team_id=qa-workspace')).json()).some(r=>r.answers.notes===note),note);assert.equal((await api(page,'/submissions')).data.length,before);
 });
 await check('offline help, preference persistence and push refusal safety',async()=>{
  await route('/help?topic=handoffs-and-breaks');await page.getByRole('article',{name:'Handoffs and breaks'}).waitFor();await route('/reminders');await page.getByRole('checkbox',{name:'Upcoming match push (about five minutes before)',exact:true}).uncheck();await page.getByRole('button',{name:'Save reminder preferences',exact:true}).click();await page.getByText(/Preferences saved/).waitFor();await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByRole('checkbox',{name:'Upcoming match push (about five minutes before)',exact:true}).isChecked(),false);
  assert.equal((await api(page,'/push/subscribe','POST',{team_id:'qa-workspace',subscription:{endpoint:'https://127.0.0.1/private'}})).status,400);
  await context.setOffline(true);await route('/help?topic=offline-and-sync');await page.getByRole('article',{name:'Offline and synchronization'}).waitFor();await context.setOffline(false);
 });
 await check('responsive task/Admin/help screens, five mobile destinations and dialog focus',async()=>{
  for(const width of widths){await page.setViewportSize({width,height:1000});for(const section of ['dashboard','assignments','admin','practice','help','analyst','strategy','events','settings']){await route(`/${section}`);await page.locator('#workspace-main h1,#workspace-main h2').first().waitFor();if(section==='admin')await page.locator('.a-coverage-tile').first().waitFor();await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});await page.screenshot({path:path.join(artifacts,`${section}-${width}.png`),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${section} overflow at ${width}`);}}
  assert.equal(await page.locator('.a-mobile-nav a,.a-mobile-nav button').count(),5);assert.ok(await page.locator('.a-mobile-nav a[href="#/assignments"]').isVisible());
 });
 await check('large-event coverage is searchable, paginated and fits a phone without a long match list',async()=>{
  const pattern='**/api/admin/overview?event_id=qa-event';
  await page.route(pattern,async request=>{const response=await request.fetch(),body=await response.json();const source=body.team_coverage[0];body.team_coverage=Array.from({length:48},(_,index)=>({...source,team_number:String(9000+index),team_name:`QA test team ${index+1}`,missing_matches:Array.from({length:13},(_,slot)=>({...source.missing_matches[0],match_key:`2026qa_qm${slot+10}`}))}));await request.fulfill({response,json:body});});
  try{
   await page.setViewportSize({width:360,height:844});await route('/dashboard');await route('/admin');await page.getByRole('button',{name:/Team 9000/}).waitFor();assert.equal(await page.locator('.a-coverage-tile').count(),6);
   await page.getByRole('button',{name:'Next teams',exact:true}).click();await page.getByRole('button',{name:/Team 9006/}).waitFor();
   await page.getByLabel('Find team',{exact:true}).fill('9047');await page.getByRole('button',{name:/Team 9047/}).waitFor();assert.equal(await page.locator('.a-coverage-tile').count(),1);await page.getByLabel('Find team',{exact:true}).fill('');
   await page.getByLabel('Show team coverage',{exact:true}).selectOption('green');assert.equal(await page.locator('.a-coverage-tile').count(),0);await page.getByLabel('Show team coverage',{exact:true}).selectOption('all');
   await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});
   const bottom=await page.locator('.a-coverage-pages').evaluate(el=>el.getBoundingClientRect().bottom);assert.ok(bottom<=844-65,`Phone team controls require scrolling: ${bottom}`);
   await page.screenshot({path:path.join(artifacts,'coverage-48-teams-360.png')});
   await page.getByRole('button',{name:/Team 9000/}).click();const details=page.getByRole('dialog',{name:/Team 9000/}),missed=details.getByRole('region',{name:'Missed matches',exact:true});
   assert.equal(await missed.locator('.a-coverage-match-row').count(),4);await missed.getByRole('button',{name:'Next matches',exact:true}).click();await missed.getByText('2026qa_qm14',{exact:true}).waitFor();
   await details.evaluate(el=>{el.scrollTop=0;});const dismissBox=await details.getByRole('button',{name:'Dismiss team warnings',exact:true}).boundingBox();assert.ok(dismissBox.y>=0&&dismissBox.y+dismissBox.height<=844,'Team action is reachable without scrolling through missed matches');
   assert.ok(await details.evaluate(el=>el.scrollHeight<=el.clientHeight+1),'The paged team detail fits the phone');await page.screenshot({path:path.join(artifacts,'coverage-13-missing-matches-360.png')});
   await details.getByRole('button',{name:'Close',exact:true}).click();
   await page.getByLabel('Admin section',{exact:true}).selectOption('members');await page.getByRole('heading',{name:'Members and roles',exact:true}).waitFor();await page.getByLabel('Admin section',{exact:true}).selectOption('attention');
   await page.setViewportSize({width:1440,height:1000});await page.waitForFunction(()=>document.querySelectorAll('.a-coverage-tile').length===12);assert.equal(await page.locator('.a-coverage-tile').count(),12);
  }finally{await page.unroute(pattern);}
 });
 await check('non-destructive event activation and old-client rejection retain historical data',async()=>{
  await context.setOffline(false);await page.setViewportSize({width:1280,height:1000});const before=(await api(page,'/submissions')).data;await api(page,'/scout_events','POST',{id:'qa-next',team_id:'qa-workspace',event_key:'2026next',event_name:'QA Next Event',event_teams:[],matches:[]});await page.route('**/api/tba/events/*/simple',r=>r.fulfill({json:[{key:'2026next',name:'QA Next Event'}]}));await page.reload({waitUntil:'networkidle'});await route('/events');assert.equal(await page.getByRole('heading',{name:'Choose the active event',exact:true}).count(),0);await page.getByLabel('Official event',{exact:true}).selectOption('2026next');for(const width of widths){await page.setViewportSize({width,height:1000});await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(artifacts,'event-picker-' + width + '.png'),fullPage:true});}await page.getByRole('button',{name:'Select official event',exact:true}).click();const modal=page.getByRole('dialog',{name:'Change active event',exact:true});await modal.getByRole('button',{name:'Activate event and keep history',exact:true}).waitFor();await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>!!document.activeElement.closest('dialog')));await page.keyboard.press('Escape');assert.equal((await api(page,'/teams/qa-workspace')).data.active_event_id,'qa-event');
  await page.getByRole('button',{name:'Select official event',exact:true}).click();await modal.getByRole('button',{name:'Activate event and keep history',exact:true}).click();await modal.waitFor({state:'hidden'});assert.equal((await api(page,'/teams/qa-workspace')).data.active_event_id,'qa-next');assert.deepEqual((await api(page,'/submissions')).data.map(r=>r.id).sort(),before.map(r=>r.id).sort());
  assert.equal((await api(page,'/event-transition','POST',{team_id:'qa-workspace',next_event_id:'qa-event',delete_forms:true})).status,409);
  await route('/history');await page.getByLabel('Historical event').selectOption('qa-event');await page.getByRole('heading',{name:'Teams',exact:true}).waitFor();assert.equal((await api(page,'/teams/qa-workspace')).data.active_event_id,'qa-next','History browsing never changes the active event');
 });
 if(errors.length)results.push({name:'uncaught browser errors',status:'failed',errors});
}finally{await browser.close();fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify({baseURL,results,errors},null,2));console.log(JSON.stringify({artifacts,results},null,2));}
if(results.some(result=>result.status==='failed'))process.exitCode=1;
