const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');

let directory, routes, images, precached;
test.before(async()=>{
  directory=fs.mkdtempSync(path.join(os.tmpdir(),'argus-pwa-policy-'));
  const {build}=await import('vite');
  await build({root:__dirname,logLevel:'silent',build:{outDir:directory,emptyOutDir:true}});
  routes=[];images=[];precached=[];
  const workbox={setCacheNameDetails(){},clientsClaim(){},cleanupOutdatedCaches(){},precacheAndRoute(entries){precached=entries;},registerRoute(match,handler){routes.push({match,handler});},createHandlerBoundToURL(){return()=>{};},NavigationRoute:class{},NetworkFirst:class{constructor(options){images.push(options.cacheName);}},CacheableResponsePlugin:class{},ExpirationPlugin:class{}};
  const sandbox={self:{location:{href:'https://argus.example/sw.js'},addEventListener(){}},importScripts(){},define(_dependencies,run){run(workbox);},URL};
  vm.runInNewContext(fs.readFileSync(path.join(directory,'sw.js'),'utf8'),sandbox);
});
test.after(()=>{if(directory)fs.rmSync(directory,{recursive:true,force:true});});

test('installed worker never caches private or arbitrary image requests across account switches',()=>{
  for(const target of ['https://argus.example/api/media/private.png','https://other.example/scout-image.jpg']){
    const input={request:{destination:'image'},url:new URL(target)};
    const cached=routes.some(({match})=>typeof match==='function'&&match(input));
    assert.equal(cached,false,`Private/runtime media must bypass shared CacheStorage: ${target}`);
  }
  assert.ok(precached.some(entry=>entry.url==='index.html'),'The public app shell remains available offline.');
  assert.ok(!precached.some(entry=>entry.url.startsWith('api/')));
});

test('worker activation removes all historical image caches without touching unrelated caches or IndexedDB',async()=>{
  const keys=['scout-images','argus-images-previous',...images,'argus-app-shell','unrelated-cache'];
  const retained=new Set(keys);
  let activation,completion;
  const sandbox={self:{addEventListener(event,run){if(event==='activate')activation=run;}},caches:{keys:async()=>keys,delete:async key=>retained.delete(key)},indexedDB:{deleteDatabase(){assert.fail('Worker upgrades must preserve draft/queue storage.');}}};
  vm.runInNewContext(fs.readFileSync(path.join(directory,'argus-cache-cleanup.js'),'utf8'),sandbox);
  activation({waitUntil(work){completion=work;}});await completion;
  assert.deepEqual([...retained].sort(),['argus-app-shell','unrelated-cache']);
});

test('install manifest resolves compatible sized raster and maskable icons and Apple touch icon',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.webmanifest'),'utf8'));
  for(const [size,purpose]of [['192x192','any'],['512x512','any'],['512x512','maskable']]){
    const icon=manifest.icons.find(value=>value.sizes===size&&value.purpose===purpose&&value.type==='image/png');
    assert.ok(icon,`Missing install icon ${size} ${purpose}`);
    const data=fs.readFileSync(path.join(directory,icon.src.replace(/^\//,'')));
    assert.equal(data.subarray(1,4).toString(),'PNG');
    assert.equal(data.readUInt32BE(16),Number(size.split('x')[0]));
    assert.equal(data.readUInt32BE(20),Number(size.split('x')[1]));
  }
  const html=fs.readFileSync(path.join(directory,'index.html'),'utf8');
  const apple=html.match(/<link\b[^>]*rel="apple-touch-icon"[^>]*href="([^"]+)"/);
  assert.ok(apple,'Apple home-screen installation has a touch icon.');
  const data=fs.readFileSync(path.join(directory,apple[1].replace(/^\//,'')));
  assert.equal(data.readUInt32BE(16),180);
  assert.equal(data.readUInt32BE(20),180);
});
