import {exportTeamPresentation} from './exports.js';
self.onmessage=async({data})=>{
 try {
  const team=data.analytics.teams.find(row=>row.teamNumber===String(data.teamNumbers[0]));
  const result=await exportTeamPresentation(data.format,data.analytics,team,{download:false,teamNumbers:data.teamNumbers,includeNotes:data.includeNotes,onProgress:progress=>self.postMessage({progress})});
  self.postMessage({result});
 }catch(error){self.postMessage({error:error.message||'Presentation export failed.'});}
};
