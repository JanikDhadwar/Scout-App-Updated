const fs=require('node:fs');
const {AsyncLocalStorage}=require('node:async_hooks');

// Parsing the whole JSON file twice in one synchronous handler is redundant.
// Never retain a mutable snapshot across requests, await boundaries or writes.
function createRequestDatabase(database,filename){
 const scopes=new AsyncLocalStorage();let epoch=0;
 function stamp(){
  try{const stat=fs.lstatSync(filename,{bigint:true});return [stat.dev,stat.ino,stat.mode,stat.size,stat.mtimeNs,stat.ctimeNs].join(':');}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
 }
 function read(){
  const scope=scopes.getStore();if(!scope)return database.read();
  const identity=stamp();
  if(scope.snapshot&&scope.epoch===epoch&&scope.identity===identity)return scope.snapshot;
  const snapshot=database.read();
  scope.snapshot=snapshot;scope.epoch=epoch;scope.identity=identity;
  // This runs before a caller resumes even an already-resolved awaited promise.
  queueMicrotask(()=>{if(scope.snapshot===snapshot)scope.snapshot=null;});
  return snapshot;
 }
 function write(value){
  // Failed mutations may have modified the request's snapshot before validation.
  // Invalidate even if validation, fsync or rename subsequently throws.
  epoch++;const scope=scopes.getStore();if(scope)scope.snapshot=null;
  return database.write(value);
 }
 return {read,write,run:callback=>scopes.run({},callback)};
}
module.exports={createRequestDatabase};
