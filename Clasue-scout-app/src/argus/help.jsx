import { useState } from 'react';
import bundledHelp from '../../help-content.json';

// Committed, link-checked snapshot also works with older updaters which archive
// only Clasue-scout-app. A first upgrade must not depend on parent directories.
const sources = bundledHelp;
const topics = Object.entries(sources).map(([path, text]) => ({ id: path.split('/').at(-1).replace('.md', ''), text, title: text.split('\n')[0].replace(/^#\s*/, '') }));
function Inline({ text }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!link) return <span key={i}>{part}</span>;
    const topic = link[2].replace('.md', '');
    if (topics.some(t => t.id === topic)) return <a key={i} href={`#/help?topic=${encodeURIComponent(topic)}`}>{link[1]}</a>;
    return <span key={i}>{link[1]}</span>;
  });
}
export default function Help() {
  const [query, setQuery] = useState('');
  const selected = new URLSearchParams(location.hash.split('?')[1] || '').get('topic') || 'contents';
  const topic = topics.find(t => t.id === selected) || topics.find(t => t.id === 'contents');
  return <div className="a-stack"><header><h1>Help and learning</h1><p className="a-muted">Instructions bundled with this Argus release and available offline.</p></header><div className="a-row"><a className="a-button" href="#/help?topic=contents">All topics</a><a className="a-button" href="#/practice">Practice scouting</a><button className="a-button" onClick={() => window.dispatchEvent(new Event('argus-guide-replay'))}>Replay welcome guide</button></div><label>Search instructions<input className="a-input" type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>{query && <section className="a-panel"><ul>{topics.filter(t => `${t.title} ${t.text}`.toLowerCase().includes(query.toLowerCase())).map(t => <li key={t.id}><a href={`#/help?topic=${t.id}`} onClick={() => setQuery('')}>{t.title}</a></li>)}</ul></section>}<article className="a-panel a-guide-content" aria-label={topic.title}>{topic.text.split('\n').filter(Boolean).map((line, i) => line.startsWith('# ') ? <h2 key={i}>{line.slice(2)}</h2> : line.startsWith('## ') ? <h3 key={i}>{line.slice(3)}</h3> : <p key={i}><Inline text={line} /></p>)}</article></div>;
}
