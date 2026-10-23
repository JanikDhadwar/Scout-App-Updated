// A new musical edit of the preferred Argus trailer, not a soundtrack replacement.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const previous=path.resolve(__dirname,'../brag-output-2026-10-23-044114/composition'),dest=path.join(__dirname,'composition');
const analysis=JSON.parse(fs.readFileSync(path.join(__dirname,'audio-analysis.json'),'utf8'));
const beat=60/analysis.bpm,frame=t=>Math.round(t*30)/30;
// The first chorus follows the 72-beat lead-in point by two bars.
const sourceStart=analysis.phase+76*beat,total=frame(68*beat),robotEnd=frame(12*beat),robotStart=robotEnd-4;
const slots=[['home',0,robotStart],['play',robotStart,4],['entry',frame(12*beat),frame(20*beat)-frame(12*beat)]];
for(const [id,a,b]of [['crew',20,28],['pits',28,36],['evidence',36,44],['picks',44,52],['montage',52,60],['finish',60,68]])slots.push([id,frame(a*beat),frame(b*beat)-frame(a*beat)]);
fs.mkdirSync(dest,{recursive:true});for(const n of ['assets','compositions'])fs.cpSync(path.join(previous,n),path.join(dest,n),{recursive:true});for(const n of ['hyperframes.json','package.json'])fs.copyFileSync(path.join(previous,n),path.join(dest,n));
execFileSync('ffmpeg',['-y','-ss',String(sourceStart),'-i','C:/Users/Janik/Downloads/SpotiDown.App - Cake By The Ocean - DNCE.mp3','-t',String(total),'-af',`afade=t=in:st=0:d=0.04,afade=t=out:st=${total-.26}:d=0.26`,'-c:a','libmp3lame','-q:a','2',path.join(dest,'assets/private-cake.mp3'),'-loglevel','error'],{windowsHide:true});
// Exclude the previous substitute score from this private edit.
const oldMusic=path.join(dest,'assets/music.mp3');if(fs.existsSync(oldMusic))fs.unlinkSync(oldMusic);
const at=n=>frame(n*beat),fade=(selector,t=0,x=0,y=0,d=.24)=>`tl.fromTo('${selector}',{x:${x},y:${y},opacity:0},{x:0,y:0,opacity:1,duration:${d},ease:'power3.out'},${t});`;
const swap=(out,into,t,d=.1)=>`tl.to('${out}',{opacity:0,duration:${d}},${t});tl.fromTo('${into}',{opacity:0},{opacity:1,duration:${d}},${t});`;
const punch=(selector,t,s=1.035)=>`tl.to('${selector}',{scale:${s},duration:.1,ease:'power3.out'},${t});tl.to('${selector}',{scale:1,duration:.18,ease:'power2.out'},${t+.1});`;
const cues=[];
for(const [id,start,duration]of slots){
 if(id==='montage'){
  const shots=[['assignments','Assignments'],['scout-filled','Scouting'],['admin','Your crew'],['pit','Pit visits'],['comparison','Compare'],['picklist','Picklist'],['practice','Practice'],['help','Offline help']];
  const cards=shots.map(([image,label],i)=>`<div id="montage-${i}" class="clip montage-card" data-start="${at(i)}" data-duration="${i===7?duration-at(i):at(i+1)-at(i)}" data-track-index="${i+1}"><h1>${label}</h1><img src="assets/screens/${image}.png" alt="Argus ${label}"></div>`).join('')+'<div class="montage-label" style="z-index:20">Argus · Illustrative app demo · Private review</div>';
  fs.writeFileSync(path.join(dest,'compositions/montage.html'),`<template><style>#root{position:absolute;inset:0}.montage-card{background:#0B1018}.montage-card h1{position:absolute;left:110px;top:80px;font-size:100px;letter-spacing:-3px;margin:0;border-left:10px solid #C53645;padding-left:28px}.montage-card img{position:absolute;left:110px;top:250px;width:1700px;height:720px;object-fit:cover;object-position:top;border:2px solid #52647C;border-radius:10px}.montage-label{position:absolute;left:110px;bottom:42px;font-size:28px;color:#A7B5C8}</style><div id="root" data-composition-id="montage" data-width="1920" data-height="1080">${cards}</div><script>const tl=gsap.timeline({paused:true});window.__timelines.montage=tl;</script></template>`);
  continue;
 }
 let html=fs.readFileSync(path.join(previous,'compositions',id+'.html'),'utf8').replaceAll('Illustrative app demo','Illustrative app demo · Private review');
 html=html.replaceAll('Team XP and phase ratings.','XP · Phases').replaceAll('World and regional ranks.','World · Regions');
 // Shorter labels remain readable during the quicker chorus montage.
 html=html.replaceAll('✓ Reconnected · Upload confirmed','✓ Upload confirmed').replaceAll('Request sent · Pending','Request pending').replaceAll('✓ Accepted · Match covered','✓ Match covered').replaceAll('Show when: Climbed = Yes','Climbed = Yes').replaceAll('Your upcoming matches and Match13 predictions.','Upcoming match predictions.').replaceAll('Team XP and phase ratings.<br>World and regional ranks.','XP · Phases<br>World · Regions').replaceAll('Create scoring picklist','Create picklist');
 html=html.replaceAll('Your event. Every screen.','Every screen.').replaceAll('A crew. Not a crowd.','Your crew.').replaceAll('Know the robot beyond the match.','Pit scouting.').replaceAll('Turn reports into a clearer picture.','Compare teams.').replaceAll('Bring evidence to alliance selection.','Alliance selection.');
 html=html.replaceAll('Preview before applying.','Preview assignments.').replaceAll('One match only.','One match.').replaceAll('Handoff team 6390','Team 6390').replaceAll('Custom scouting forms','Custom forms').replaceAll('Team 6390 · Pit evidence','Pit evidence').replaceAll('Trace every number','Source reports').replaceAll('Upcoming match predictions.','Predictions.').replaceAll('Take the evidence into your strategy meeting.','Team presentations.');
 let script="const tl=gsap.timeline({paused:true});";
 if(id==='home'){
  script+=fade('.title',0,0,22,.18);
  script+=`tl.fromTo('#home-laptop',{x:190,y:75,rotation:-6,scale:.88,opacity:0},{x:0,y:0,rotation:0,scale:1,opacity:1,duration:.45,ease:'power4.out'},0);`;
  script+=`tl.fromTo('#home-tablet',{x:-150,y:80,rotation:7,scale:.9,opacity:0},{x:0,y:0,rotation:0,scale:1,opacity:1,duration:.22,ease:'power4.out'},${at(1)});`;
  script+=`tl.fromTo('#home-phone',{x:-100,y:130,rotation:8,scale:.9,opacity:0},{x:0,y:0,rotation:0,scale:1,opacity:1,duration:.22,ease:'power4.out'},${at(2)});`;
  script+=punch('#home-phone',at(3),1.06);
  script+=`tl.to('.device-stage',{scale:1.16,y:-12,opacity:0,duration:.16,ease:'power3.in'},${duration-.16});`;
  cues.push({event:'Device reveals',times:[0,at(1),at(2)],songTimes:[sourceStart,sourceStart+at(1),sourceStart+at(2)]});
 }else if(id==='play'){
  const hit=frame(9*beat)-start;
  script+=fade('.film-label',.04,-45,0,.18)+punch('.film',hit,1.035);
  script+=`tl.to('.film',{x:6,duration:.035},${hit});tl.to('.film',{x:-4,duration:.035},${hit+.035});tl.to('.film',{x:0,duration:.07},${hit+.07});`;
  // Lower source sound under the new music, retaining the exact 67–71s picture.
  html=html.replace('data-volume="0.18"','data-volume="0.07"');
  cues.push({event:'6390 scoring impact',time:start+hit,songTime:sourceStart+start+hit,sourceVideoTime:67+hit});
 }else if(id==='entry'){
  script+=fade('.reference',0,-70,0,.22)+fade('.entry',.04,100,0,.25);
  script+=`tl.fromTo('#tap-entry',{x:790,y:550,opacity:0},{x:765,y:237,opacity:1,duration:.3,ease:'power3.inOut'},${at(1)});`;
  script+=swap('#v10','#v11',at(1),.07)+swap('#v11','#v12',at(2),.07);
  script+=`tl.fromTo('#defense-yes',{opacity:0},{opacity:1,duration:.1},${at(3)});tl.to('#tap-entry',{x:630,y:515,duration:.18,ease:'power3.inOut'},${at(4)});`;
  script+=fade('#entry-pending',at(5),0,8,.1)+swap('#entry-pending','#entry-synced',at(6),.08)+`tl.to('#tap-entry',{opacity:0,duration:.08},${at(5)+.1});`;
  script+=punch('.entry',at(2),1.025);
  cues.push({event:'Scouting increments, defense, save and upload',times:[1,2,3,5,6].map(n=>start+at(n))});
 }else if(id==='crew'){
  script+=fade('#crew-screen',0,-100,0,.25)+fade('#randomize-panel',.05,80,0,.25);
  script+=swap('#preview-action','#apply-action',at(2),.1);
  script+=`tl.to('#randomize-panel',{x:-45,opacity:0,duration:.15,ease:'power3.in'},${at(4)-.15});`+fade('#handoff-panel',at(4),55,0,.19);
  script+=swap('#handoff-request','#handoff-ok',at(6),.1)+punch('#handoff-ok',at(6),1.025);
  cues.push({event:'Apply assignment, handoff reveal and acceptance',times:[2,4,6].map(n=>start+at(n))});
 }else if(id==='pits'){
  script+=fade('#pit-screen',0,0,60,.24)+fade('#form-editor',.04,0,-45,.24)+fade('#condition',at(2),30,0,.14);
  script+=`tl.to('#form-editor',{y:-40,opacity:0,duration:.15,ease:'power3.in'},${at(4)-.15});`+fade('#pit-observations',at(4),0,50,.2);
  script+=punch('#pit-observations',at(6),1.025);
 }else if(id==='evidence'){
  script+=fade('#analytics-view',0,75,0,.25)+fade('#evidence-details',.05,55,0,.22);
  script+=`tl.to('#analytics-view',{x:-80,opacity:0,duration:.15,ease:'power3.in'},${at(4)-.15});`+fade('#comparison-view',at(4),80,0,.2);
  script+=`tl.to('#evidence-details',{opacity:0,duration:.1},${at(5)-.1});`+fade('#pit-prediction',at(5),40,0,.18);
  cues.push({event:'Comparison and Pit Display predictions',times:[4,5].map(n=>start+at(n))});
 }else if(id==='picks'){
  script+=fade('#strategy-view',0,-75,0,.25)+fade('.export',.05,65,0,.25);
  script+=`tl.fromTo('#pick-callout',{y:35,scale:.92,opacity:0},{y:0,scale:1,opacity:1,duration:.22,ease:'power3.out'},${at(2)});`;
  script+=swap('#generate-pick','#ready-pick',at(4),.1)+fade('#export-ready',at(6),0,10,.15);
  cues.push({event:'Picklist generation and exports',times:[4,6].map(n=>start+at(n))});
 }else{
  html=html.replace(/(<div[^>]*class="out-line"[^>]*>)/,'<div class="site-reveal">6390scout.app</div>$1');
  script+=fade('.out-title',0,0,25,.22);
  for(const [j,device]of ['laptop','tablet','phone'].entries())script+=`tl.fromTo('#out-${device}',{x:${j===0?130:-90},y:55,rotation:${j===0?-5:6},opacity:0},{x:0,y:0,rotation:0,opacity:1,duration:.4,ease:'power4.out'},${at(j)});`;
  script+=fade('.more-tools',at(2),0,20,.15)+fade('.out-line',at(2),0,15,.15)+fade('.site-reveal',at(3),0,30,.14);
  script+=punch('.site-reveal',at(3),1.04);
  cues.push({event:'Website reveal',time:start+at(3),songTime:sourceStart+start+at(3)});
 }
 // Discrete camera cuts on musical beats replace long static feature framings.
 const cameras={
  entry:[[1,1.35,-360,0],[2,1.7,-820,70],[3,1.35,-360,-95],[4,1.5,-520,-140],[5,1.4,-420,-220],[6,1.3,-340,-220],[7,1,0,0]],
  crew:[[1,1.35,-390,-60],[2,1.5,-560,-150],[3,1,0,0],[4,1.35,-390,-80],[5,1.5,-580,-130],[6,1.35,-390,-160],[7,1,0,0]],
  pits:[[1,1.3,-300,-60],[2,1.5,-440,-90],[3,1,0,0],[4,1.4,-400,-80],[5,1.55,-500,-120],[6,1.15,150,-60],[7,1,0,0]],
  evidence:[[1,1.35,190,-90],[2,1.4,-430,-70],[3,1,0,0],[4,1.3,190,-100],[5,1.35,-390,-80],[6,1.45,-520,-150],[7,1,0,0]],
  picks:[[1,1.25,160,-90],[2,1.4,220,-190],[3,1.5,240,-210],[4,1.25,-350,-70],[5,1.45,-520,-70],[6,1.45,-520,-150],[7,1,0,0]]
 };
 for(const [b,scale,x,y]of cameras[id]||[])script+=`tl.set('.stage',{scale:${scale},x:${x},y:${y},transformOrigin:'50% 50%'},${at(b)});`;
 script+=`window.__timelines['${id}']=tl;`;
 html=html.replace(/<script>[\s\S]*?<\/script>/,`<script>${script}</script>`);
 if(cameras[id]){
  // Headlines and disclosure stay fixed while the product camera cuts beneath them.
  const fixed=[];
  for(const regex of [/<header\b[^>]*>[\s\S]*?<\/header>/,/<footer\b[^>]*>[\s\S]*?<\/footer>/,/<div[^>]*class="title"[^>]*>[\s\S]*?<\/div>/])html=html.replace(regex,match=>{fixed.push(match);return '';});
  html=html.replace('</div></div><script>',`</div><div class="fixed-frame">${fixed.join('')}</div></div><script>`);
  html=html.replace(/(<div[^>]*class="stage"[^>]*>)/,'<div class="camera-window">$1').replace('</div><div class="fixed-frame">','</div></div><div class="fixed-frame">');
  html=html.replaceAll('Team 6390 · Scoring observed','Team 6390').replaceAll('Match and pit scouting','Scouting');
 }
 fs.writeFileSync(path.join(dest,'compositions',id+'.html'),html);
}
let css=fs.readFileSync(path.join(previous,'assets/style.css'),'utf8');css+=`\n.brand{border-bottom-color:#C53645}.site-reveal{position:absolute;left:120px;top:745px;padding:18px 28px;background:#C53645;border:1px solid #EF8292;border-radius:5px;font-size:49px;letter-spacing:-1.5px;font-weight:650}.out-line{top:885px;font-size:53px}.fixed-frame{position:absolute;inset:0;pointer-events:none;z-index:50}.fixed-frame .brand,.fixed-frame footer{background:#0B1018}.fixed-frame .title{background:#0B1018;padding-bottom:16px}`;
css+=`.camera-window{position:absolute;left:0;top:315px;width:1920px;height:665px;overflow:hidden}.camera-window .stage{inset:auto;left:0;top:-315px;width:1920px;height:1080px}`;
fs.writeFileSync(path.join(dest,'assets/style.css'),css);
const hosts=slots.map(([id,start,duration],i)=>`<div id="${id}" class="clip" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${start}" data-duration="${duration}" data-track-index="${i+1}" data-track-kind="graphics" data-width="1920" data-height="1080"></div>`).join('\n');
const sfx=slots.slice(2).map(([,start],i)=>`<audio id="transition-${i}" class="clip" data-start="${start}" data-duration="0.18" data-track-index="${30+i}" data-volume="0.12" src="assets/soft.ogg"></audio>`).join('\n');
fs.writeFileSync(path.join(dest,'index.html'),`<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Argus — Cake By The Ocean private reveal</title><script src="assets/gsap.min.js"></script><link rel="stylesheet" href="assets/style.css"></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1920" data-height="1080" data-motion-blur="on" data-motion-blur-shutter="0.35" data-motion-blur-samples="6">${hosts}<audio id="cake-song" class="clip" data-start="0" data-duration="${total}" data-track-index="20" data-volume="0.9" src="assets/private-cake.mp3"></audio>${sfx}</div><script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true});</script></body></html>`);
fs.writeFileSync(path.join(__dirname,'timeline.json'),JSON.stringify({sourceAudio:'User-supplied Cake By The Ocean — DNCE MP3. Private review only.',bpm:analysis.bpm,beatPhase:analysis.phase,sourceStart,sourceEnd:sourceStart+total,duration:total,scenes:slots.map(([id,start,duration])=>({id,start,duration})),actionCues:cues},null,2));
console.log(JSON.stringify({bpm:analysis.bpm,sourceStart,duration:total,scenes:slots}));
