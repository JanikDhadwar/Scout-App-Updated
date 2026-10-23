const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const app=path.join(root,'Clasue-scout-app');
const {chromium}=createRequire(path.join(app,'package.json'))('playwright');
const {createFixture}=require('../scripts/qa-fixture.cjs');
const dest=path.join(__dirname,'composition/assets/screens');fs.mkdirSync(dest,{recursive:true});
(async()=>{
 const fixture=createFixture();const db=JSON.parse(fs.readFileSync(fixture.dbFile,'utf8'));
 db.teams[0].name='Demo scouting team';db.users[0].username='Scout A';
 db.memberships.find(m=>m.user_id==='qa-owner').username='Scout A';
 db.scout_events[0].event_name='Demo invitational';
 for(const form of db.forms)form.title=form.kind==='pit'?'Pit scouting':'Match scouting';
 for(const r of db.submissions){r.form_title=r.report_kind==='pit'?'Pit scouting':'Match scouting';r.submitted_by='Demo scout';}
 for(const [key,value] of Object.entries(db.scout_events[0].analytics_config))value.category=key.endsWith(':height')?'reliability':'scoring';
 fs.writeFileSync(fixture.dbFile,JSON.stringify(db));
 const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 const server=spawn(process.execPath,[path.join(app,'server.cjs')],{cwd:app,env:{...process.env,APP_PORT:String(port),DB_FILE:fixture.dbFile,TBA_API_KEY:'',MATCH13_API_KEY:'',GROQ_API_KEY:'',NODE_ENV:'test'},stdio:'ignore',windowsHide:true});
 const base=`http://127.0.0.1:${port}`;let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.route('**/api/match13/**',route=>route.fulfill({status:503,json:{error:'Demo: external ratings are not connected.'}}));
  await page.goto(base);await page.getByLabel('Username',{exact:true}).fill('Scout A');await page.getByLabel('Password',{exact:true}).fill(fixture.password);await page.locator('.auth-submit').click();await page.locator('.argus-app').waitFor();
  const skip=page.getByRole('button',{name:'Skip guide',exact:true});if(await skip.isVisible())await skip.click();
  await page.waitForTimeout(1000);await page.reload({waitUntil:'networkidle'});await page.locator('.argus-app').waitFor();
  const go=async route=>{await page.evaluate(route=>{location.hash=route;},route);await page.waitForTimeout(550);await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});};
  const shot=async(name,route,width=1440,height=900)=>{await page.setViewportSize({width,height});await go(route);await page.screenshot({path:path.join(dest,name+'.png')});console.log(name);};
  await shot('home-laptop','/dashboard',1440,900);await shot('home-tablet','/dashboard',1024,768);await shot('home-phone','/dashboard',390,844);
  await shot('assignments','/assignments');await shot('matches','/matches');await shot('admin','/admin');
  await shot('pit','/pit',1024,900);await shot('analytics','/analytics');await shot('comparison','/compare?teams=254,1678');await shot('strategy','/strategy');
  await page.getByRole('button',{name:'Create scoring picklist',exact:true}).click();await page.waitForTimeout(250);await page.evaluate(()=>scrollTo(0,550));await page.screenshot({path:path.join(dest,'picklist.png')});
  await shot('practice','/practice',1024,768);await shot('help','/help',1024,768);await shot('reminders','/reminders',1024,768);
  await shot('scout','/match?event_key=2026qa&match_key=2026qa_qm4&scouted_team=6390&form_id=qa-match-form&assignment_id=qa-assignment',390,844);
  await page.getByLabel('Autonomous pieces',{exact:true}).fill('0');await page.getByLabel('Teleoperated pieces',{exact:true}).fill('12');await page.getByLabel('Scout notes',{exact:true}).fill('Example entry: scoring observed at the hub.');await page.waitForTimeout(450);await page.screenshot({path:path.join(dest,'scout-filled.png')});
  console.log('Captures use a temporary synthetic database only.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
