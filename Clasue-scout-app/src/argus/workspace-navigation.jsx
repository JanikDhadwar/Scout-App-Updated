import { useEffect, useRef } from 'react';
import { usePhoneLayout } from './phone-layout.js';
import { utilityDestinations, canSeeDestination } from './workspace-model.js';

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
 return <dialog ref={dialog} id="mobile-more" className="a-more-dialog" aria-labelledby="mobile-more-heading" onClose={onClose} onClick={event=>{if(event.target===dialog.current)onClose();}}><div className="a-more-content"><header className="a-row"><h2 id="mobile-more-heading">More</h2><button className="a-button" onClick={onClose}>Close</button></header><nav aria-label="More pages" className="a-more-shortcuts">{utilityDestinations.filter(([key])=>canSeeDestination(key,role)).map(link)}</nav></div></dialog>;
}
