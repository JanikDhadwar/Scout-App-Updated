const CACHEABLE = new Set(['teams', 'memberships', 'forms', 'submissions', 'announcements', 'scout_events', 'pit_scouts']);
export class RequestError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}
export function createOfflineClient({ storage, fetcher = globalThis.fetch.bind(globalThis), onChange = () => {} }) {
  let scope = null, flight = null;
  let state = { connection:'checking', pending:0, syncing:false, error:'', storageError:'', readyAt:null, lastSync:null };
  const update = patch => { state = { ...state, ...patch }; onChange(state); };
  const keyFor = (path, owner = scope) => `${owner?.userId || 'guest'}:${owner?.teamId || ''}:${path}`;
  const belongs = (entry, owner) => entry.userId === owner?.userId && entry.teamId === owner?.teamId;
  async function request(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), method === 'GET' ? 5000 : 20000);
    try {
      const response = await fetcher(`/api${path}`, {
        method, cache:'no-store', signal:controller.signal,
        headers:body ? { 'Content-Type':'application/json' } : {},
        body:body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        let detail;
        try { detail = (await response.json()).error; } catch { /* Proxy may return HTML. */ }
        throw new RequestError(detail || `Server returned ${response.status}.`, response.status);
      }
      const data = await response.json();
      update({ connection:'online' });
      return data;
    } catch (error) {
      if (!error.status || error.status >= 500) update({ connection:'offline' });
      if (error instanceof RequestError) throw error;
      throw new RequestError('Server unreachable. Your saved reports will upload when it reconnects.');
    } finally { clearTimeout(timer); }
  }
  async function pending(owner = scope) {
    return (await storage.all('queue')).filter(entry => belongs(entry, owner));
  }
  async function refresh() {
    if (!scope) { update({ pending:0, error:'', readyAt:null }); return; }
    const entries = await pending();
    const meta = await storage.get('meta', keyFor('prepared'));
    update({ pending:entries.length, error:entries.find(e=>e.error)?.error || state.storageError, readyAt:meta?.at || null });
  }
  async function localRows(store, owner, includeReceipts) {
    return [...(includeReceipts?await storage.all('receipts'):[]), ...await storage.all('queue')]
      .filter(entry => belongs(entry,owner) && entry.store === store).map(entry=>entry.row);
  }
  async function combine(path, data, owner, includeReceipts=true) {
    const url = new URL(path, 'https://scout.local');
    const [store, id] = url.pathname.slice(1).split('/');
    if (store !== 'submissions') return data;
    const rows = await localRows(store, owner, includeReceipts);
    if (id) return data || rows.find(row=>row.id===id) || null;
    const merged = new Map([...rows, ...(Array.isArray(data)?data:[])].map(row=>[row.id,row]));
    return [...merged.values()].filter(row=>[...url.searchParams].every(([k,v])=>String(row[k])===v));
  }
  async function read(path) {
    const owner = scope && { ...scope };
    const url = new URL(path, 'https://scout.local');
    url.searchParams.sort();
    const normalized = url.pathname + url.search;
    const store = url.pathname.split('/')[1];
    const key = keyFor(normalized, owner);
    try {
      if(owner && CACHEABLE.has(store) && state.connection==='offline') throw new RequestError('Using downloaded data.');
      const data = await request('GET', normalized);
      if (owner && CACHEABLE.has(store)) {
        try {
          await storage.put('cache', { key, store, scope:keyFor('',owner), data });
          if(normalized==='/submissions') for(const receipt of await storage.all('receipts')) {
            if(belongs(receipt,owner))await storage.remove('receipts',receipt.key);
          }
        }
        catch { update({ storageError:'Device storage is full or unavailable. Offline data could not be saved.', error:'Device storage is full or unavailable. Offline data could not be saved.' }); }
      }
      return owner ? combine(normalized,data,owner,false) : data;
    } catch (error) {
      if (error.status && error.status < 500) throw error;
      if (!owner || !CACHEABLE.has(store)) throw error;
      let cached = await storage.get('cache', key);
      if (!cached) {
        // A complete downloaded collection can also answer filtered/item reads.
        const collection = await storage.get('cache', keyFor(`/${store}`,owner));
        if (collection && Array.isArray(collection.data)) {
          const id = url.pathname.split('/')[2];
          cached = { data:id ? collection.data.find(row=>row.id===id) || null : collection.data.filter(row=>[...url.searchParams].every(([k,v])=>String(row[k])===v)) };
        }
      }
      if (!cached) throw new RequestError('This data is not downloaded yet. Connect to the server once to prepare this device.');
      return combine(normalized,cached.data,owner);
    }
  }
  async function api(method, path, body) {
    if (method === 'GET') return read(path);
    const data = await request(method,path,body);
    // Invalidate changed snapshots so deleted/edited records do not come back.
    const store = path.split('/')[1];
    if(scope&&CACHEABLE.has(store))try {
      for (const cached of await storage.all('cache')) {
        if (cached.store === store) await storage.remove('cache',cached.key);
      }
      if(method==='DELETE'&&store==='submissions') {
        const id=path.split('/')[2];
        await storage.remove('receipts',id); await storage.remove('queue',id); await refresh();
      }
    } catch {update({error:'The server saved your change, but the offline copy could not be refreshed.'});}
    return data;
  }
  async function sync() {
    if (!scope) return;
    if (flight) return flight;
    const owner = { ...scope };
    flight = (async () => {
      update({ syncing:true });
      try {
        await request('GET','/health');
        for (const entry of await pending(owner)) {
          if (!belongs(entry,scope)) break;
          try {
            const result = await request('POST',`/${entry.store}`,entry.row);
            if (result?.id !== entry.row.id) throw new RequestError('Upload was not acknowledged. Retrying safely.');
            await storage.acknowledge(entry);
            update({ lastSync:new Date().toISOString() });
          } catch (error) {
            await storage.put('queue',{ ...entry, error:error.status && error.status < 500 ? `Report ${entry.row.id.slice(0,8)}: ${error.message}` : null });
            if (!error.status || error.status >= 500) break;
          }
        }
      } catch (error) {
        if (error.status) update({ error:error.message });
      } finally {
        update({ syncing:false });
        await refresh();
      }
    })().finally(()=>{ flight=null; });
    return flight;
  }
  async function enqueue(row, draftKey) {
    if (!scope || row.user_id !== scope.userId || row.team_id !== scope.teamId) throw new Error('Sign in to the report’s team before saving.');
    if (new Blob([JSON.stringify(row)]).size > 9.5 * 1024 * 1024) throw new Error('This report has too many large photos. Use smaller images before submitting.');
    await storage.enqueue({ key:row.id, row, store:'submissions', userId:scope.userId, teamId:scope.teamId, queuedAt:new Date().toISOString(), error:null },draftKey);
    await refresh();
    void sync().catch(error=>update({error:error.message}));
    return row;
  }
  async function prepare() {
    if (!scope) return;
    const owner = { ...scope };
    // Complete collections support the legacy tabs' local filtering, too.
    const results = await Promise.allSettled([...CACHEABLE].map(async store=>{
      const data=await request('GET',`/${store}`);
      await storage.put('cache',{key:keyFor(`/${store}`,owner),store,scope:keyFor('',owner),data});
      if(store==='submissions')for(const receipt of await storage.all('receipts')) {
        if(belongs(receipt,owner))await storage.remove('receipts',receipt.key);
      }
    }));
    const failed = results.some(result=>result.status==='rejected');
    if (failed || state.connection !== 'online') {
      if(state.connection==='online') update({storageError:'Could not download all data to this device. Check storage and prepare again.',error:'Could not download all data to this device. Check storage and prepare again.'});
      return;
    }
    const at = new Date().toISOString();
    await storage.put('meta',{key:keyFor('prepared',owner),at});
    if (scope?.userId === owner.userId && scope?.teamId === owner.teamId) {update({storageError:''});await refresh();}
  }
  return { api, enqueue, sync, prepare, pending, refresh, getState:()=>state,
    setScope: async value => { scope=value; await refresh(); },
  };
}
