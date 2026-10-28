// A service-worker reload must wait for committed device writes, including
// drafts in forms that have since unmounted. Failed snapshots remain retryable.
export function createDraftPersistence(){
  const writes=new Map();
  function schedule(key,write){
    const previous=writes.get(key),entry={write,failed:false,promise:null};
    entry.promise=Promise.resolve(previous?.promise).catch(()=>{}).then(write).then(value=>{
      if(writes.get(key)===entry)writes.delete(key);
      return value;
    },error=>{entry.failed=true;throw error;});
    writes.set(key,entry);
    return entry.promise;
  }
  async function flush({retryFailed=false}={}){
    if(retryFailed)for(const [key,entry]of writes)if(entry.failed)schedule(key,entry.write);
    while(writes.size){
      await Promise.allSettled([...writes.values()].map(entry=>entry.promise));
      if([...writes.values()].some(entry=>entry.failed)){
        throw Error('A draft could not be saved on this device. Free browser storage, then retry the update. Your pending reports are retained.');
      }
    }
  }
  return {schedule,flush};
}
export const draftPersistence=createDraftPersistence();
