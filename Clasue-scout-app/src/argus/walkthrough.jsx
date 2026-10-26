import { useEffect, useState } from 'react';

export function Walkthrough({ user, workspace, role, api, section }) {
  const key = `argus:guide:v1:${user.id}:${workspace.id}`;
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(key) === 'true'; } catch { return false; } });
  const [step, setStep] = useState(0);
  const admin = ['owner', 'admin'].includes(role);
  const steps = [
    ['Welcome to Argus', 'Your team collects pit and match observations to make informed alliance decisions. Try the workflows safely in Practice.', '/practice', 'Try practice'],
    ['Your teams stay yours', 'Scout lists permanent teams, pit progress and every scheduled match duty. Check conflicts before a match.', '/assignments', 'My assignments'],
    ['Pit and match scouting', 'Open the assigned form. Drafts save on this device; submitted reports stay pending until the server confirms them.', '/help?topic=offline-and-sync', 'Learn offline saving'],
    ['Need a short break?', 'Request cover for one robot in one match. You remain responsible until an eligible connected teammate accepts.', '/help?topic=handoffs-and-breaks', 'Learn handoffs'],
    ['Use evidence for strategy', 'Open Teams for statistics and comparisons. Open Present to show a team or download its slides.', '/teams', 'Browse teams'],
    ...(admin ? [['Coordinate the team', 'Use Admin control centre to manage participants, owners, missing reports, roles and activity history.', '/admin', 'Open Admin tools']] : []),
  ];
  useEffect(() => { let active = true; api('GET', `/preferences?team_id=${encodeURIComponent(workspace.id)}`).then(p => { if (active && p.guide_dismissed) setDismissed(true); }).catch(() => {}); const replay = () => { setStep(0); setDismissed(false); }; window.addEventListener('argus-guide-replay', replay); return () => { active = false; window.removeEventListener('argus-guide-replay', replay); }; }, [api, workspace.id]);
  function dismiss() { setDismissed(true); try { localStorage.setItem(key, 'true'); } catch { /* Server preference still attempted. */ } api('PATCH', '/preferences', { team_id: workspace.id, guide_dismissed: true }).catch(() => {}); }
  if (dismissed || !['dashboard', 'help'].includes(section)) return null;
  const item = steps[Math.min(step, steps.length - 1)];
  return <section className="a-panel a-welcome-guide" aria-label="Welcome guide"><div className="a-row"><h2>{item[0]}</h2><span className="a-muted">{step + 1}/{steps.length}</span><button className="a-button" onClick={dismiss}>Skip guide</button></div><p>{item[1]}</p><div className="a-row"><a className="a-button" href={`#${item[2]}`}>{item[3]}</a>{step > 0 && <button className="a-button" onClick={() => setStep(s => s - 1)}>Previous step</button>}<button className="a-button a-primary" onClick={() => step + 1 === steps.length ? dismiss() : setStep(s => s + 1)}>{step + 1 === steps.length ? 'Finish guide' : 'Next step'}</button></div><p className="a-muted a-small">Skippable. Replay any time from Help.</p></section>;
}
