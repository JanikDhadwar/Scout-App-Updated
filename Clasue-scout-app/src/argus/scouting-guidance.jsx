import {useState} from 'react';
import {reviewAnswers} from './scouting-review.js';
import {starterTemplates,copyStarterTemplate} from './starter-templates.js';

export function QuestionHint({question,mode}) {
 if(!question.hint&&!question.example)return null;
 const content=<><p>{question.hint}</p>{question.example&&<p className="a-muted">Example: {question.example}</p>}</>;
 return mode==='guided'?<div className="a-question-hint">{content}</div>:<details className="a-question-hint"><summary>Question help</summary>{content}</details>;
}
export function ScoutingReview({questions,answers}) {
 const warnings=reviewAnswers(questions,answers);
 return <section className="a-panel a-stack" aria-label="Final scouting review"><h2>Review before submitting</h2><p>Check missing answers and observations that may need a second look. These suggestions do not block submission; required fields and valid answers still apply.</p>{warnings.length?<ul>{warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul>:<p>No missing answers or configured contradictions detected. This does not verify observation accuracy.</p>}<p className="a-muted">Unknown is better than a guess. Your draft stays saved while you review.</p></section>;
}
export function TemplateLibrary({kind,workspaceId,onCopy,onClose}) {
 const [selected,setSelected]=useState(null);
 return <section className="a-panel a-stack"><div className="a-row"><h2>Beginner templates</h2><button className="a-button" onClick={onClose}>Close templates</button></div><p>Preview a template, then copy it into your workspace. Existing forms and reports stay intact.</p>{starterTemplates.filter(template=>!kind||template.kind===kind).map(template=><div key={template.id}><button className="a-button" onClick={()=>setSelected(template)}>Preview {template.title}</button></div>)}{selected&&<section aria-label={`${selected.title} preview`}><h3>{selected.title}</h3><p>{selected.description}</p><ol>{selected.questions.map(question=><li key={question.id}><strong>{question.text}</strong><p>{question.hint}</p>{question.options&&<p>{question.options.join(' / ')}</p>}</li>)}</ol><button className="a-button a-primary" onClick={()=>onCopy(copyStarterTemplate(selected,workspaceId))}>Copy template and edit</button></section>}</section>;
}
