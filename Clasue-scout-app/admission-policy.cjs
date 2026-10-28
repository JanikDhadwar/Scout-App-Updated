// Optional operator admission limits do not restrict existing scouting traffic.
function createAdmissionPolicy(env=process.env){
 const flag=name=>{const value=env[name];if(value==null||value==='')return true;if(!['true','false'].includes(value))throw Error(`${name} must be true, false or unset.`);return value==='true';};
 const cap=name=>{const value=env[name];if(value==null||value==='')return Infinity;if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<1)throw Error(`${name} must be a positive safe integer or unset.`);return Number(value);};
 const signupEnabled=flag('ARGUS_SIGNUP_ENABLED'),teamCreationEnabled=flag('ARGUS_TEAM_CREATION_ENABLED');
 const maxUsers=cap('ARGUS_MAX_USERS'),maxTeams=cap('ARGUS_MAX_TEAMS');
 return {
  signup(db){return !signupEnabled?'New account registration is temporarily paused. Existing users can sign in.':(db.users||[]).length>=maxUsers?'New account capacity has been reached. Existing users can sign in.':null;},
  createTeam(db){return !teamCreationEnabled?'New workspace creation is temporarily paused. Existing teams remain available.':(db.teams||[]).length>=maxTeams?'Workspace capacity has been reached. Existing teams remain available.':null;}
 };
}
module.exports={createAdmissionPolicy};
