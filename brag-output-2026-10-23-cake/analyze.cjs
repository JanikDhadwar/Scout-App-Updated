const fs=require('node:fs'),path=require('node:path');
const b=fs.readFileSync(path.join(process.env.TEMP,'argus-cake-bass.f32')),rate=11025,hop=110,energy=[];
for(let at=0;at+hop*4<b.length;at+=hop*4){let sum=0;for(let i=0;i<hop;i++)sum+=b.readFloatLE(at+i*4)**2;energy.push(Math.sqrt(sum/hop));}
const flux=energy.map((x,i)=>Math.max(0,Math.log(1+x*100)-Math.log(1+(energy[Math.max(0,i-3)]||0)*100)));
const dt=hop/rate;
function impulse(t){let peak=0;const c=Math.round(t/dt);for(let j=-3;j<=3;j++)peak=Math.max(peak,(flux[c+j]||0)*(1-Math.abs(j)*.16));return peak;}
let best={score:-1};
for(let bpm=116;bpm<=122;bpm+=.02){let beat=60/bpm;for(let phase=0;phase<beat;phase+=.01){let score=0,count=0;for(let t=phase+Math.ceil((16-phase)/beat)*beat;t<90;t+=beat){score+=impulse(t)-impulse(t+beat*.25)*.15;count++;}score/=count;if(score>best.score)best={bpm:+bpm.toFixed(2),phase:+phase.toFixed(3),beat,score};}}
const hits=[];for(let t=best.phase;t<100;t+=best.beat)hits.push({time:+t.toFixed(4),strength:+impulse(t).toFixed(4)});
const sections=[];for(let t=30;t<85;t+=2){const s=energy.slice(Math.round(t/dt),Math.round((t+2)/dt));sections.push({time:t,bassRms:+(s.reduce((a,b)=>a+b,0)/s.length).toFixed(4)});}
const result={method:'Bass-band positive log-energy flux; tempo/phase fitted over 16–90 seconds of the supplied file. Beat times are measured estimates, quantized to video frames during editing.',...best,hits,sections};
fs.writeFileSync(path.join(__dirname,'audio-analysis.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({bpm:best.bpm,phase:best.phase,chorusWindow:hits.filter(x=>x.time>46&&x.time<51),sections}));
