const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {resolveOverride}=require('../scripts/dependency-license-overrides.cjs');
const {generateNotices}=require('../scripts/dependency-notices.cjs');

function fixture(t){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'argus-license-test-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const text='Copyright Example\nPermission is hereby granted, free of charge, to any person obtaining a copy.\n';
  fs.writeFileSync(path.join(directory,'example.txt'),text);
  return {directory,text,pkg:{name:'example',version:'1.2.3',license:'MIT'},entry:{integrity:'sha512-version-pinned'},record:{name:'example',version:'1.2.3',license:'MIT',integrity:'sha512-version-pinned',file:'example.txt',sha256:createHash('sha256').update(text).digest('hex'),sources:[{url:'https://registry.npmjs.org/example/1.2.3',evidence:'Published package license declaration'}]}};
}
test('curated notices apply only to exact package version, declared license and locked integrity',t=>{
  const data=fixture(t);assert.equal(resolveOverride(data).text,data.text);
  assert.throws(()=>resolveOverride({...data,pkg:{...data.pkg,version:'1.2.4'}}),/version/i);
  assert.throws(()=>resolveOverride({...data,pkg:{...data.pkg,license:'ISC'}}),/license/i);
  assert.throws(()=>resolveOverride({...data,entry:{integrity:'sha512-other'}}),/integrity/i);
});
test('tampered license captures and unsafe local file paths fail closed',t=>{
  const data=fixture(t);fs.appendFileSync(path.join(data.directory,'example.txt'),'modified');
  assert.throws(()=>resolveOverride(data),/checksum/i);
  for(const file of ['../outside.txt','subdir/notice.txt','C:\\outside.txt'])assert.throws(()=>resolveOverride({...data,record:{...data.record,file}}),/path/i);
});
test('curated notices require auditable primary-source provenance',t=>{
  const data=fixture(t);
  assert.throws(()=>resolveOverride({...data,record:{...data.record,sources:[]}}),/provenance/i);
  assert.throws(()=>resolveOverride({...data,record:{...data.record,sources:[{url:'http://unknown.example',evidence:''}]}}),/provenance/i);
});
test('notices regenerate deterministically offline and new dependency versions reopen their review gap',t=>{
  const data=fixture(t),root=path.join(data.directory,'app'),pkgDir=path.join(root,'node_modules/example'),gapsFile=path.join(data.directory,'gaps.txt');
  fs.mkdirSync(pkgDir,{recursive:true});fs.writeFileSync(path.join(pkgDir,'package.json'),JSON.stringify(data.pkg));
  const lock={packages:{'node_modules/example':{version:'1.2.3',integrity:data.entry.integrity}}};
  fs.writeFileSync(path.join(root,'package-lock.json'),JSON.stringify(lock));fs.writeFileSync(path.join(data.directory,'manifest.json'),JSON.stringify({packages:[data.record]}));
  const settings={root,supplementDirectory:data.directory,gapsFile};
  assert.deepEqual(generateNotices(settings),{missing:[]});
  const notice=fs.readFileSync(path.join(root,'public/third-party-notices.txt'),'utf8');assert.ok(notice.includes(data.text.trim()));
  generateNotices(settings);assert.equal(fs.readFileSync(path.join(root,'public/third-party-notices.txt'),'utf8'),notice);
  fs.writeFileSync(path.join(pkgDir,'package.json'),JSON.stringify({...data.pkg,version:'1.2.4'}));lock.packages['node_modules/example'].version='1.2.4';fs.writeFileSync(path.join(root,'package-lock.json'),JSON.stringify(lock));
  assert.equal(generateNotices(settings).missing.length,1);assert.match(fs.readFileSync(gapsFile,'utf8'),/example@1.2.4/);
});
