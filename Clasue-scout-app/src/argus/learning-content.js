import help from '../../help-content.json';
// Onboarding and Help use the same release-bundled learning text.
export function learningSteps(role) {
 const topics=[['beginner-guide','What is scouting?','/help?topic=beginner-guide','Read the beginner guide'],['assignments-and-randomization','Your assigned teams','/assignments','My assignments'],['pit-scouting','Interview a team','/pit','Open pit forms'],['match-scouting','Observe a match','/match','Open match forms'],['practice-and-training','Practice safely','/practice','Try practice'],['offline-and-sync','Save and synchronize','/help?topic=offline-and-sync','Learn offline saving'],['match-intelligence','Prepare with evidence','/display','Open Pit Display']];
 if(['owner','admin'].includes(role))topics.push(['starter-forms','Prepare your workspace','/help?topic=starter-forms','Choose starter forms']);
 return topics.map(([topic,title,route,action])=>[title,(help[`${topic}.md`]||'').split('\n').find(line=>line.trim()&&!line.startsWith('#'))||'Open Help to learn this workflow.',route,action]);
}
