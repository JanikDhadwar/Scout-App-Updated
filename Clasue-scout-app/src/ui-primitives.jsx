import { useId, useState } from 'react';

export function Icon({ name, size = 20, ...props }) {
  const paths = {
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    chevron: 'm9 5 7 7-7 7',
    forms: 'M8 4H5v17h14V4h-3M8 3h8v4H8zM8 12h8M8 16h6',
    event: 'M5 5h14v16H5zM8 3v4m8-4v4M5 10h14M9 14h2m2 3h2',
    news: 'M5 4h14v17H5zM8 8h8M8 12h8M8 16h5',
    device: 'M7 3h10v18H7zM11 17h2',
    check: 'm5 12 4 4L19 6',
    close: 'm6 6 12 12M6 18 18 6',
    logout: 'M9 4H4v16h5m5-13 5 5-5 5M8 12h11',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.chevron}/></svg>;
}

export function Disclosure({ title, children, trailing }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <section className="panel account-settings t-acc" data-open={String(open)}>
    <button type="button" className="t-acc-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span>{title}</span><span className="disclosure-trailing">{trailing}</span>
      <span className="t-acc-chevron"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6.5L8 10.5L12 6.5"/></svg></span>
    </button>
    <div id={id} className="t-acc-panel" inert={!open}><div className="t-acc-panel-inner"><div className="disclosure-content">{children}</div></div></div>
  </section>;
}
