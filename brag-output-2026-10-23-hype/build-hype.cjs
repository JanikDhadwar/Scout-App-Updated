// Re-edit of the user's preferred 044114 trailer, preserving its scenes and assets.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const previous=path.resolve(__dirname,'../brag-output-2026-10-23-044114/composition');
const dest=path.join(__dirname,'composition');fs.mkdirSync(dest,{recursive:true});
for(const name of ['assets','compositions'])fs.cpSync(path.join(previous,name),path.join(dest,name),{recursive:true});
for(const name of ['hyperframes.json','package.json'])fs.copyFileSync(path.join(previous,name),path.join(dest,name));
const beat=60/94,slots=[['home',0,6*beat,5],['play',6*beat,4,4]];
let start=6*beat+4;
for(const id of ['entry','crew','pits','evidence','picks','finish']){slots.push([id,start,9*beat,6]);start+=9*beat;}
const duration=Math.ceil(start*30)/30;
// Only this private review includes the supplied commercial recording.
execFileSync('ffmpeg',['-y','-i','C:/Users/Janik/Downloads/TheWeeknd_-_starboy_original_(mp3.pm).mp3','-t',String(duration),'-af',`afade=t=in:st=0:d=0.08,afade=t=out:st=${duration-.65}:d=0.65`,'-c:a','libmp3lame','-q:a','2',path.join(dest,'assets/private-starboy.mp3'),'-loglevel','error'],{windowsHide:true});
// Remove the old substitute score from this private review's asset folder.
const substitute=path.join(dest,'assets/music.mp3');if(fs.existsSync(substitute))fs.unlinkSync(substitute);
for(const [id,,length,oldLength]of slots){
 let html=fs.readFileSync(path.join(previous,'compositions',id+'.html'),'utf8');
 html=html.replaceAll('Illustrative app demo','Illustrative app demo · Private review');
 const ratio=length/oldLength;
 let motion=`
// Scale the original scene's action timing; keep the original illustrations and copy.
for(const child of tl.getChildren(false,true,true)){child.startTime(child.startTime()*${ratio});child.duration(child.duration()*${ratio});}
`;
 if(id==='play'){
  motion+=`tl.to('.film',{scale:1.025,duration:.1,ease:'power3.out'},2.45);tl.to('.film',{x:7,duration:.035},2.48);tl.to('.film',{x:-5,duration:.035},2.515);tl.to('.film',{x:0,scale:1,duration:.2,ease:'power2.out'},2.55);`;
 }else{
  motion+=`tl.fromTo('.stage',{x:${['crew','evidence','finish'].includes(id)?-90:90},opacity:.65},{x:0,opacity:1,duration:.16,ease:'power3.out'},0);`;
  motion+=`tl.fromTo('.brand',{y:-15,opacity:.4},{y:0,opacity:1,duration:.16,ease:'power3.out'},.02);`;
  if(id!=='finish')motion+=`tl.to('.stage',{x:-65,opacity:.8,duration:.1,ease:'power3.in'},${length-.11});`;
  const target={home:'.device-stage',entry:'.entry',crew:'.coord-screen',pits:'.visit-screen',evidence:'.analytics-screen',picks:'.strategy-screen',finish:'.out-devices'}[id];
  motion+=`tl.to('${target}',{scale:1.035,duration:.12,ease:'power3.out'},${2*beat});tl.to('${target}',{scale:1,duration:.2,ease:'power2.out'},${2*beat+.13});`;
  if(id==='finish')motion+=`tl.fromTo('.site-reveal',{y:30,opacity:0},{y:0,opacity:1,duration:.2,ease:'power3.out'},${3*beat});`;
 }
 html=html.replace(`window.__timelines['${id}']=tl;`,motion+`\nwindow.__timelines['${id}']=tl;`);
 if(id==='finish')html=html.replace(/(<div[^>]*class="out-line"[^>]*>)/,'<div class="site-reveal">6390scout.app</div>$1');
 fs.writeFileSync(path.join(dest,'compositions',id+'.html'),html);
}
let css=fs.readFileSync(path.join(previous,'assets/style.css'),'utf8');
css+=`\n/* This cut retains the original visual design. */
.brand{border-bottom-color:#C53645}.site-reveal{position:absolute;left:120px;top:745px;padding:18px 28px;background:#C53645;border:1px solid #EF8292;border-radius:5px;font-size:49px;letter-spacing:-1.5px;font-weight:650}.out-line{top:885px;font-size:53px}footer{font-size:28px}.out-title h1{color:#F2F5FA}
`;
fs.writeFileSync(path.join(dest,'assets/style.css'),css);
const mounts=slots.map(([id,t,len],i)=>`<div id="${id}" class="clip" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${t}" data-duration="${len}" data-track-index="${i+1}" data-track-kind="graphics" data-width="1920" data-height="1080"></div>`).join('\n');
const fx=slots.slice(1).map(([,t],i)=>`<audio id="cut-${i}" class="clip" data-start="${t}" data-duration="0.18" data-track-index="${30+i}" data-volume="0.22" src="assets/soft.ogg"></audio>`).join('\n');
fs.writeFileSync(path.join(dest,'index.html'),`<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Argus — Private hype reveal</title><script src="assets/gsap.min.js"></script><link rel="stylesheet" href="assets/style.css"></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="${duration}" data-width="1920" data-height="1080" data-motion-blur="on" data-motion-blur-shutter="0.35" data-motion-blur-samples="6">${mounts}<audio id="private-song" class="clip" data-start="0" data-duration="${duration}" data-track-index="20" data-volume="0.87" src="assets/private-starboy.mp3"></audio>${fx}</div><script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true});</script></body></html>`);
fs.writeFileSync(path.join(__dirname,'timeline.json'),JSON.stringify({duration,music:'Supplied Starboy MP3 — PRIVATE REVIEW ONLY; no publication or music clearance claimed.',scenes:slots.map(([id,start,duration])=>({id,start,duration}))},null,2));
console.log('Original design retained. Private song attached. Duration: '+duration.toFixed(3)+'s');
