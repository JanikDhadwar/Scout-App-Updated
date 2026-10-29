import { useEffect, useState, useRef } from 'react';
import {learningSteps} from './learning-content.js';

export function Walkthrough({ user, workspace, role, api, section }) {
  const key = `argus:guide:v1:${user.id}:${workspace.id}`;
  const [dismissed, setDismissed] = useState(true);
  const interacted=useRef(false);
  const [step, setStep] = useState(0);
  const steps=learningSteps(role);
  useEffect(() => { let active = true; api('GET', `/preferences?team_id=${encodeURIComponent(workspace.id)}`).then(p => { if(active&&!interacted.current&&p.onboarding_eligible&&!p.guide_dismissed){try{if(localStorage.getItem(key)!=='true')setDismissed(false);}catch{setDismissed(false);}} }).catch(() => {}); const replay = () => { interacted.current=true; setStep(0); setDismissed(false); }; window.addEventListener('argus-guide-replay', replay); return () => { active = false; window.removeEventListener('argus-guide-replay', replay); }; }, [api, workspace.id,key]);
  function dismiss() { interacted.current=true; setDismissed(true); try { localStorage.setItem(key, 'true'); } catch { /* Server preference still attempted. */ } api('PATCH', '/preferences', { team_id: workspace.id, guide_dismissed: true }).catch(() => {}); }
  if (dismissed || !['dashboard', 'help'].includes(section)) return null;
  const item = steps[Math.min(step, steps.length - 1)];
  return <section className="a-panel a-welcome-guide" aria-label="Welcome guide"><div className="a-row"><h2>{item[0]}</h2><span className="a-muted">{step + 1}/{steps.length}</span><button className="a-button" onClick={dismiss}>Skip guide</button></div><p>{item[1]}</p><div className="a-row"><a className="a-button" href={`#${item[2]}`}>{item[3]}</a>{step > 0 && <button className="a-button" onClick={() => setStep(s => s - 1)}>Previous step</button>}<button className="a-button a-primary" onClick={() => step + 1 === steps.length ? dismiss() : setStep(s => s + 1)}>{step + 1 === steps.length ? 'Finish guide' : 'Next step'}</button></div><p className="a-muted a-small">Skippable. Replay any time from Help.</p></section>;
}
