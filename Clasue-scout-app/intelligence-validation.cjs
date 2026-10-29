function validateMetricConfig(config, forms) {
  if (!config || typeof config!=='object' || Array.isArray(config) || Object.keys(config).length>2000) return 'Use at most 2000 mapped measurements.';
  const fields=new Map(forms.flatMap(form=>(form.questions||[]).map(question=>[`${form.id}:${question.id}`,question])));
  for(const [id,value] of Object.entries(config)) {
    if(['__proto__','prototype','constructor'].includes(id)||!value||typeof value!=='object'||Array.isArray(value))return 'Invalid metric definition.';
    if(value.phase&&!['auto','teleop','endgame'].includes(value.phase)||value.direction&&!['higher','lower'].includes(value.direction))return 'Choose a valid phase and direction.';
    if(value.unit!=null&&(typeof value.unit!=='string'||value.unit.length>80))return 'Metric units must be short text.';
    const rule=value.insight;
    if(!rule)continue;
    if(typeof rule!=='object'||Array.isArray(rule))return 'Insight rules must be an object.';
    const q=fields.get(id);
    if(!q||!['number','scale','boolean','select'].includes(q.type)||!['mean','success_rate'].includes(rule.kind))return 'Map insights to an existing structured measurement.';
    if(rule.evidence&&!['objective','subjective'].includes(rule.evidence))return 'Choose objective or subjective evidence.';
    for(const name of ['strength','concern'])if(rule[name]!=null&&(typeof rule[name]!=='number'||!Number.isFinite(rule[name])||rule.kind==='success_rate'&&(rule[name]<0||rule[name]>1)))return 'Enter valid numeric insight thresholds.';
    if(rule.kind==='mean'&&(!['number','scale'].includes(q.type)||!value.direction))return 'Numeric insights need a preferred direction.';
    if(rule.strength!=null&&rule.concern!=null&&(rule.kind==='success_rate'||value.direction==='higher'?rule.strength<=rule.concern:rule.strength>=rule.concern))return 'Strength and concern thresholds must not overlap.';
    if(rule.kind==='success_rate') {
      if(!['boolean','select'].includes(q.type)||!rule.outcomes||typeof rule.outcomes!=='object'||Array.isArray(rule.outcomes))return 'Success rates need explicitly mapped answer outcomes.';
      const options=q.type==='boolean'?['Yes','No']:Array.isArray(q.options)?q.options:[];
      if(Object.keys(rule.outcomes).length>100||Object.entries(rule.outcomes).some(([key,outcome])=>['__proto__','prototype','constructor'].includes(key)||!options.includes(key)||!['success','failure','unknown','not_attempted'].includes(outcome)))return 'Choose existing options and valid outcomes.';
    }
  }
  return null;
}
module.exports={validateMetricConfig};
