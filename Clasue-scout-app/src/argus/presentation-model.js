// Create a portable, scoped snapshot. Never pass report answers or identities to exports.
export function presentationSnapshot(analytics,{includeNotes=false,picklists}={}) {
 const snapshot=structuredClone(analytics);
 for(const team of snapshot.teams) {
  team.history=team.history.map(report=>({id:report.id,match_key:report.match_key,report_kind:report.report_kind,form_title:report.form_title,created_at:report.created_at}));
  team.unlinkedReports=[];
  team.notes=includeNotes?team.notes.map(({label,value,reportId})=>({label,value,reportId})):[];
  team.notesIncluded=includeNotes;
  if(team.intelligence?.lastMatch)team.intelligence.lastMatch.reportedObservations=(team.intelligence.lastMatch.reportedObservations||[]).filter(row=>includeNotes||row.type!=='text');
  for(const collection of [team.metrics,team.pitMetrics])for(const [id,metric]of Object.entries(collection)) {
   if(!['number','scale','boolean','select'].includes(metric.type)){delete collection[id];continue;}
   metric.observations=metric.observations.map(({reportId,matchKey,createdAt,value})=>({reportId,matchKey,createdAt,value}));
  }
  team.picklistPositions=picklists?picklists.flatMap(list=>{const position=(list.entries||[]).findIndex(entry=>String(entry.team_number)===team.teamNumber);return position<0?[]:[{title:list.title||list.name||'Picklist',position:position+1}];}):team.picklistPositions||[];
 }
 return snapshot;
}
export const presentationSignature=analytics=>JSON.stringify([analytics.scope,analytics.event,analytics.metrics,analytics.teams]);
