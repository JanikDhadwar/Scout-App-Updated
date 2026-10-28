// Offline, version- and integrity-bound supplements for published packages that
// omit a top-level license file. Captured texts/provenance are reviewed data.
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');

function resolveOverride({pkg,entry,record,directory}){
  if(record.name!==pkg.name||record.version!==pkg.version)throw Error(`Curated license version mismatch: ${pkg.name}`);
  if(record.license!==pkg.license)throw Error(`Curated declared license mismatch: ${pkg.name}`);
  if(!entry.integrity||record.integrity!==entry.integrity)throw Error(`Curated package integrity mismatch: ${pkg.name}`);
  if(typeof record.file!=='string'||!/^[-a-zA-Z0-9_.]+$/.test(record.file)||record.file==='.'||record.file==='..')throw Error('Unsafe curated license file path');
  if(!Array.isArray(record.sources)||!record.sources.length||record.sources.some(source=>typeof source.url!=='string'||!source.url.startsWith('https://')||typeof source.evidence!=='string'||!source.evidence.trim()))throw Error('Missing curated license provenance');
  const text=fs.readFileSync(path.join(directory,record.file),'utf8');
  if(!/^[a-f0-9]{64}$/.test(record.sha256||'')||createHash('sha256').update(text).digest('hex')!==record.sha256)throw Error(`Curated license checksum mismatch: ${pkg.name}`);
  return {text,sources:record.sources};
}
module.exports={resolveOverride};
