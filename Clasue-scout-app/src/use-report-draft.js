import { useEffect, useRef, useState } from 'react';
import { deviceStore } from './offline.js';

export function useReportDraft(key, initial) {
  const [value,setValue]=useState(initial), [ready,setReady]=useState(false);
  const [saving,setSaving]=useState(false), [error,setError]=useState('');
  const current=useRef(value), pending=useRef(Promise.resolve()), revision=useRef(0);
  useEffect(()=>{
    let active=true;
    deviceStore.get('drafts',key).then(saved=>{
      if(!active)return;
      if(saved){current.current=saved.value;setValue(saved.value);}
      setReady(true);
    }).catch(e=>{if(active){setError(e.message);setReady(true);}});
    return ()=>{active=false;};
  },[key]);
  function change(next) {
    const updated=typeof next==='function'?next(current.current):next;
    current.current=updated;setValue(updated);setSaving(true);setError('');
    const version=++revision.current;
    pending.current=pending.current.catch(()=>{}).then(()=>deviceStore.put('drafts',{key,value:updated,updatedAt:new Date().toISOString()}));
    pending.current.then(()=>{if(revision.current===version)setSaving(false);}).catch(()=>{
      setSaving(false);setError('Your draft could not be saved on this device. Free up browser storage before leaving this page.');
    });
  }
  return { value, change, ready, saving, error, flush:()=>pending.current };
}
