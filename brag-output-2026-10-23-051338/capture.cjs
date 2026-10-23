// Records the actual local Argus app. All mutations use a disposable fixture DB.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn,execFileSync}=require('node:child_process');
const {createRequire}=require('node:module');
const app=path.resolve(__dirname,'../Clasue-scout-app');
const {chromium}=createRequire(path.join(app,'package.json'))('playwright');
const {createFixture}=require('../scripts/qa-fixture.cjs');
const dest=path.join(__dirname,'assets');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const fixture=createFixture(),db=JSON.parse(fs.readFileSync(fixture.dbFile,'utf8'));
 db.teams[0].name='Demo scouting team';
 const names={'qa-owner':'Scout A','qa-admin':'Scout B','qa-member':'Scout C','qa-idle':'Scout D'};
 for(const u of db.users)u.username=names[u.id]||'Demo observer';
 for(const m of db.memberships)m.username=names[m.user_id]||'Demo observer';
 db.scout_events[0].event_name='Demo invitational';
 for(const form of db.forms)form.title=form.kind==='pit'?'Pit scouting':'Match scouting';
 for(const r of db.submissions){r.form_title=r.report_kind==='pit'?'Pit scouting':'Match scouting';r.submitted_by=names[r.user_id]||'Demo observer';}
 for(const [key,v] of Object.entries(db.scout_events[0].analytics_config))v.category=key.endsWith(':height')?'reliability':'scoring';
 // Extra linked observations make the existing chart and coverage views meaningful.
 for(const team of [254,1678,2056,6390])for(const match of [1,2,3]){
  if(db.submissions.some(r=>r.scouted_team===String(team)&&r.match_number===match&&r.event_key==='2026qa'))continue;
  const model=db.submissions[0];db.submissions.push({...model,id:`demo-${team}-${match}`,scouted_team:String(team),match_key:`2026qa_qm${match}`,match_number:match,alliance:[254,6390].includes(team)?'red':'blue',answers:{auto:2+match,teleop:8+match*2+(team===1678?4:0),climb:'Yes',height:2,notes:'Synthetic demonstration observation.'}});
 }
 fs.writeFileSync(fixture.dbFile,JSON.stringify(db));
 const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 const server=spawn(process.execPath,[path.join(app,'server.cjs')],{cwd:app,env:{...process.env,APP_PORT:String(port),DB_FILE:fixture.dbFile,TBA_API_KEY:'',MATCH13_API_KEY:'',GROQ_API_KEY:'',NODE_ENV:'test'},stdio:'ignore',windowsHide:true});
 let browser;const evidence={temporaryDatabase:true,externalRatings:'Synthetic provider responses for demonstration; not live competition values.',formats:{}};
 try{
  const base=`http://127.0.0.1:${port}`;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await sleep(100);}
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const format of ['website','instagram']){
   // Reset only this temporary DB between the two independent demonstration takes.
   fs.writeFileSync(fixture.dbFile,JSON.stringify(db));
   const raw=path.join(__dirname,'raw',format);fs.mkdirSync(raw,{recursive:true});
   const size=format==='website'?{width:1280,height:800}:{width:540,height:960};
   const context=await browser.newContext({viewport:size,recordVideo:{dir:raw,size},acceptDownloads:true});
   const p=await context.newPage();const origin=Date.now();p.setDefaultTimeout(6500);
   await p.route('**/api/match13/**',async r=>{const u=new URL(r.request().url());let json={};if(u.pathname.endsWith('/rating'))json={rating:{team:Number(u.searchParams.get('team')),year:2026,xp:203.2,auto:40.3,teleop:162.2,endgame:.7,rank:58},fetched_at:new Date().toISOString()};else if(u.pathname.endsWith('/regions'))json={complete:true,world:{name:'World',rank:58,total:3708},country:{name:'USA',rank:44,total:2934},district:{name:'Pacific Northwest',rank:5,total:126},state:{name:'Washington',rank:5,total:86}};else if(u.pathname.endsWith('/predictions'))json={event:'2026qa',matches:[{key:'2026qa_qm4',teams:[254,6390,1678,2056],redScore:100,blueScore:90,redWinProbability:.75}],fetched_at:new Date().toISOString()};else json={rows:[],year:2026,total:0};await r.fulfill({json});});
   await p.route('**/api/tba/**',async r=>{const u=new URL(r.request().url());await r.fulfill({json:u.pathname.endsWith('/matches')?db.scout_events[0].matches:{key:'2026qa',name:'Demo invitational',webcasts:[{type:'youtube',channel:'DEMO6390AAA'}]}});});
   const still=fs.readFileSync(path.resolve(__dirname,'../brag-output-2026-10-23-044114/composition/assets/play-still.jpg')).toString('base64');
   await p.route('https://www.youtube.com/embed/**',r=>r.fulfill({contentType:'text/html',body:`<body style="margin:0;background:#0B1018;color:white;font:18px Arial"><img style="width:100%;height:85%;object-fit:cover" src="data:image/jpeg;base64,${still}"><p style="padding:0 18px">Demo stream preview · User-supplied robot still</p></body>`}));
   await p.goto(base);await p.getByLabel('Username',{exact:true}).fill('Scout A');await p.getByLabel('Password',{exact:true}).fill(fixture.password);await p.locator('.auth-submit').click();await p.locator('.argus-app').waitFor();
   const skip=p.getByRole('button',{name:'Skip guide',exact:true});if(await skip.isVisible())await skip.click();await sleep(1000);await p.reload({waitUntil:'networkidle'});await p.locator('.argus-app').waitFor();
   await p.addStyleTag({content:'html{scroll-behavior:smooth}'});
   const go=async hash=>{await p.evaluate(h=>{location.hash=h},hash);await sleep(650);await p.evaluate(()=>scrollTo(0,0));};
   const hold=async(ms=650)=>p.waitForTimeout(ms);
   const click=async l=>{await l.scrollIntoViewIfNeeded();await hold(220);await l.click();await hold(450);};
   const markers=[];
   const segment=async(name,route,run,mandatory=false)=>{
    if(process.env.PIT_ONLY&&!['display','display-full'].includes(name))return;
    if(process.env.EXTRA_ONLY&&!['handoff','forms','offline','members','display-full'].includes(name))return;
    if(!process.env.EXTRA_ONLY&&!process.env.PIT_ONLY&&['handoff','forms','offline','members','display-full'].includes(name))return;
    await go(route);await hold(350);const start=(Date.now()-origin)/1000;
    try{await run();await hold(1000);markers.push({name,start,end:(Date.now()-origin)/1000,status:'captured'});console.log(format+': '+name);}
    catch(e){await p.screenshot({path:path.join(raw,name+'-error.png')});markers.push({name,start,end:(Date.now()-origin)/1000,status:'failed',error:e.message});console.log(format+': '+name+' FAILED '+e.message.slice(0,160));if(mandatory)throw e;}
   };
   await segment('handoff','/matches/2026qa_qm4',async()=>{
    const rc=await browser.newContext({viewport:size});const rp=await rc.newPage();rp.setDefaultTimeout(6500);
    try{
     await rp.goto(base);await rp.getByLabel('Username',{exact:true}).fill('Scout D');await rp.getByLabel('Password',{exact:true}).fill(fixture.password);await rp.locator('.auth-submit').click();await rp.locator('.argus-app').waitFor();
     const sk=rp.getByRole('button',{name:'Skip guide',exact:true});if(await sk.isVisible())await sk.click();await hold(1000);await rp.reload({waitUntil:'networkidle'});
     const presence=target=>target.evaluate(()=>fetch('/api/handoffs?team_id=qa-workspace').then(r=>r.json()));await presence(rp);await presence(p);await go('/matches/2026qa_qm4');
     await click(p.getByRole('button',{name:'Handoff team 254',exact:true}));const d=p.getByRole('dialog',{name:'Handoff team 254',exact:true});await d.getByRole('combobox').selectOption('qa-idle');await hold(500);await click(d.getByRole('button',{name:'Send handoff request',exact:true}));
     await rp.getByRole('button',{name:'Accept team 254',exact:true}).click();await hold(1000);await go('/matches/2026qa_qm4');await hold(700);
    }finally{await rc.close();}
   });
   await segment('forms','/match?event_key=2026qa&match_key=2026qa_qm4&scouted_team=6390&form_id=qa-match-form&assignment_id=qa-assignment',async()=>{
    await p.getByLabel('Autonomous pieces',{exact:true}).fill('4');await click(p.getByRole('button',{name:'Increase Teleoperated pieces by 1',exact:true}));await click(p.getByRole('button',{name:'Yes',exact:true}).first());await p.getByLabel('Climb height',{exact:true}).fill('2');
    await p.getByLabel('Scout notes',{exact:true}).fill('Demo pit evidence: review intake access.');await p.getByLabel('Robot photo',{exact:true}).setInputFiles(path.resolve(__dirname,'../brag-output-2026-10-23-044114/composition/assets/robot-photo.jpg'));await hold(900);
   });
   await segment('offline','/sync',async()=>{
    await click(p.getByRole('button',{name:'Sync & prepare device',exact:true}));await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await go('/match?event_key=2026qa&match_key=2026qa_qm4&scouted_team=6390&form_id=qa-match-form&assignment_id=qa-assignment');
    await p.getByLabel('Scout notes',{exact:true}).fill('Demo offline report '+format);await p.getByText('Draft saved as you go',{exact:true}).waitFor();
    await context.setOffline(true);await p.reload({waitUntil:'domcontentloaded'});await p.getByLabel('Scout notes',{exact:true}).waitFor();await click(p.getByRole('button',{name:'Submit scouting report',exact:true}));await p.getByRole('heading',{name:'Report saved.',exact:true}).waitFor();await hold(900);
    await context.setOffline(false);await go('/sync');await click(p.getByRole('button',{name:'Sync & prepare device',exact:true}));await p.waitForFunction(async note=>{const r=await(await fetch('/api/submissions')).json();return r.filter(x=>x.answers?.notes===note).length===1;},'Demo offline report '+format);
   });
   await segment('members','/admin?tab=members',async()=>hold(1300));
   await segment('display-full','/display',async()=>{await p.getByText('75% alliance win chance',{exact:true}).waitFor();await click(p.getByRole('button',{name:'Full screen',exact:true}));await hold(1300);await click(p.getByRole('button',{name:'Exit full screen',exact:true}));});
   await segment('home','/dashboard',async()=>{await hold(1100);});
   await segment('match','/matches/2026qa_qm4',async()=>{
    await click(p.getByRole('button',{name:'Start scouting',exact:true}));
    await click(p.getByRole('button',{name:'Scout team 6390, red alliance',exact:true}));
    await click(p.getByRole('button',{name:'Scout team 6390',exact:true}));
    await p.getByLabel('Autonomous pieces',{exact:true}).fill('4');await hold(450);
    await p.getByLabel('Teleoperated pieces',{exact:true}).fill('12');await hold(450);
    await p.getByLabel('Scout notes',{exact:true}).fill('Demo: scoring observed at the hub.');
    await click(p.getByRole('button',{name:'Submit scouting report',exact:true}));
    await p.getByText('Report saved.',{exact:true}).waitFor();
   },true);
   await segment('admin','/admin?tab=assignments',async()=>{
    await click(p.getByRole('button',{name:'Randomize teams',exact:true}));
    await p.getByRole('region',{name:'Ownership preview'}).waitFor();await hold(900);
    await click(p.getByRole('button',{name:'Apply assignments',exact:true}));
    await p.getByText(/Ownership saved\./).waitFor();
    await click(p.getByRole('button',{name:'By team',exact:true}));await hold(700);
   },true);
   await segment('display','/dashboard',async()=>{
    await click(p.getByRole('link',{name:'Pit display',exact:true}).first());
    await p.getByText('75% alliance win chance',{exact:true}).waitFor();
    await hold(1200);await p.getByText('Upcoming matches',{exact:true}).scrollIntoViewIfNeeded();await hold(1700);
    await p.getByText('75% alliance win chance',{exact:true}).scrollIntoViewIfNeeded();await hold(1200);
   },true);
   await segment('analytics','/teams/254',async()=>{
    await p.getByText('203.2',{exact:true}).waitFor();await hold(900);
    const tabs=p.getByRole('tab');if(await tabs.count()>1)await click(tabs.nth(1));
    await p.mouse.wheel(0,470);await hold(900);
   });
   await segment('compare','/compare?teams=254,1678',async()=>{await p.getByRole('region',{name:'Team comparison statistics'}).waitFor();await p.mouse.wheel(0,380);await hold(1100);});
   await segment('analyst','/analyst',async()=>{await click(p.getByRole('button',{name:'Summarize team 254',exact:true}));await p.getByText('Verified local calculation',{exact:true}).waitFor();await hold(900);});
   await segment('search','/dashboard',async()=>{await p.keyboard.press('Control+k');const d=p.getByRole('dialog');await d.getByRole('combobox').fill('254');await d.getByRole('option').first().waitFor();await hold(800);await p.keyboard.press('Enter');await hold(500);});
   await segment('picklist','/strategy',async()=>{await click(p.getByRole('button',{name:'Create scoring picklist',exact:true}));await click(p.getByRole('button',{name:'Save picklist',exact:true}));await p.getByText('Picklist saved on the server.',{exact:true}).waitFor();});
   await segment('pit','/pit',async()=>{const v=p.locator('summary').filter({hasText:/Pit visit checklist/});if(await v.count())await click(v);const b=p.getByRole('button',{name:'Record visit for team 254',exact:true});if(await b.count())await click(b);await hold(500);});
   await segment('present','/present/254',async()=>{await hold(500);await p.keyboard.press('ArrowRight');await hold(700);await p.keyboard.press('ArrowRight');await hold(700);
    for(const name of ['Export PDF','Export PowerPoint']){const b=p.getByRole('button',{name,exact:true});if(await b.count()){const download=p.waitForEvent('download');await click(b);const d=await download;fs.mkdirSync(path.join(__dirname,'export-proof'),{recursive:true});await d.saveAs(path.join(__dirname,'export-proof',format+'-'+d.suggestedFilename()));}}
   });
   await segment('sync','/sync',async()=>{await click(p.getByRole('button',{name:'Sync & prepare device',exact:true}));await hold(1200);});
   for(const n of ['practice','reminders','help'])await segment(n,'/'+n,async()=>hold(700));
   await p.screenshot({path:path.join(raw,'last.png')});const video=p.video();await context.close();const vp=await video.path();
   fs.mkdirSync(path.join(dest,format),{recursive:true});
   for(const m of markers.filter(m=>m.status==='captured')){execFileSync('ffmpeg',['-y','-ss',String(m.start),'-i',vp,'-t',String(m.end-m.start),'-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',path.join(dest,format,m.name+'.mp4'),'-loglevel','error'],{windowsHide:true});}
   evidence.formats[format]={size,markers};fs.writeFileSync(path.join(__dirname,process.env.PIT_ONLY?'capture-pit-evidence.json':process.env.EXTRA_ONLY?'capture-extras-evidence.json':'capture-evidence.json'),JSON.stringify(evidence,null,2));
  }
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
