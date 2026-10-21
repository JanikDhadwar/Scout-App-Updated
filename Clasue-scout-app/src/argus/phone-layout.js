import { useSyncExternalStore } from 'react';
const query='(max-width: 620px)';
const snapshot=()=>window.matchMedia(query).matches;
const serverSnapshot=()=>false;
function subscribe(listener){const media=window.matchMedia(query);media.addEventListener('change',listener);return()=>media.removeEventListener('change',listener);}
export function usePhoneLayout(){return useSyncExternalStore(subscribe,snapshot,serverSnapshot);}
