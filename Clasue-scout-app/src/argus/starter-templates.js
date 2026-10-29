const outcomeOptions=['Succeeded','Failed','Not attempted','Not observed'];
const outcome=(id,text,phase)=>({id,text,phase,type:'select',options:[...outcomeOptions],hint:'Record an observed attempt. Not attempted and not observed are different from failure.',example:'A robot tried to climb and fell: Failed. You could not see the attempt: Not observed.',insightDefault:{kind:'success_rate',strength:.8,concern:.5,evidence:'objective',outcomes:{Succeeded:'success',Failed:'failure','Not attempted':'not_attempted','Not observed':'unknown'}}});
export const starterTemplates=[
 {id:'beginner-pit',version:1,kind:'pit',title:'Beginner pit',guidance_mode:'guided',description:'Interview the team about its robot. Capabilities are reported claims, separate from match performance.',questions:[
  {id:'drive',text:'Drivetrain',type:'select',options:['Swerve','Tank / differential','Mecanum','Other','Unknown'],hint:'Ask the team how the robot moves.'},
  {id:'dimensions',text:'Robot dimensions and units',type:'text',hint:'Record the units and whether measurements include bumpers. Leave blank if unknown.'},
  {id:'capabilities',text:'Mechanisms and scoring capabilities',type:'text',hint:'Describe what the team says the robot can do. Match observations will verify performance.'},
  {id:'auto',text:'Autonomous capabilities',type:'text',hint:'Ask what the robot can do without driver control. Do not convert a claim into a success rate.'},
  {id:'reliability',text:'Reliability context',type:'text',hint:'Ask about known limitations or recent repairs. Attribute this information to the interview.'},
  {id:'photo',text:'Robot photo (optional)',type:'photo',hint:'Ask permission before taking a robot photo. Avoid people and private information.'},
  {id:'notes',text:'Other useful observations (optional)',type:'text'}]},
 {id:'beginner-match',version:1,kind:'match',title:'Beginner match',guidance_mode:'guided',description:'Record observed outcomes. Add season-specific teleoperated counters and map their units before calculating scoring insights.',questions:[
  outcome('auto','Autonomous outcome','auto'),
  {id:'teleop',text:'Teleoperated observations',type:'text',phase:'teleop',hint:'Describe observable actions. Ask an admin to add counters for this season; do not guess points.'},
  outcome('endgame','Endgame outcome','endgame'),
  {id:'breakdown',text:'Observed mechanical interruption',type:'select',options:['No interruption observed','Interruption observed','Not observed'],hint:'Record stopped or impaired operation, rather than guessing the mechanical cause.',insightDefault:{kind:'success_rate',strength:.8,concern:.5,evidence:'objective',outcomes:{'No interruption observed':'success','Interruption observed':'failure','Not observed':'unknown'}}},
  {id:'defense',text:'Defense observation',type:'select',options:['Played defense','Faced defense','Both','Neither observed','Not observed'],hint:'Record the role you observed. This alone does not establish effective defense.'},
  {id:'notes',text:'Other useful observations (optional)',type:'text',hint:'Record what happened, when, and its effect. Avoid unsupported opinions.'}]}
];
export function copyStarterTemplate(template, workspaceId) {
 return {id:crypto.randomUUID(),team_id:workspaceId,kind:template.kind,title:template.title,guidance_mode:template.guidance_mode,template_origin:{id:template.id,version:template.version},allow_team_select:true,questions:template.questions.map(question=>({...structuredClone(question),id:crypto.randomUUID()}))};
}
