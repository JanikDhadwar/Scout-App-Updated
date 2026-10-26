// Reproduce third-party notices from the installed, locked dependency tree.
// Includes build dependencies because generated PWA files may bundle their code.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../Clasue-scout-app');
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const sections=['Argus third-party dependency notices','Generated from package-lock.json and installed package license/notice files.','This inventory grants no license to Argus itself, trademarks, submitted photos, or promotional music.','Includes runtime and development dependencies; inclusion does not mean every package is delivered to browsers.'];
const missing=[];
for(const [relative,entry]of Object.entries(lock.packages||{}).sort(([a],[b])=>a.localeCompare(b))){
 if(!relative||entry.link)continue;
 const directory=path.join(root,relative),manifest=path.join(directory,'package.json');
 if(!fs.existsSync(manifest)){if(!entry.optional)missing.push(`${relative}: not installed`);continue;}
 const pkg=JSON.parse(fs.readFileSync(manifest,'utf8'));
 if(pkg.version!==entry.version)throw Error(`Installed version differs from lock: ${relative}`);
 const files=fs.readdirSync(directory).filter(name=>/^(licen[cs]e|copying|notice)(\.|$|-)/i.test(name)&&fs.statSync(path.join(directory,name)).isFile());
 sections.push(`\n${'='.repeat(72)}\n${pkg.name} ${pkg.version}\nLicense: ${typeof pkg.license==='string'?pkg.license:'not declared'}\n${relative}`);
 if(!files.length)missing.push(`${pkg.name}@${pkg.version}: no top-level license/notice file; inspect upstream`);
 for(const name of files)sections.push(`--- ${name} ---\n${fs.readFileSync(path.join(directory,name),'utf8')}`);
}
fs.mkdirSync(path.join(root,'public'),{recursive:true});
fs.writeFileSync(path.join(root,'public','third-party-notices.txt'),sections.join('\n\n')+'\n');
fs.writeFileSync(path.resolve(__dirname,'../docs/argus-2/dependency-notice-gaps.txt'),missing.join('\n')+'\n');
console.log(`Wrote dependency notices; ${missing.length} packages require manual license-file review.`);
