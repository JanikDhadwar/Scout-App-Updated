export function assignedTeamNumbers(data,event,userId) {
  const permanent=(data.team_allocations||[]).filter(a=>a.team_id===event?.team_id&&a.event_key===event?.event_key&&!a.archived_at);
  if(permanent.length)return [...new Set(permanent.filter(a=>a.owner_user_id===userId).map(a=>String(a.team_number)))];
  const values=(data.assignments||[]).filter(row=>row.team_id===event?.team_id&&row.event_key===event?.event_key&&row.scout_user_id===userId&&!row.archived_at).map(row=>row.team_number);
  const legacy=event?.assignment?.[userId]?.teams;
  if(Array.isArray(legacy))values.push(...legacy);
  return [...new Set(values.map(String).filter(value=>/^\d+$/.test(value)&&Number(value)>0))];
}

export function reportQuestions(reports,forms=[]) {
  const result=new Map();
  const add=(formId,title,questions=[])=>questions.forEach(question=>{const key=`${formId}:${question.id}`;if(!result.has(key))result.set(key,{...question,key,formId,formTitle:title||formId});});
  reports.forEach(row=>add(row.form_id,row.form_title,row.questions_snapshot||row.form_snapshot?.questions||forms.find(form=>form.id===row.form_id)?.questions||[]));
  return [...result.values()];
}

export function filterReports(reports,{eventKey,scope='event',formId='',team='',question='',answer='',query='',reportKind=''}={},forms=[]) {
  return reports.filter(row=>{
    if(scope==='event'&&(!eventKey||row.event_key!==eventKey)||scope==='legacy'&&row.event_key)return false;
    if(formId&&row.form_id!==formId||team&&(team==='__unassigned__'?!!row.scouted_team:String(row.scouted_team)!==team))return false;
    if(reportKind&&(row.report_kind||forms.find(f=>f.id===row.form_id)?.kind||'match')!==reportKind)return false;
    if(query&&!`${row.scouted_team||''} ${row.form_title||''} ${row.match_key||''} ${row.submitted_by||''}`.toLowerCase().includes(query.toLowerCase()))return false;
    if(!answer)return true;
    const questions=reportQuestions([row],forms),types=new Map(questions.map(q=>[q.id,q.type]));
    return Object.entries(row.answers||{}).some(([id,value])=>(!question||`${row.form_id}:${id}`===question)&&!['photo','draw','drawing'].includes(types.get(id))&&!/^data:image\//i.test(String(value))&&String(value??'').toLowerCase().includes(answer.toLowerCase()));
  });
}

export function reportsCsv(reports,forms=[]) {
  const metadata=['id','event_key','match_key','scouted_team','report_kind','form_id','form_title','submitted_by','created_at'];
  const questions=reportQuestions(reports,forms),known=new Set(questions.map(q=>q.key));
  for(const row of reports)for(const id of Object.keys(row.answers||{})){const key=`${row.form_id}:${id}`;if(!known.has(key)){known.add(key);questions.push({key,id,formId:row.form_id,formTitle:row.form_title||row.form_id,text:id});}}
  const cell=value=>{let text=typeof value==='object'&&value!==null?JSON.stringify(value):String(value??'');if(/^[=+@-]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`;};
  const header=[...metadata,...questions.map(q=>`${q.formTitle}: ${q.text} [${q.key}]`)];
  return [header.map(cell).join(','),...reports.map(row=>[...metadata.map(key=>row[key]),...questions.map(q=>q.formId===row.form_id?row.answers?.[q.id]:null)].map(cell).join(','))].join('\r\n');
}
