import test from 'node:test';
import assert from 'node:assert/strict';
import {watchLive} from './live-updates.js';
test('foreground refresh skips hidden/offline devices, prevents overlap and cleans up listeners',async()=>{
 const names=['window','document','navigator','setInterval','clearInterval'],originals=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const window=new EventTarget(),document=Object.assign(new EventTarget(),{hidden:false}),navigator={onLine:true};let timer,cleared=false,calls=0,finish;
 const values={window,document,navigator,setInterval:callback=>{timer=callback;return 1;},clearInterval:()=>{cleared=true;}};
 for(const name of names)Object.defineProperty(globalThis,name,{value:values[name],configurable:true,writable:true});
 let stop;
 try{
  stop=watchLive(async()=>{calls++;if(calls===1)await new Promise(resolve=>{finish=resolve;});});
  await Promise.resolve();assert.equal(calls,1);window.dispatchEvent(new Event('focus'));timer();assert.equal(calls,1);
  finish();await Promise.resolve();await Promise.resolve();await Promise.resolve();
  document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));assert.equal(calls,1);
  document.hidden=false;navigator.onLine=false;window.dispatchEvent(new Event('online'));assert.equal(calls,1);
  navigator.onLine=true;window.dispatchEvent(new Event('online'));assert.equal(calls,2);await Promise.resolve();
  stop();window.dispatchEvent(new Event('focus'));timer();assert.equal(calls,2);assert.equal(cleared,true);
 }finally{stop?.();for(const name of names){const descriptor=originals.get(name);if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
});
