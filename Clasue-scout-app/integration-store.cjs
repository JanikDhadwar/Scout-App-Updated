const fs=require('node:fs');
const path=require('node:path');
const fields=['TBA_API_KEY','MATCH13_API_KEY'];
function createIntegrationStore(filename) {
  function read(){if(!fs.existsSync(filename))return {};try{const value=JSON.parse(fs.readFileSync(filename,'utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{throw new Error('Private integration settings could not be read. Existing settings were preserved.');}}
  function key(workspaceId,name){return read()[workspaceId]?.[name];}
  function status(workspaceId){return {tbaConfigured:!!key(workspaceId,'TBA_API_KEY'),groqConfigured:false,match13Configured:!!key(workspaceId,'MATCH13_API_KEY')};}
  function save(workspaceId,values){
    if(typeof workspaceId!=='string'||!workspaceId||['__proto__','constructor','prototype'].includes(workspaceId))throw new Error('Invalid workspace.');
    const patch={};for(const field of fields){if(values[field]==null||values[field]==='')continue;if(typeof values[field]!=='string'||values[field].length>512||/[\r\n\0]/.test(values[field]))throw new Error('Invalid integration setting.');const value=values[field].trim();if(!value)continue;patch[field]=value;}
    const all=read();all[workspaceId]={...(Object.hasOwn(all,workspaceId)?all[workspaceId]:{}),...patch};
    fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});fs.writeFileSync(`${filename}.tmp`,JSON.stringify(all),{mode:0o600});fs.renameSync(`${filename}.tmp`,filename);fs.chmodSync(filename,0o600);return status(workspaceId);
  }
  return {key,status,save};
}
module.exports={createIntegrationStore};
