const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createSessions}=require('./private-sessions.cjs');
const {validateImageDataUrl}=require('./media-validation.cjs');
const {validateMetricConfig}=require('./intelligence-validation.cjs');

test('unknown session cookies cause no persistence while real deletion remains durable',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'argus-session-regression-')),file=path.join(dir,'sessions.json');
 try{const sessions=createSessions(file);assert.equal(sessions.delete('unknown'),false);assert.equal(fs.existsSync(file),false);sessions.set('real',{userId:'u',expires:Date.now()+60000});const before=fs.readFileSync(file,'utf8');assert.equal(sessions.delete('unknown'),false);assert.equal(fs.readFileSync(file,'utf8'),before);assert.equal(sessions.delete('real'),true);assert.equal(createSessions(file).get('real'),undefined);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('VP8 and VP8L use actual dimensions and reject oversized, truncated or malformed headers',()=>{
 const lossy=Buffer.from('UklGRjgAAABXRUJQVlA4ICwAAABwAQCdASoCAAMAAUAmJaACdAFAAAD+/HaP/7B3//nAf/84D+mDyzOFefAAAA==','base64');
 const lossless=Buffer.from('UklGRhwAAABXRUJQVlA4TA8AAAAvAYAAAAcQUcD+ByKi/wEA','base64');
 const valid=buffer=>validateImageDataUrl(`data:image/webp;base64,${buffer.toString('base64')}`);
 assert.equal(valid(lossy),true);assert.equal(valid(lossless),true);
 const wide=Buffer.from(lossy);wide.writeUInt16LE(5000,26);assert.equal(valid(wide),false);
 const tall=Buffer.from(lossless);tall.writeUInt32LE(((5000-1)<<14)|1,21);assert.equal(valid(tall),false);
 const bomb=Buffer.from(lossless);bomb.writeUInt32LE(((4096-1)<<14)|(4096-1),21);assert.equal(valid(bomb),false);
 const truncated=lossless.subarray(0,16);truncated.writeUInt32LE(8,4);assert.equal(valid(truncated),false);
 const forged=Buffer.from(lossless);forged[20]=0;assert.equal(valid(forged),false);
});
test('direct metric writes reject unbounded, mismatched and overlapping insight definitions',()=>{
 const forms=[{id:'f',questions:[{id:'x',type:'select',options:['Yes','No']},{id:'n',type:'number'}]}];
 const base={kind:'success_rate',strength:.8,concern:.5,outcomes:{Yes:'success',No:'failure'}};
 assert.equal(validateMetricConfig({'f:x':{insight:base}},forms),null);
 assert.ok(validateMetricConfig({'foreign:x':{insight:base}},forms));
 assert.ok(validateMetricConfig({'f:x':{insight:{...base,strength:2}}},forms));
 assert.ok(validateMetricConfig({'f:x':{insight:{...base,strength:.4}}},forms));
 assert.ok(validateMetricConfig({'f:x':{insight:{...base,outcomes:{Injected:'success'}}}},forms));
 assert.ok(validateMetricConfig({'f:n':{insight:{kind:'mean',strength:10,concern:4}}},forms));
});
