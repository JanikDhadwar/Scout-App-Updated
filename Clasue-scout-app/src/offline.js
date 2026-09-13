import { createOfflineStore } from './offline-store.js';
import { createOfflineClient } from './offline-client.js';

export const deviceStore = createOfflineStore();
export const offline = createOfflineClient({ storage:deviceStore, onChange:state=>window.dispatchEvent(new CustomEvent('scout-sync',{detail:state})) });
export function draftKey(userId, teamId, formId) { return `${userId}:${teamId}:${formId}`; }
export async function exportPending() {
  const reports = await offline.pending();
  const blob = new Blob([JSON.stringify(reports.map(entry=>entry.row),null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob), link=document.createElement('a');
  link.href=url; link.download=`scout-pending-${Date.now()}.json`; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
