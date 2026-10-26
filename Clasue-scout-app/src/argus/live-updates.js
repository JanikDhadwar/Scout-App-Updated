// One request at a time, only while a device is foregrounded and online.
export function watchLive(task,interval=10000){
 let stopped=false,running=false;
 async function run(){
  if(stopped||running||document.hidden||navigator.onLine===false)return;
  running=true;try{await task();}catch{/* The caller keeps downloaded data and exposes freshness. */}finally{running=false;}
 }
 const timer=setInterval(run,interval);
 window.addEventListener('focus',run);window.addEventListener('online',run);document.addEventListener('visibilitychange',run);
 queueMicrotask(run);
 return()=>{stopped=true;clearInterval(timer);window.removeEventListener('focus',run);window.removeEventListener('online',run);document.removeEventListener('visibilitychange',run);};
}
