// Original synthesis only. The supplied commercial MP3 is never copied or mixed.
const fs=require('node:fs'),path=require('node:path');
const privatePcm=path.join(process.env.TEMP,'argus-starboy-reference.f32');
if(fs.existsSync(privatePcm)){
 const b=fs.readFileSync(privatePcm),win=256,rate=11025,e=[];
 for(let p=0;p+win*4<b.length;p+=win*4){let s=0;for(let i=0;i<win;i++){const x=b.readFloatLE(p+i*4);s+=x*x;}e.push(Math.sqrt(s/win));}
 const onset=e.map((x,i)=>Math.max(0,x-(e[i-1]||0)));const candidates=[];
 for(let bpm=85;bpm<=125;bpm++){const lag=Math.round(60/bpm*rate/win);let s=0;for(let i=lag;i<onset.length;i++)s+=onset[i]*onset[i-lag];candidates.push({bpm,correlation:s});}
 candidates.sort((a,b)=>b.correlation-a.correlation);
 const peaks=onset.map((strength,i)=>({time:+(i*win/rate).toFixed(3),strength})).filter((p,i)=>i>0&&p.strength>onset[i-1]&&p.strength>(onset[i+1]||0)).sort((a,b)=>b.strength-a.strength).slice(0,30).sort((a,b)=>a.time-b.time);
 fs.writeFileSync(path.join(__dirname,'music-timing.json'),JSON.stringify({reference:'Private Starboy timing analysis only; no reference audio distributed.',method:'Short-window RMS rise and tempo autocorrelation; estimated rather than manual beat transcription.',tempoCandidates:candidates.slice(0,6),strongOnsets:peaks,originalScoreBpm:96,editorialImpacts:[4.375,6.875,8.375,18.125,26.875,35,45,53.125]},null,2));
}
const sr=44100,duration=57,n=sr*duration,L=new Float64Array(n),R=new Float64Array(n);let seed=6390;
const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
function add(start,len,fn,pan=0){let at=Math.round(start*sr),count=Math.min(Math.round(len*sr),n-at);for(let i=0;i<count;i++){const v=fn(i/sr,i);L[at+i]+=v*(1-pan*.3);R[at+i]+=v*(1+pan*.3);}}
const beat=.625;
for(let k=0;k<92;k++){
 const t=k*beat;if(t>=56.25)break;const energy=t<4.375?.45:t>53.125?.65:1;
 add(t,.38,x=>Math.sin(2*Math.PI*(47*x+5*(1-Math.exp(-x*36))))*Math.exp(-x*13)*.65*energy);
 if(k%4===1||k%4===3)add(t,.18,x=>(noise()*.5+Math.sin(x*2*Math.PI*175)*.22)*Math.exp(-x*25)*energy);
 for(let h=0;h<2;h++)add(t+h*beat/2,.065,x=>noise()*Math.exp(-x*85)*.11*energy,(h?1:-1)*.6);
 const notes=[36,36,43,39,34,34,41,38],midi=notes[Math.floor(k/2)%notes.length],f=440*2**((midi-69)/12);
 add(t+.012,.48,x=>{const env=Math.min(1,x*100)*Math.exp(-x*7);return (Math.sin(x*2*Math.PI*f)+.18*Math.sin(x*2*Math.PI*f*2))*env*.23*energy;});
 if(k%4===0){const chord=[[60,63,67],[58,62,65],[55,58,62],[56,60,63]][Math.floor(k/4)%4];for(const [i,m]of chord.entries()){const hz=440*2**((m-69)/12);add(t,.85,x=>Math.sin(x*2*Math.PI*hz)*Math.min(x*40,1)*Math.exp(-x*5)*.035*energy,(i-1)*.6);}}
}
for(const t of [4.375,6.875,8.375,18.125,26.875,35,45,53.125]){
 add(t,.55,x=>(Math.sin(2*Math.PI*(37*x+2*(1-Math.exp(-x*20))))*.32+noise()*.08)*Math.exp(-x*10));
 if(t>.5)add(t-.22,.22,x=>noise()*(x/.22)**2*.17);
}
const wav=Buffer.alloc(44+n*4);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(sr,24);wav.writeUInt32LE(sr*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*4,40);
for(let i=0;i<n;i++){const t=i/sr,fade=Math.min(1,t/.04,(duration-t)/1.2);wav.writeInt16LE(Math.round(Math.tanh(L[i]*1.2)*.86*fade*32767),44+i*4);wav.writeInt16LE(Math.round(Math.tanh(R[i]*1.2)*.86*fade*32767),46+i*4);}
fs.writeFileSync(path.join(__dirname,'assets/original-score.wav'),wav);console.log('57-second original score created.');
