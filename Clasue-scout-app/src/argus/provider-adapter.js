/** Compatibility adapter: no remote analyst transport exists. */
export function createAnalystProvider(){
 return Object.freeze({mode:'local',status:'unconfigured',name:'Local evidence analyst',async explain(){throw new Error('External AI provider is disabled. Use the local calculations.');}});
}
