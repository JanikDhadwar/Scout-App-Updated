/** No transport is accepted until a server provider and explicit data-sharing approval exist. */
export function createAnalystProvider(){
 return Object.freeze({mode:'local',status:'unconfigured',name:'Local evidence analyst',async explain(){throw new Error('External AI provider is disabled and unconfigured. Use the local evidence analyst.');}});
}


/** The browser calls Argus; provider credentials never enter this adapter. */
export function createGroqProvider({request,workspaceId,eventKey}) {
 return {
  status:()=>request('GET','/analyst/status'),
  explain:question=>request('POST','/analyst/ask',{workspaceId,eventKey,question}),
 };
}
