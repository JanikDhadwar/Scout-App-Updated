import { useEffect, useRef } from 'react';
import { usePhoneLayout } from './phone-layout.js';

const phoneQuery='(max-width: 620px)';

// Keep desktop summaries visible; phones start with just the task at hand.
export function CompactDetails({label,children,className=''}){
 const phone=usePhoneLayout();
 return <details key={String(phone)} className={`a-compact-details ${className}`} open={!phone}><summary>{label}</summary>{children}</details>;
}

export function SectionTools({links,section}){
 if(!links.length)return null;
 return <CompactDetails label="Page tools" className="a-page-tools"><nav className="a-section-links" aria-label="Section tools">{links.map(([key,label])=><a key={key} href={`#/${key}`} aria-current={section===key?'page':undefined}>{label}</a>)}</nav></CompactDetails>;
}

export function MobileMore({open,onClose,role}){
 const dialog=useRef(null);
 useEffect(()=>{const node=dialog.current;if(open&&!node.open)node.showModal();else if(!open&&node.open)node.close();},[open]);
 useEffect(()=>{const query=window.matchMedia(phoneQuery),resize=()=>{if(!query.matches)dialog.current?.close();};query.addEventListener('change',resize);return()=>query.removeEventListener('change',resize);},[]);
 const link=([key,label])=><a key={key} href={`#/${key}`} onClick={onClose}>{label}</a>;
 return <dialog ref={dialog} id="mobile-more" className="a-more-dialog" aria-labelledby="mobile-more-heading" onClose={onClose} onClick={event=>{if(event.target===dialog.current)onClose();}}><div className="a-more-content"><header className="a-row"><h2 id="mobile-more-heading">More</h2><button className="a-button" onClick={onClose}>Close</button></header><nav aria-label="More pages"><div className="a-more-shortcuts">{[['pit','Pit scouting'],['matches','Match schedule'],['events','Event setup'],['settings','Settings']].map(link)}</div><details className="a-disclosure"><summary>Analysis tools</summary>{[['analytics','Analytics'],['strategy','Strategy'],['reports','Reports'],['analyst','Scouting analyst']].map(link)}</details><details className="a-disclosure"><summary>Team tools and help</summary>{[['display','Pit display'],['practice','Practice scouting'],['help','Help and guide'],['reminders','Reminders'],['history','Event history'],...(['owner','admin'].includes(role)?[['admin','Admin control centre']]:[])].map(link)}</details></nav></div></dialog>;
}
