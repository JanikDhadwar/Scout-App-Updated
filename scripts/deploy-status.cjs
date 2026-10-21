const fs=require('node:fs');
const path=require('node:path');
const stages=new Set(['starting','fetch','merge','archive','install','test','lint','build','validate','cache_config','cache_purge','restart','health','rollback','idle','complete']);
const states=new Set(['running','failed','succeeded','current']);
const revision=value=>typeof value==='string'&&/^[a-f0-9]{40,64}$/.test(value.trim())?value.trim():null;
function writeDeploymentStatus({stateDir,stage,status,targetRevision,checkoutRevision,candidateRelease,exitCode=0}) {
 if(!stages.has(stage)||!states.has(status))throw new Error('Invalid deployment stage or status.');
 const directory=path.resolve(stateDir),releases=path.join(directory,'releases');
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const filename=path.join(directory,'deployment-status.json');let old={},lastSuccessfulRevision=null;
 try{old=JSON.parse(fs.readFileSync(filename,'utf8'));}catch{/* No prior report yet. */}
 try{lastSuccessfulRevision=revision(fs.readFileSync(path.join(directory,'deployed-revision'),'utf8'));}catch{/* No completed deployment yet. */}
 const event={at:new Date().toISOString(),stage,status,exitCode:Number.isInteger(Number(exitCode))?Number(exitCode):0};
 const events=(Array.isArray(old?.events)?old.events:[]).filter(row=>stages.has(row?.stage)&&states.has(row?.status)&&Number.isFinite(Date.parse(row?.at))).slice(-23).map(row=>({at:new Date(Date.parse(row.at)).toISOString(),stage:row.stage,status:row.status,exitCode:Number.isInteger(row.exitCode)?row.exitCode:0}));
 const report={schemaVersion:1,updatedAt:event.at,stage,status,targetRevision:revision(targetRevision),checkoutRevision:revision(checkoutRevision),lastSuccessfulRevision,exitCode:event.exitCode,events:[...events,event]};
 const serialized=JSON.stringify(report,null,2)+'\n';
 fs.writeFileSync(`${filename}.tmp`,serialized,{mode:0o600});fs.renameSync(`${filename}.tmp`,filename);
 // Only the allowlisted report is public. Command output and private logs stay private.
 for(const release of [path.join(directory,'current'),candidateRelease].filter(Boolean)) {
  try {
   const dist=fs.realpathSync(path.join(release,'Clasue-scout-app','dist'));
   const relative=path.relative(releases,dist);
   if(relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative))continue;
   const publicFile=path.join(dist,'deployment-status.json');
   fs.writeFileSync(`${publicFile}.tmp`,serialized,{mode:0o644});fs.renameSync(`${publicFile}.tmp`,publicFile);
  }catch{/* A candidate build may not exist yet. Keep the persistent report. */}
 }
 return report;
}
module.exports={writeDeploymentStatus};
if(require.main===module){const [stateDir,stage,status,targetRevision,checkoutRevision,candidateRelease,exitCode]=process.argv.slice(2);try{writeDeploymentStatus({stateDir,stage,status,targetRevision,checkoutRevision,candidateRelease,exitCode});}catch{console.error('Could not write deployment diagnostics.');process.exitCode=1;}}
