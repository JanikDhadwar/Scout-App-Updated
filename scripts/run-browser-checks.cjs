const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');
const {createFixture}=require('./qa-fixture.cjs');
const appDirectory=path.resolve(__dirname,'../Clasue-scout-app');
const nodeEnv=process.env.QA_NODE_ENV||'test';
if(!['test','production'].includes(nodeEnv))throw new Error('QA_NODE_ENV must be test or production.');
const exited=child=>new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
(async()=>{
 const args=process.argv.slice(2);if(args.length&&!(args.length===1&&['--accessibility','--expansion'].includes(args[0])))throw Error('Supported suite options: --accessibility or --expansion');
 const runnerFile=args[0]==='--accessibility'?'accessibility-checks.mjs':args[0]==='--expansion'?'expansion-browser-checks.mjs':'browser-checks.mjs';
 const fixture=createFixture();
 if(args[0]==='--expansion'){
  const db=JSON.parse(fs.readFileSync(fixture.dbFile,'utf8')),event=db.scout_events[0];
  event.event_teams.push({team_number:111,nickname:'Fixture red robot'},{team_number:222,nickname:'Fixture blue robot'});
  for(const match of event.matches){match.alliances.red.team_keys.push('frc111');match.alliances.blue.team_keys.push('frc222');}
  fs.writeFileSync(fixture.dbFile,JSON.stringify(db));
 }
 const envFile=path.join(fixture.directory,'argus-test.env');fs.writeFileSync(envFile,'',{mode:0o600});
 const reservation=net.createServer();await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve);});const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 if(!fs.existsSync(path.join(appDirectory,'dist/index.html')))throw new Error('Run npm run build before browser QA.');
 const baseURL=`http://127.0.0.1:${port}`;
 console.log(`Browser QA fixture: ${fixture.dbFile}\nBrowser QA URL: ${baseURL}`);
 const server=spawn(process.execPath,[path.join(appDirectory,'server.cjs')],{cwd:appDirectory,env:{...process.env,APP_PORT:String(port),DB_FILE:fixture.dbFile,ARGUS_ENV_FILE:envFile,TBA_API_KEY:'',GROQ_API_KEY:'',MATCH13_API_KEY:'',ARGUS_MFA_KEY:Buffer.alloc(32,7).toString('base64'),ARGUS_TRUST_PROXY:'',NODE_ENV:nodeEnv},stdio:['ignore','pipe','pipe'],windowsHide:true});
 let serverOutput='';server.stdout.on('data',data=>{serverOutput+=data;});server.stderr.on('data',data=>{serverOutput+=data;});const stopped=exited(server);
 try{
  let ready=false;const deadline=Date.now()+20000;
  while(Date.now()<deadline){if(server.exitCode!==null)throw new Error(`Fixture server exited: ${serverOutput}`);try{const response=await fetch(`${baseURL}/api/health`,{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break;}}catch{/* Server is still starting. */}await new Promise(resolve=>setTimeout(resolve,100));}
  if(!ready)throw new Error(`Fixture server startup timed out: ${serverOutput}`);
  const runner=spawn(process.execPath,[path.join(__dirname,runnerFile)],{cwd:appDirectory,env:{...process.env,QA_BASE_URL:baseURL},stdio:'inherit',windowsHide:true});
  const result=await exited(runner);process.exitCode=result.code??1;
 }finally{server.kill();await stopped;fs.writeFileSync(path.join(fixture.directory,'server.log'),serverOutput);console.log(`Stopped fixture server. Retained test data: ${fixture.directory}`);}
})().catch(error=>{console.error(error);process.exitCode=1;});
