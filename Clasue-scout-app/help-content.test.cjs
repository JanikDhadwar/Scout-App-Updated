const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const bundled=require('./help-content.json');
test('offline instruction snapshot matches Markdown sources and every relative topic link resolves',()=>{
  const root=path.resolve(__dirname,'../instructions');
  assert.ok(bundled['contents.md']);
  if(fs.existsSync(root)){
    assert.deepEqual(Object.keys(bundled).sort(),fs.readdirSync(root).filter(n=>n.endsWith('.md')).sort());
    for(const [name,content]of Object.entries(bundled))assert.equal(content,fs.readFileSync(path.join(root,name),'utf8'),`${name}: update the bundled help snapshot with documentation changes`);
  }
  for(const [name,content]of Object.entries(bundled))for(const link of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g))assert.ok(bundled[link[1]],`${name}: broken topic link ${link[1]}`);
});
