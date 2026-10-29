import {hasAnswer,visibleQuestions} from '../form-conditions.js';
export function reviewAnswers(questions,answers) {
 return visibleQuestions(questions,answers).flatMap(question=>{
  const value=answers[question.id],messages=[];
  if(!hasAnswer(value))messages.push(`${question.text}: ${question.required?'required answer missing':'not answered'}.`);
  if(hasAnswer(value)&&['number','scale'].includes(question.type)&&(!Number.isFinite(Number(value))||question.min!=null&&Number(value)<question.min||question.max!=null&&Number(value)>question.max))messages.push(`${question.text}: check the number and its configured range.`);
  // Comparisons are explicitly configured by admins, never inferred from wording.
  if(hasAnswer(value)&&question.review_greater_than&&hasAnswer(answers[question.review_greater_than])&&Number(value)>Number(answers[question.review_greater_than]))messages.push(`${question.text}: exceeds the linked value; check both observations.`);
  return messages;
 });
}
