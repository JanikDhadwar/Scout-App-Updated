import { useEffect, useState } from 'react';
import { ReportDetails } from './workspace-pages.jsx';

export default function Evidence({ event, reportId, api, navigate }) {
  const [report, setReport] = useState(null), [error, setError] = useState('');
  useEffect(() => { let active = true; if (event) api('GET', `/events/${encodeURIComponent(event.id)}/evidence/${encodeURIComponent(reportId)}`).then(value => { if (active) setReport(value); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [api, event, reportId]);
  if (!event) return <p>No event selected.</p>;
  return <div className="a-stack"><p className="a-help">Approved shared evidence. Other answers and scout identity are private.</p>{error ? <p role="alert">{error}</p> : report ? <ReportDetails data={{ submissions: [report], forms: [] }} reportId={report.id} onOpenTeam={number => navigate(`/teams/${number}`)} /> : <p role="status">Loading approved evidence…</p>}</div>;
}
