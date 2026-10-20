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
const login=async(target,username)=>{await target.goto(baseURL,{waitUntil:'networkidle'});await target.getByLabel('Username',{exact:true}).fill(username);await target.getByLabel('Password',{exact:true}).fill('ArgusQA2026!');await target.locator('.auth-submit').click();await target.locator('.argus-app').waitFor();};
const check=async(name,run)=>{try{await run();results.push({name,status:'passed'});}catch(error){results.push({name,status:'failed',error:error.message});await page.screenshot({path:path.join(artifacts,`failure-${results.length}.png`),fullPage:true}).catch(()=>{});}finally{await context.setOffline(false);await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close())).catch(()=>{});console.log(JSON.stringify(results.at(-1)));}};
const widths=[1440,1280,1024,768,390,360];
try {
 await login(page,'qa_owner');
 const teams=await api(page,'/teams');assert.ok(teams.data.some(t=>t.id==='qa-workspace'&&t.name==='QA robotics'),'Synthetic fixture required.');
 await check('role-aware onboarding, replay, main routes and no topbar event switch',async()=>{
  await route('/dashboard');await page.getByRole('region',{name:'Welcome guide'}).waitFor();await page.getByRole('button',{name:'Skip guide',exact:true}).click();
  for(const destination of ['assignments','admin','practice','help','analyst','teams','matches','analytics','strategy','events','settings']){await route(`/${destination}`);await page.locator('#workspace-main h1,#workspace-main h2').first().waitFor();}
  assert.equal(await page.locator('.a-topbar a[href="#/events"]').count(),0);
  await route('/help');await page.getByRole('button',{name:'Replay welcome guide',exact:true}).click();await page.getByRole('region',{name:'Welcome guide'}).waitFor();await page.getByRole('button',{name:'Skip guide',exact:true}).click();
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
  await page.getByRole('button',{name:'Submit scouting report',exact:true}).click();await page.getByRole('heading',{name:'Report saved.',exact:true}).waitFor();await context.setOffline(false);await route('/sync');await page.getByRole('button',{name:'Sync & prepare device',exact:true}).click();await page.waitForFunction(async note=>{const r=await(await fetch('/api/submissions')).json();return r.filter(x=>x.answers?.notes===note).length===1;},note);
 });
 await check('ownership preview, selected scouts, generated duties and locked manual changes persist',async()=>{
  await route('/assignments');await page.getByRole('button',{name:'Manage ownership',exact:true}).click();await page.getByLabel('Generation mode').selectOption('rerandomize');await page.getByRole('checkbox',{name:'qa_idle',exact:true}).uncheck();
  await page.getByRole('button',{name:'Preview team ownership',exact:true}).click();await page.getByRole('region',{name:'Ownership preview'}).waitFor();await page.getByRole('button',{name:'Apply team ownership',exact:true}).click();await page.getByText(/Ownership saved\./).waitFor();
  const owners=(await api(page,'/team_allocations')).data;assert.equal(owners.length,4);assert.ok(!owners.some(a=>a.owner_user_id==='qa-idle'));
  const duties=(await api(page,'/assignments')).data;for(const a of owners)assert.ok(duties.some(d=>d.report_kind==='pit'&&d.team_number===a.team_number&&d.scout_user_id===a.owner_user_id));assert.ok(duties.some(d=>d.handoff_id&&d.scout_user_id==='qa-idle'));
  await page.getByText(/Move or lock individual teams/).click();await page.getByRole('checkbox',{name:'Lock team 254',exact:true}).check();await page.getByRole('button',{name:'Save team 254',exact:true}).click();await page.waitForFunction(async()=>{const a=await(await fetch('/api/team_allocations')).json();return a.find(x=>x.team_number===254).locked;});
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Manage ownership',exact:true}).click();await page.getByText(/Move or lock individual teams/).click();assert.ok(await page.getByRole('checkbox',{name:'Lock team 254',exact:true}).isChecked());
 });
 await check('Admin missing reports, actor history, reversible report removal and shared publication',async()=>{
  await route('/admin');await page.getByRole('heading',{name:'Admin control centre',exact:true}).waitFor();await page.getByRole('heading',{name:'Missing pit and completed-match reports',exact:true}).waitFor();
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
  for(const width of widths){await page.setViewportSize({width,height:1000});for(const section of ['dashboard','assignments','admin','practice','help','analyst','strategy','events','settings']){await route(`/${section}`);await page.screenshot({path:path.join(artifacts,`${section}-${width}.png`),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${section} overflow at ${width}`);}}
  assert.equal(await page.locator('.a-mobile-nav a,.a-mobile-nav button').count(),5);assert.ok(await page.locator('.a-mobile-nav a[href="#/assignments"]').isVisible());
 });
 await check('non-destructive event activation and old-client rejection retain historical data',async()=>{
  await context.setOffline(false);await page.setViewportSize({width:1280,height:1000});const before=(await api(page,'/submissions')).data;await api(page,'/scout_events','POST',{id:'qa-next',team_id:'qa-workspace',event_key:'2026next',event_name:'QA Next Event',event_teams:[],matches:[]});await page.reload({waitUntil:'networkidle'});await route('/events');await page.getByRole('button',{name:'QA Next Event',exact:true}).click();const modal=page.getByRole('dialog',{name:'Change active event',exact:true});await modal.getByRole('button',{name:'Activate event and keep history',exact:true}).waitFor();await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>!!document.activeElement.closest('dialog')));await page.keyboard.press('Escape');assert.equal((await api(page,'/teams/qa-workspace')).data.active_event_id,'qa-event');
  await page.getByRole('button',{name:'QA Next Event',exact:true}).click();await modal.getByRole('button',{name:'Activate event and keep history',exact:true}).click();await modal.waitFor({state:'hidden'});assert.equal((await api(page,'/teams/qa-workspace')).data.active_event_id,'qa-next');assert.deepEqual((await api(page,'/submissions')).data.map(r=>r.id).sort(),before.map(r=>r.id).sort());
  assert.equal((await api(page,'/event-transition','POST',{team_id:'qa-workspace',next_event_id:'qa-event',delete_forms:true})).status,409);
  await route('/history');await page.getByLabel('Historical event').selectOption('qa-event');await page.getByRole('heading',{name:'Teams',exact:true}).waitFor();assert.equal((await api(page,'/teams/qa-workspace')).data.active_event_id,'qa-next','History browsing never changes the active event');
 });
 if(errors.length)results.push({name:'uncaught browser errors',status:'failed',errors});
}finally{await browser.close();fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify({baseURL,results,errors},null,2));console.log(JSON.stringify({artifacts,results},null,2));}
if(results.some(result=>result.status==='failed'))process.exitCode=1;
