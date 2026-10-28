// Discard invalidated evidence and issue one newly authorized GET. Never retry
// writes, ordinary conflicts, permission failures, or a different account scope.
export async function readCurrent(api,path){
 try{return await api('GET',path);}
 catch(error){if(error.status!==409||error.code!=='READ_ACCESS_CHANGED')throw error;return api('GET',path);}
}
