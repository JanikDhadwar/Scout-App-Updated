// Bounded release-tree scan. It reports only rule names and paths, never the
// matching text, so a discovered credential is not copied into CI logs.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const files=execFileSync('git',['ls-files','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
const failures=[];
const forbidden=file=>/(^|\/)(?:db\.json(?:\..*)?|argus-(?:sessions|integrations|push|mfa)\.private\.json(?:\..*)?|\.env)$/.test(file)||/\.(?:pem|key|p12)$/i.test(file);
const patterns=[
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['github-token',/(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/],
 ['aws-access-key',/AKIA[0-9A-Z]{16}/],
];
for(const file of files){
 if(forbidden(file))failures.push({file,rule:'private-artifact'});
 if(!/\.(?:cjs|mjs|js|jsx|ts|tsx|json|md|ya?ml|toml|sh|html|example)$/.test(file)||file.endsWith('package-lock.json')||file.includes('license-notices/')||file.includes('third-party-notices'))continue;
 const value=fs.readFileSync(path.join(root,file),'utf8');
 for(const [rule,pattern]of patterns)if(pattern.test(value))failures.push({file,rule});
 if(file.startsWith('Clasue-scout-app/src/')&&/dangerouslySetInnerHTML|\.innerHTML\s*=/.test(value))failures.push({file,rule:'raw-html-sink'});
}
const dist=path.join(root,'Clasue-scout-app','dist');
if(fs.existsSync(dist)){
 const walk=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())walk(file);else if(/\.(?:js|html|json|css)$/.test(entry.name)){const value=fs.readFileSync(file,'utf8');for(const [rule,pattern]of patterns)if(pattern.test(value))failures.push({file:path.relative(root,file),rule:`build-${rule}`});}}};walk(dist);
}
if(failures.length){for(const item of failures)console.error(`${item.rule}: ${item.file}`);process.exitCode=1;}else console.log(`Security scan passed: ${files.length} tracked files; private artifacts, high-confidence credential forms, raw HTML sinks and server secret names were not found.`);
