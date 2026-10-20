import { useCallback, useEffect, useRef, useState } from 'react';

export function EventTransition({ teamId, nextEventId, api, pending = 0, onCancel, onComplete }) {
  const dialog = useRef(null);
  const [preview, setPreview] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { setPreview(await api('GET', `/event-transition/preview?${new URLSearchParams({ team_id: teamId, next_event_id: nextEventId })}`)); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [api, teamId, nextEventId]);
  useEffect(() => { const previous = document.activeElement; dialog.current.showModal(); return () => { if (previous?.isConnected) previous.focus(); }; }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);
  async function submit(e) {
    e.preventDefault(); if (busy || !preview) return; setBusy(true); setError('');
    try { const result = await api('POST', '/event-transition', { team_id: teamId, next_event_id: nextEventId, expected: preview.fingerprint, preserve_history: true }); await onComplete(result); }
    catch (e) { setError(e.message); setBusy(false); }
  }
  return <dialog ref={dialog} className="a-event-transition" aria-labelledby="event-transition-title" onCancel={e => { if (busy) e.preventDefault(); }} onClose={onCancel}>
    <form className="a-stack" onSubmit={submit}><div className="a-row"><h2 id="event-transition-title">Change active event</h2><button className="a-button" type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
      {preview ? <><p>Activate <strong>{preview.next.event_name || preview.next.event_key}</strong> for everyone on your team.</p><p>All historical reports, forms, photos, schedules, assignments, handoffs and picklists are retained. This does not delete or reset the outgoing event.</p>{pending > 0 && <p className="a-help">This device has {pending} pending reports. They retain their original event and remain queued for synchronization.</p>}<button className="a-button a-primary" disabled={busy}>{busy ? 'Activating…' : 'Activate event and keep history'}</button></> : <p role="status">{busy ? 'Loading event preview…' : 'Preview unavailable.'}</p>}
      {error && <div role="alert" className="a-danger"><p>{error}</p><button className="a-button" type="button" disabled={busy} onClick={load}>Reload event preview</button></div>}
    </form>
  </dialog>;
}
