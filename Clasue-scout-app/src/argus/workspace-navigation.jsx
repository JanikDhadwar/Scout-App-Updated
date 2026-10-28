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
 useEffect(()=>{const node=dialog.current;if(open&&!node.open){node.showModal();node.querySelector('button')?.focus();}else if(!open&&node.open)node.close();},[open]);
 useEffect(()=>{const query=window.matchMedia(phoneQuery),resize=()=>{if(!query.matches)dialog.current?.close();};query.addEventListener('change',resize);return()=>query.removeEventListener('change',resize);},[]);
 // WebKit can move Tab from a native dialog button to the document body when
 // the platform skips links in sequential navigation. Cycle the actual visible
 // controls explicitly so both Tab directions remain within More on every OS.
 const containFocus=event=>{if(event.key!=='Tab')return;const controls=[...dialog.current.querySelectorAll('button:not([disabled]),a[href]')].filter(node=>node.tabIndex>=0&&node.getClientRects().length);if(!controls.length)return;event.preventDefault();const current=controls.indexOf(document.activeElement),next=current<0?(event.shiftKey?controls.length-1:0):(current+(event.shiftKey?-1:1)+controls.length)%controls.length;controls[next].focus();};
 const closed=()=>{onClose();document.querySelector('.a-mobile-nav button[aria-controls="mobile-more"]')?.focus();};
 const link=([key,label])=><a key={key} href={`#/${key}`} onClick={onClose}>{label}</a>;
 return <dialog ref={dialog} id="mobile-more" className="a-more-dialog" aria-labelledby="mobile-more-heading" onClose={closed} onKeyDown={containFocus} onClick={event=>{if(event.target===dialog.current)onClose();}}><div className="a-more-content"><header className="a-row"><h2 id="mobile-more-heading">More</h2><button className="a-button" onClick={onClose}>Close</button></header><nav aria-label="More pages" className="a-more-shortcuts">{utilityDestinations.filter(([key])=>canSeeDestination(key,role)).map(link)}</nav></div></dialog>;
}
