const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {validateImageDataUrl}=require('./media-validation.cjs');

const data=(type,buffer)=>`data:image/${type};base64,${buffer.toString('base64')}`;
function png(width=1,height=1){const b=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');b.writeUInt32BE(width,16);b.writeUInt32BE(height,20);return b;}

test('tracked frontend source contains no unapproved raw HTML rendering sink',()=>{
 const root=path.join(__dirname,'src'),files=[];
 const walk=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())walk(file);else if(/\.(?:js|jsx|ts|tsx)$/.test(entry.name))files.push(file);}};walk(root);
 for(const file of files)assert.doesNotMatch(fs.readFileSync(file,'utf8'),/dangerouslySetInnerHTML|\.innerHTML\s*=/,path.relative(__dirname,file));
});

test('image validation checks decoded type, size, canonical encoding and dimensions',()=>{
 assert.equal(validateImageDataUrl(data('png',png())),true);
 assert.equal(validateImageDataUrl(data('jpeg',png())),false,'MIME spoofing rejected');
 assert.equal(validateImageDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='),false);
 assert.equal(validateImageDataUrl('data:image/png;base64,not base64'),false);
 assert.equal(validateImageDataUrl(data('png',png(5000,1))),false);
 assert.equal(validateImageDataUrl(data('png',png(4096,4096))),false,'pixel budget enforced');
 assert.equal(validateImageDataUrl(data('png',Buffer.alloc(4_500_001))),false);
});
