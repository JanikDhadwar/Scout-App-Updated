import { assignedRobots, matchReportError } from './argus/match-access.js';
import {watchLive} from './argus/live-updates.js';
import { APP_VERSION } from './app-version.js';
import { useState, useEffect, useRef, useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { conditionOperators, hasAnswer, visibleQuestions, visibleAnswers, validateConditions } from './form-conditions.js';
import { offline, deviceStore, draftKey } from './offline.js';
import { SyncPanel } from './workspace-ui.jsx';
import { useReportDraft } from './use-report-draft.js';
import { draftPersistence } from './argus/draft-persistence.js';
import { ReportDrawing, ReportPhoto } from './report-media.jsx';
import { Icon } from './ui-primitives.jsx';
import ArgusWorkspace from './argus/workspace.jsx';
import WelcomeScreen from './argus/welcome.jsx';

// ─── SERVER-BACKED DATABASE (db.json via Express) ────────────────────────────
// All data is saved to db.json on the hosting PC via a local Express server.
// Multiple users/devices on the same network all share the same data.

const SESSION_KEY = "frc-scout-session";

const apiCall = (method,path,body) => offline.api(method,path,body);

async function fbSelect(col, filters = {}) {
  const params = new URLSearchParams(filters).toString();
  return apiCall("GET", `/${col}${params ? "?" + params : ""}`);
}
async function fbInsert(col, row) {
  if (!row.id) row = { ...row, id: uid() };
  return apiCall("POST", `/${col}`, row);
}
// ─── Thin wrappers used directly in the app (session, etc.) ──────────────────
async function idbGet(store, key) { return apiCall("GET", `/${store}/${key}`); }
async function idbPut(store, val) { return apiCall("POST",   `/${store}`, val); }
async function idbAll(store)      { return apiCall("GET",    `/${store}`); }
async function idbDel(store, key) { return apiCall("DELETE", `/${store}/${key}`); }


// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid    = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)+Date.now().toString(36));
const tsNow  = () => new Date().toISOString();
const fmtTs  = ts => { const d=new Date(ts); const diff=Date.now()-d; if(diff<60000)return"just now"; if(diff<3600000)return`${Math.floor(diff/60000)}m ago`; if(diff<86400000)return`${Math.floor(diff/3600000)}h ago`; return d.toLocaleDateString(); };

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = { bg0:"#0b1018", bg1:"#151d29", bg2:"#1c2736", border:"#34445b", accent:"#ffb3bb", orange:"#e9b777", green:"#82c99a", red:"#fb7b80", muted:"#a7b5c8", text:"#f2f5fa", dim:"#c5cad3", purple:"#b7a3d5" };
const MO = "'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, sans-serif";

const sx = {
  page:   { fontFamily:MO, background:C.bg0, color:C.text, minHeight:"100vh", display:"flex", flexDirection:"column" },
  hdr:    { background:C.bg1, borderBottom:`1px solid ${C.border}`, padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", height:72, flexShrink:0, position:"sticky", top:0, zIndex:100 },
  logo:   { display:"flex", alignItems:"center", gap:12, fontWeight:650, fontSize:17, color:C.text },
  main:   { flex:1, overflowY:"auto", padding:"16px 12px", paddingBottom:80 },
  bnav:   { position:"fixed", bottom:0, left:0, right:0, background:C.bg1, borderTop:`1px solid ${C.border}`, display:"flex", zIndex:100, height:60 },
  bnavBtn:(on) => ({ flex:1, background:"transparent", border:"none", color:on?C.text:C.muted, cursor:"pointer", fontFamily:MO, fontSize:12, fontWeight:on?650:450, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:5, padding:"8px 2px" }),
  card:   { background:C.bg1, border:`1px solid ${C.border}`, borderRadius:6, padding:"clamp(18px, 2vw, 24px)", marginBottom:16 },
  ct:     { fontSize:15, fontWeight:650, color:C.text, marginBottom:16 },
  inp:    { background:C.bg0, border:`1px solid ${C.border}`, color:C.text, padding:"12px 14px", borderRadius:8, width:"100%", fontFamily:MO, fontSize:14, boxSizing:"border-box", outline:"none", marginBottom:10 },
  btn:    (c=C.accent) => ({ background:c===C.accent?"#c53645":"transparent", border:`1px solid ${c===C.accent?"#ed8792":c}`, color:c===C.accent?"#ffffff":c, padding:"12px 18px", borderRadius:5, cursor:"pointer", fontFamily:MO, fontSize:14, fontWeight:600, width:"100%", minHeight:46 }),
  sm:     (c=C.accent) => ({ background:c===C.accent?C.bg2:"transparent", border:`1px solid ${c===C.accent?C.border:c+'66'}`, color:c===C.accent?C.text:c, padding:"9px 13px", borderRadius:8, cursor:"pointer", fontFamily:MO, fontSize:13, fontWeight:550, minHeight:44 }),
  lbl:    { fontSize:13, fontWeight:550, color:C.dim, marginBottom:8, display:"block" },
  err:    { color:C.red, fontSize:12, marginBottom:8 },
  ok:     { color:C.green, fontSize:12, marginBottom:8 },
  tag:    (c) => ({ background:c+"22", border:`1px solid ${c}44`, color:c, padding:"3px 8px", borderRadius:4, fontSize:12, display:"inline-block" }),
  nb:     (on) => ({ background:on?C.bg2:"transparent", border:on?`1px solid #484d58`:"1px solid transparent", color:on?C.text:C.muted, padding:"10px 14px", minHeight:44, borderRadius:6, cursor:"pointer", fontFamily:MO, fontSize:13 }),
  hr:     { borderTop:`1px solid ${C.border}`, margin:"12px 0" },
  sc:     { background:C.bg0, border:`1px solid ${C.border}`, borderRadius:8, padding:"14px 12px", textAlign:"center" },
  ob:     (c) => ({ background:c+"18", borderBottom:`1px solid ${c}`, color:c, padding:"6px 20px", fontSize:11, letterSpacing:2, textAlign:"center", textTransform:"uppercase" }),
  row:    { display:"flex", alignItems:"center", gap:10, padding:"12px 0", borderBottom:`1px solid ${C.border}` },
  avatar: (c=C.accent) => ({ width:38, height:38, borderRadius:"50%", background:C.bg2, border:`1px solid ${c}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:c, flexShrink:0 }),
};
const RC = { owner:C.orange, admin:C.accent, member:C.muted };

function NavIcon({ name }) {
  const paths = {
    home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
    announce: 'M4 10v5h4l10 5V5L8 10H4m4 5 2 6M21 9v7',
    forms: 'M8 4H5v17h14V4h-3M8 3h8v4H8zM8 12h8M8 16h6',
    event: 'M5 5h14v16H5zM8 3v4m8-4v4M5 10h14M9 14h2m2 3h2',
    myteam: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m9 1a4 4 0 0 1 0 7m1 4a4 4 0 0 1 3 4v2',
    data: 'M4 3v18h17M8 17v-5m5 5V7m5 10V4',
    manage: 'M4 7h16M4 17h16M8 4v6m8 4v6',
    more: 'M4 12h2m5 0h2m5 0h2',
    sync: 'M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5',
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}

// ─── TBA helpers ──────────────────────────────────────────────────────────────
async function tbaFetch(path) { return apiCall('GET', `/tba${path}`); }

// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const {needRefresh:[needRefresh],updateServiceWorker}=useRegisterSW();
  const [user,setUser]=useState(null),[team,setTeam]=useState(null),[mem,setMem]=useState(null),[booting,setBooting]=useState(true);
  const [syncState,setSyncState]=useState(offline.getState());
  const [shellReady,setShellReady]=useState(!!navigator.serviceWorker?.controller);
  const [publicRoute,setPublicRoute]=useState(window.location.hash);
  useEffect(()=>{
    const changed=()=>setPublicRoute(window.location.hash);
    window.addEventListener('hashchange',changed);
    return()=>window.removeEventListener('hashchange',changed);
  },[]);
  useEffect(()=>{
    let registration,timer,stopped=false;
    const check=async()=>{if(navigator.onLine&&document.visibilityState==='visible'){try{registration=registration||await navigator.serviceWorker?.getRegistration();if(!stopped)await registration?.update();}catch{ /* Recheck after reconnecting. */ }}};
    navigator.serviceWorker?.getRegistration().then(value=>{if(!stopped){registration=value;check();timer=setInterval(check,60000);}}).catch(()=>{});
    window.addEventListener('online',check);document.addEventListener('visibilitychange',check);
    return()=>{stopped=true;clearInterval(timer);window.removeEventListener('online',check);document.removeEventListener('visibilitychange',check);};
  },[]);
  useEffect(()=>{
    if(user&&team&&window.location.hash===publicRoute&&['#/login','#/signup'].includes(publicRoute))window.location.replace('#/dashboard');
  },[user,team,publicRoute]);
  async function saveSession(u,t,m){if(u)localStorage.setItem(SESSION_KEY,JSON.stringify({user:{id:u.id,username:u.username},team:t||null,mem:m||null}));else localStorage.removeItem(SESSION_KEY);}
  useEffect(()=>{
    const listener=event=>setSyncState(event.detail),ready=()=>setShellReady(!!navigator.serviceWorker?.controller);
    window.addEventListener('scout-sync',listener);navigator.serviceWorker?.addEventListener('controllerchange',ready);
    return()=>{window.removeEventListener('scout-sync',listener);navigator.serviceWorker?.removeEventListener('controllerchange',ready);};
  },[]);
  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const cached=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
        let u;
        try{u=await apiCall('GET','/auth/me');}
        catch(error){if(error.status&&error.status<500)throw error;if(cached?.user)u={id:cached.user.id,username:cached.user.username};}
        if(!u)return;
        const ownCache=cached?.user?.id===u.id?cached:null;
        await offline.setScope({userId:u.id,teamId:ownCache?.team?.id});
        if(active)setUser(u);
        if(ownCache?.team&&ownCache?.mem){
          const membership=await idbGet('memberships',ownCache.mem.id);
          if(membership&&membership.role!==ownCache.mem.role)await offline.invalidateReadCache();
          const restoredTeam=await idbGet('teams',ownCache.team.id);
          if(membership?.user_id===u.id&&membership.team_id===restoredTeam?.id&&active){setTeam(restoredTeam);setMem(membership);await saveSession(u,restoredTeam,membership);}
        }else{
          const memberships=(await idbAll('memberships')).filter(row=>row.user_id===u.id);
          if(memberships.length===1){const t=await idbGet('teams',memberships[0].team_id);if(t&&active){setTeam(t);setMem(memberships[0]);await saveSession(u,t,memberships[0]);}}
        }
      }catch(error){if(error.status===401){await saveSession(null);if(active){setUser(null);setTeam(null);setMem(null);}}}
      finally{if(active)setBooting(false);}
    })();
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(!user||!team)return;
    let stopped=false,running=false,lastPrepared=0;
    const check=async()=>{if(stopped||running)return;running=true;try{await offline.setScope({userId:user.id,teamId:team.id});try{const release=await apiCall('GET','/release');if(await offline.invalidateForRelease(release.buildId))window.dispatchEvent(new Event('argus-workspace-updated'));}catch{ /* Offline releases keep downloaded data and pending uploads intact. */ }await offline.sync();if(offline.getState().connection==='online'&&Date.now()-lastPrepared>60000){await offline.prepare();lastPrepared=Date.now();}}catch(error){if(!stopped)setSyncState(state=>({...state,error:error.message}));}finally{running=false;}};
    check();const timer=setInterval(check,15000);window.addEventListener('online',check);document.addEventListener('visibilitychange',check);
    return()=>{stopped=true;clearInterval(timer);window.removeEventListener('online',check);document.removeEventListener('visibilitychange',check);};
  },[user,team]);
  async function login(u){setUser(u);const memberships=(await idbAll('memberships')).filter(row=>row.user_id===u.id);if(memberships.length===1){const t=await idbGet('teams',memberships[0].team_id);if(t){await joinTeam(t,memberships[0],u);return;}}await saveSession(u,null,null);}
  async function joinTeam(t,m,u=user){await offline.setScope({userId:u.id,teamId:t.id});setTeam(t);setMem(m);await saveSession(u,t,m);}
  async function clearSession(){await saveSession(null);await offline.setScope(null);setUser(null);setTeam(null);setMem(null);}
  async function logout(){try{await apiCall('POST','/auth/logout',{});await clearSession();}catch(error){alert(`Could not sign out: ${error.message}`);}}
  async function switchWorkspace(){setTeam(null);setMem(null);await saveSession(user,null,null);}
  async function leaveWorkspace(){if(mem?.role==='owner'||!confirm('Leave this team? Your submitted reports remain with the team; drafts and pending reports stay scoped to this team.'))return;try{await apiCall('DELETE',`/memberships/${encodeURIComponent(mem.id)}`);await offline.invalidateReadCache();await offline.setScope({userId:user.id});await switchWorkspace();}catch(error){alert(error.message);}}
  async function refreshMem(){try{const rows=await fbSelect('memberships',{team_id:team.id,user_id:user.id});if(rows[0]){setMem(rows[0]);await saveSession(user,team,rows[0]);}}catch{ /* Keep the last confirmed role while offline. */ }}
  useEffect(()=>{
    if(!user||!team||!mem)return;
    let active=true,running=false;
    const check=async()=>{if(running||document.hidden)return;running=true;try{
      const memberships=await apiCall('GET',`/memberships?${new URLSearchParams({team_id:team.id,user_id:user.id})}`);
      if(!active)return;
      const current=memberships.find(m=>m.user_id===user.id&&m.team_id===team.id);
      if(!current){await offline.invalidateReadCache();if(active){setTeam(null);setMem(null);await saveSession(user,null,null);}}
      else if(current.role!==mem.role){await offline.invalidateReadCache();if(active){setMem(current);await saveSession(user,team,current);window.dispatchEvent(new Event('argus-workspace-updated'));}}
    }catch{/* Keep offline drafts and the last confirmed role; server checks every write. */}finally{running=false;}};
    const timer=setInterval(check,30000);window.addEventListener('focus',check);window.addEventListener('online',check);window.addEventListener('argus-role-check',check);check();
    return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',check);window.removeEventListener('online',check);window.removeEventListener('argus-role-check',check);};
  },[user,team,mem]);
  async function archiveTeam(){const restoring=!!team.archived_at;if(!confirm(restoring?'Restore this team?':'Archive this team? Reports are retained and the owner can restore it.'))return;try{const result=await apiCall('POST',restoring?'/auth/restore-team':'/auth/archive-team',{team_id:team.id});setTeam(result.team);await saveSession(user,result.team,mem);}catch(error){alert(error.message);}}
  async function deactivate(){if(!confirm('Deactivate your account? Reports will remain with your team. Transfer any active teams you own first.'))return;try{await apiCall('POST','/auth/deactivate-account',{});await clearSession();}catch(error){alert(error.message);}}
  async function installUpdate(){
    try{await draftPersistence.flush({retryFailed:true});await updateServiceWorker(true);}
    catch(error){alert(`Update postponed. ${error.message}`);}
  }
  if(booting)return <div className="argus-boot" role="status">Opening ARGUS…</div>;
  if(publicRoute==='#/welcome'||!user&&!['#/login','#/signup','#/reset-password'].includes(publicRoute))return <WelcomeScreen signedIn={!!user&&!!team}/>;
  if(!user||!team)return <div className="scout-auth-shell" style={sx.page}><main id="account-main" tabIndex={-1} className="workspace-main">{!user?<AuthScreen key={publicRoute} initialMode={publicRoute==='#/signup'?'signup':'login'} onLogin={login}/>:<TeamScreen user={user} onJoin={joinTeam} onLogout={logout}/>}</main></div>;
  const role=mem?.role||'member';
  const renderLegacy=(view,context={})=>view==='match'||view==='pit'?<FormsTab key={`${view}:${context.match_key||''}:${context.scouted_team||''}`} team={team} user={user} role={role} syncState={syncState} reportKind={view} context={context} onPending={()=>{offline.refresh();window.dispatchEvent(new Event('scout-report-saved'));}}/>:view==='news'?<AnnouncementsTab team={team} user={user} role={role}/>:view==='myteam'?<MyTeamTab key={context.event_key} team={team} eventKey={context.event_key}/>:view==='manage'?<ManageTab team={team} user={user} onTeamUpdate={t=>{setTeam(t);saveSession(user,t,mem);}} onRoleChange={refreshMem}/>:view==='sync'?<SyncPanel state={syncState} shellReady={shellReady} onClose={()=>{window.location.hash='/settings';}}/>:null;
  return <ArgusWorkspace workspace={team} user={user} role={role} onUserUpdate={async u=>{setUser(u);await saveSession(u,team,mem?{...mem,username:u.username}:mem);await offline.invalidateReadCache();}} onWorkspaceUpdate={t=>{setTeam(t);saveSession(user,t,mem);}} api={apiCall} syncState={syncState} shellReady={shellReady} renderLegacy={renderLegacy} onLogout={logout} onSwitchWorkspace={switchWorkspace} onLeaveWorkspace={leaveWorkspace} onArchive={archiveTeam} onDeactivate={deactivate} needRefresh={needRefresh} onUpdate={installUpdate}/>;
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onLogin, initialMode='login' }) {
  const [mode,setMode]=useState(window.location.hash==='#/reset-password'?'reset':initialMode);
  const [recoveryCode,setRecoveryCode]=useState('');
  const [notice,setNotice]=useState('');
  const heading=useRef(null);
  useEffect(()=>{heading.current?.focus();},[]);
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);

  async function submit() {
    if (busy) return;
    if (!username.trim()||!password.trim()) { setErr("All fields required."); return; }
    setBusy(true); setErr("");
    try {if(mode==='reset'){await apiCall('POST','/auth/reset-password',{username:username.trim(),recovery_code:recoveryCode.trim(),new_password:password});setPassword('');setRecoveryCode('');setMode('login');setNotice('Password reset. Sign in with your new password. Create a new recovery code in Settings.');}else{const u=await apiCall('POST',mode==='signup'?'/auth/signup':'/auth/login',{username:username.trim(),password});await onLogin(u);}}
    catch(error){setErr(error.message||'Could not sign in. Try again.');}
    setBusy(false);
  }

  return (
    <div className="auth-layout">
      <section className="auth-form-area" aria-label="Account access"><form className="auth-form-card" onSubmit={e=>{e.preventDefault();submit();}}>
        <a href="#/welcome">About Argus</a>
        <div className="auth-wordmark">Argus</div>
        <h1 tabIndex={-1} ref={heading}>{mode==='reset'?'Reset password':mode==='login'?'Sign in':'Create an account'}</h1><p className="muted">{mode==='reset'?'Use the recovery code you saved from Settings. Without a saved code, this form cannot recover your account.':mode==='login'?'Open your team scouting app.':'You can join your team after signing up. Save a recovery code from Settings after joining.'}</p>
        <div className="auth-tabs" role="group" aria-label="Account options">
          {["login","signup"].map(m=><button key={m} type="button" aria-pressed={mode===m} onClick={()=>{setMode(m);setErr("");}}>
            {m==="login"?"Sign in":"Create account"}
          </button>)}
        </div>
        <label htmlFor="scout-username" style={sx.lbl}>Username</label>
        <input id="scout-username" autoComplete="username" style={sx.inp} value={username} onChange={e=>setUsername(e.target.value)} placeholder="scouter42" autoCapitalize="none" />
        {mode==='reset'&&<><label htmlFor="scout-recovery" style={sx.lbl}>Saved recovery code</label><input id="scout-recovery" style={sx.inp} autoComplete="off" autoCapitalize="none" maxLength={48} value={recoveryCode} onChange={e=>setRecoveryCode(e.target.value)} required/></>}
        <label htmlFor="scout-password" style={sx.lbl}>{mode==='reset'?'New password':'Password'}</label>
        <input id="scout-password" autoComplete={mode==="login" ? "current-password" : "new-password"} style={sx.inp} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
        {err && <div role="alert" style={sx.err}>{err}</div>}{notice&&<p role="status">{notice}</p>}
        <button type="submit" className="primary-button auth-submit" disabled={busy}>{busy?'Please wait…':mode==='reset'?'Reset password':mode==='login'?'Sign in':'Create account'}</button>
        {mode==='login'&&<button type="button" className="a-button" onClick={()=>{setMode('reset');setErr('');setNotice('');setPassword('');}}>Forgot password?</button>}
      </form><span className="auth-footer">Argus {APP_VERSION} · Match and pit scouting</span></section>
    </div>
  );
}

// ─── Team Screen ──────────────────────────────────────────────────────────────
function TeamScreen({ user, onJoin, onLogout }) {
  const [mode,setMode]=useState(null);
  const [tNum,setTNum]=useState(""); const [tName,setTName]=useState("");
  const [jNum,setJNum]=useState(""); const [jPwd,setJPwd]=useState("");
  const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const [created,setCreated]=useState(null);
  const [cachedTeams,setCachedTeams]=useState([]);

  // On mount — check if user already has cached memberships so they can re-enter without password
  useEffect(()=>{
    (async()=>{
      try {
        const mems = await idbAll("memberships");
        const myMems = mems.filter(m=>m.user_id===user.id);
        if (myMems.length) {
          const teams = await idbAll("teams");
          const myTeams = myMems.map(m=>{
            const t = teams.find(t=>t.id===m.team_id);
            return t ? {team:t, mem:m} : null;
          }).filter(Boolean);
          setCachedTeams(myTeams);
        }
      } catch { /* Keep the previous downloaded state. */ }
    })();
  },[user.id]);

  async function createTeam() {
    if (!tNum.trim()||!tName.trim()) { setErr("Number and name required."); return; }
    setBusy(true); setErr("");
    try {
      const result=await apiCall('POST','/auth/create-team',{number:tNum.trim(),name:tName.trim()});setCreated(result);
    } catch(error) {setErr(error.message||'Could not create team.');}
    setBusy(false);
  }

  async function joinTeam() {
    if (!jNum.trim()||!jPwd.trim()) { setErr("Number and password required."); return; }
    setBusy(true); setErr("");
    try {
      const result=await apiCall('POST','/auth/join-team',{number:jNum.trim(),password:jPwd.trim()});await onJoin(result.team,result.mem);
    } catch(error) {setErr(error.message||'Could not join team.');}
    setBusy(false);
  }

  if (created) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"80vh"}}>
      <div style={{...sx.card,textAlign:"center",maxWidth:360}}>
        <div style={{fontSize:48,marginBottom:8}}>✅</div>
        <div style={{...sx.ct,textAlign:"center"}}>Team Created!</div>
        <div style={{background:C.bg0,border:`1px solid ${C.green}`,borderRadius:8,padding:20,margin:"16px 0"}}>
          <div style={{fontSize:11,color:C.muted,letterSpacing:2,marginBottom:6}}>Join password</div>
          <div style={{fontSize:28,fontWeight:700,color:C.green,letterSpacing:6}}>{created.team.password}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:6}}>Share this with your scouters</div>
        </div>
        <button style={sx.btn(C.green)} onClick={()=>onJoin(created.team,created.mem)}>Open team</button>
      </div>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"80vh"}}>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:22,fontWeight:700,color:C.accent,letterSpacing:4}}>ARGUS</div>
        <div style={{fontSize:12,color:C.muted,marginTop:4}}>as <span style={{color:C.accent}}>{user.username}</span></div>
      </div>

      {/* Rejoin cached teams instantly */}
      {cachedTeams.length > 0 && !mode && (
        <div style={{...sx.card,width:"100%",maxWidth:400,marginBottom:12}}>
          <div style={sx.ct}>Rejoin Team</div>
          {cachedTeams.map(({team,mem})=>(
            <div key={team.id} style={{...sx.row,cursor:"pointer"}} onClick={()=>onJoin(team,mem)}>
              <div style={sx.avatar(RC[mem.role]||C.muted)}>#{team.number.slice(-2)}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700}}>{team.name}</div>
                <span style={sx.tag(RC[mem.role]||C.muted)}>{mem.role?.toUpperCase()}</span>
              </div>
              <button style={sx.sm(C.green)}>Open team</button>
            </div>
          ))}
        </div>
      )}

      <div style={{...sx.card,width:"100%",maxWidth:400}}>
        <div style={sx.ct}>Join or Create</div>
        {!mode && <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <button style={sx.btn(C.accent)} onClick={()=>setMode("create")}>Create team</button>
          <button style={sx.btn(C.orange)} onClick={()=>setMode("join")}>Join team</button>
          <div style={sx.hr}/>
          <button style={sx.btn(C.red)} onClick={onLogout}>Sign out</button>
        </div>}
        {mode==="create"&&<>
          <button style={{...sx.sm(),marginBottom:12}} onClick={()=>{setMode(null);setErr("");}}>Back</button>
          <label style={sx.lbl}>Team Number</label>
          <input style={sx.inp} placeholder="e.g. 4027" value={tNum} onChange={e=>setTNum(e.target.value)} inputMode="numeric"/>
          <label style={sx.lbl}>Team name</label>
          <input style={sx.inp} placeholder="e.g. Tidal Force" value={tName} onChange={e=>setTName(e.target.value)}/>
          {err&&<div style={sx.err}>{err}</div>}
          <button style={sx.btn(C.green)} onClick={createTeam} disabled={busy}>{busy?"CREATING…":"CREATE TEAM →"}</button>
        </>}
        {mode==="join"&&<>
          <button style={{...sx.sm(),marginBottom:12}} onClick={()=>{setMode(null);setErr("");}}>Back</button>
          <label style={sx.lbl}>Team Number</label>
          <input style={sx.inp} placeholder="e.g. 4027" value={jNum} onChange={e=>setJNum(e.target.value)} inputMode="numeric"/>
          <label style={sx.lbl}>Team Password</label>
          <input style={sx.inp} placeholder="ABCD1234" value={jPwd} onChange={e=>setJPwd(e.target.value.toUpperCase())} autoCapitalize="characters"/>
          {err&&<div style={sx.err}>{err}</div>}
          <button style={sx.btn(C.accent)} onClick={joinTeam} disabled={busy}>{busy?"JOINING…":"JOIN TEAM →"}</button>
        </>}
      </div>
    </div>
  );
}

// ─── Home Tab ─────────────────────────────────────────────────────────────────

// ─── Announcements Tab (offline-aware) ───────────────────────────────────────
function AnnouncementsTab({ team, user, role }) {
  const [announcements,setAnnouncements]=useState([]);
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  const [showForm,setShowForm]=useState(false);
  const isPrivileged = role==="owner"||role==="admin";

  useEffect(()=>{
    (async()=>{
      const all = await idbAll("announcements");
      const local = all.filter(a=>a.team_id===team.id);
      local.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      setAnnouncements(local);
    })();
  },[team.id]);

  async function post() {
    if (!title.trim()||!body.trim()) { setErr("Title and body required."); return; }
    setBusy(true); setErr("");
    try {
      const ann={id:uid(),team_id:team.id,title:title.trim(),body:body.trim(),author:user.username,author_role:role,created_at:tsNow()};
      await idbPut("announcements",ann);
      setAnnouncements(as=>[ann,...as]);
      setTitle(""); setBody(""); setShowForm(false);
    } catch { setErr("Error posting."); }
    setBusy(false);
  }

  async function deleteAnn(a) {
    if (!confirm("Delete this announcement?")) return;
    try { await idbDel("announcements",a.id); setAnnouncements(as=>as.filter(x=>x.id!==a.id)); } catch { alert("Error deleting."); }
  }

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div><h1 className="page-title">Team news</h1><p className="page-subtitle">Updates and notes for your scouting crew.</p></div>
        {isPrivileged&&<button className="quiet-button" onClick={()=>setShowForm(s=>!s)}>{showForm?"Cancel":"Post update"}</button>}
      </div>
      {showForm&&isPrivileged&&(
        <div style={sx.card}>
          <div style={sx.ct}>Post Announcement</div>
          <label htmlFor="announcement-title" style={sx.lbl}>Title</label>
          <input id="announcement-title" style={sx.inp} placeholder="e.g. Match schedule updated" value={title} onChange={e=>setTitle(e.target.value)}/>
          <label htmlFor="announcement-message" style={sx.lbl}>Message</label>
          <textarea id="announcement-message" style={{...sx.inp,height:100,resize:"vertical"}} placeholder="Type your announcement…" value={body} onChange={e=>setBody(e.target.value)}/>
          {err&&<div style={sx.err}>{err}</div>}
          <button style={sx.btn(C.orange)} onClick={post} disabled={busy}>{busy?"Posting…":"Post update"}</button>
        </div>
      )}
      {announcements.length===0&&!showForm&&(
        <div style={{...sx.card,textAlign:"center",color:C.muted,padding:40}}>
          <span className="empty-icon centered-icon"><Icon name="news" size={26}/></span>
          <h2>No team updates yet</h2><p className="muted">{isPrivileged?"Post an announcement to share schedules, reminders, or match notes.":"Announcements from your scouting lead will appear here."}</p>
        </div>
      )}
      {announcements.map(a=>(
        <div key={a.id} style={{...sx.card,borderLeft:`3px solid ${C.orange}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1,marginRight:8}}>
              <div style={{fontSize:15,fontWeight:700,color:C.orange,marginBottom:4}}>{a.title}</div>
              <div style={{fontSize:13,color:C.text,lineHeight:1.6,marginBottom:8}}>{a.body}</div>
              <div style={{fontSize:10,color:C.muted}}>
                <span style={sx.tag(RC[a.author_role]||C.muted)}>{(a.author_role||"member").toUpperCase()}</span>
                <span style={{marginLeft:8}}>{a.author}</span>
                <span style={{marginLeft:8}}>{fmtTs(a.created_at)}</span>
              </div>
            </div>
            {isPrivileged&&<button style={sx.sm(C.red)} onClick={()=>deleteAnn(a)}>Delete</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Forms Tab ────────────────────────────────────────────────────────────────
function FormsTab({ team, user, role, syncState, onPending, reportKind, context={} }) {
  const [forms,setForms]=useState([]);
  const [view,setView]=useState("list"); // list | create | fill | edit
  const [active,setActive]=useState(null);
  const [search,setSearch]=useState('');
  const [drafts,setDrafts]=useState([]);
  const [loadError,setLoadError]=useState('');
  const [loading,setLoading]=useState(true);
  const canEdit=syncState.connection==='online';
  const openedContext=useRef(null);
  const hasDraft=form=>drafts.some(row=>row.key===draftKey(user.id,team.id,form.id));
  const scopedForms=forms.filter(form=>hasDraft(form)||(!form.archived&&!form.archived_at&&(!reportKind||!form.kind||form.kind===reportKind)));
  const matchingForms=scopedForms.filter(form=>(form.title||'').toLowerCase().includes(search.toLowerCase()));
  useEffect(()=>{
    if(loading||!context.form_id||openedContext.current===context.form_id)return;
    const selected=forms.find(form=>form.id===context.form_id&&(!form.archived||drafts.some(row=>row.key===draftKey(user.id,team.id,form.id)))&&(!reportKind||!form.kind||form.kind===reportKind));
    let active=true;
    if(selected)Promise.resolve().then(()=>{if(active){openedContext.current=context.form_id;setActive(selected);setView('fill');}});
    return ()=>{active=false;};
  },[loading,forms,drafts,context.form_id,reportKind,user.id,team.id]);

  const load=useCallback(async()=>{
    try { const r=await fbSelect("forms",{team_id:team.id}); setForms(r);setLoadError('');setDrafts(await deviceStore.all('drafts')); }
    catch(error) { setLoadError(error.message); }
    finally{setLoading(false);}
  },[team.id]);
  useEffect(()=>{Promise.resolve().then(load);},[load]);

  async function deleteForm(f,e) {
    e.stopPropagation();
    if (!confirm(`Archive "${f.title}"? Existing reports and question definitions will be preserved.`)) return;
    try { await fbInsert("forms",{...f,archived:true,updated_at:tsNow()}); setForms(fs=>fs.map(x=>x.id===f.id?{...x,archived:true}:x)); }
    catch { alert("Error archiving form."); }
  }

  if (view==="create") return <FormBuilder reportKind={reportKind} team={team} user={user} onSave={()=>{setView("list");load();}} onCancel={()=>setView("list")}/>;
  if (view==="edit"&&active) return <FormBuilder reportKind={reportKind} team={team} user={user} editing={active} onSave={()=>{setView("list");load();}} onCancel={()=>setView("list")}/>;
  if (view==="fill"&&active) return <FormFiller key={active.id} context={context} reportKind={reportKind} form={active} user={user} team={team} onDone={()=>{setView("list");load();onPending();}} onCancel={()=>{setView("list");load();}}/>;

  return (
    <div className="page-enter">
      <div className="section-heading page-heading">
        <div><h1 className="page-title">{reportKind==='pit'?'Pit scouting':reportKind==='match'?'Match scouting':'Scouting forms'}</h1><p className="page-subtitle">Legacy forms stay available until explicitly categorized.</p></div>
        {(role==="owner"||role==="admin")&&<button style={{...sx.btn(),width:'auto'}} disabled={!canEdit} onClick={()=>setView("create")}>New form</button>}
      </div>
      <div className="forms-toolbar"><input aria-label="Search forms" placeholder="Find a scouting form…" value={search} onChange={e=>setSearch(e.target.value)}/><span className="outline-tag">{scopedForms.length} {scopedForms.length===1?'form':'forms'} on this device</span></div>
      {!canEdit&&<div className="notice">Downloaded forms are ready to fill out offline. Creating and editing form templates needs a server connection.</div>}
      {loadError&&<div className="notice notice-error" role="alert">{loadError}</div>}
      {loading&&<div className="panel" role="status">Loading your team’s forms…</div>}
      {!loading&&scopedForms.length===0&&(
        <div style={{...sx.card,textAlign:"center",color:C.muted,padding:40}}>
          <span className="empty-icon centered-icon"><Icon name="forms" size={26}/></span>
          <div>{(role==="owner"||role==="admin")?"No forms yet. Create one above.":"No forms yet. Ask an admin."}</div>
        </div>
      )}
      <div className="forms-grid">
      {matchingForms.map(f=>(
        <div key={f.id} className="form-tile" style={sx.card}>
          <div className="form-tile-content">
            <div style={{flex:1,cursor:"pointer"}} onClick={()=>{setActive(f);setView("fill");}}>
              <div className="form-type"><NavIcon name="forms"/><span>{f.archived?'Archived / unfinished draft':f.kind==='match'?'Match scouting':f.kind==='pit'?'Pit scouting':'Uncategorized legacy form'}</span></div>
              <h2>{f.title}</h2>
              <div style={{fontSize:13,color:C.muted}}>
                {f.questions?.length||0} questions{f.created_by?`, by ${f.created_by}`:''}
                {f.max_submissions_per_team&&<span style={{marginLeft:6,...sx.tag(C.orange)}}>Up to {f.max_submissions_per_team} reports per team</span>}
              </div>
            </div>
            <div className="form-tile-actions">
              <button className="primary-button" onClick={()=>{setActive(f);setView("fill");}}>{drafts.some(d=>d.key===draftKey(user.id,team.id,f.id))?'Resume draft':'Open form'}<Icon name="arrow" size={16}/></button>
              {(role==="owner"||role==="admin")&&<button style={sx.sm(C.muted)} disabled={!canEdit||f.archived} aria-label={`Edit ${f.title}`} onClick={e=>{e.stopPropagation();setActive(f);setView("edit");}}>Edit</button>}
              {(role==="owner"||role==="admin")&&<button style={sx.sm(C.muted)} disabled={!canEdit||f.archived} aria-label={`Archive ${f.title}`} onClick={e=>deleteForm(f,e)}>Archive</button>}
            </div>
          </div>
        </div>
      ))}
      </div>
      {scopedForms.length>0&&matchingForms.length===0&&<div className="panel empty-state">No forms match “{search}”. Try another name.</div>}
    </div>
  );
}

// ─── Form Builder (create + edit) ────────────────────────────────────────────
const QTYPES=[{id:"text",l:"Text"},{id:"number",l:"Number"},{id:"scale",l:"Scale 1–10"},{id:"select",l:"Multiple Choice"},{id:"boolean",l:"Yes / No"},{id:"draw",l:"Draw on Field"},{id:"photo",l:"Photo"}];

function FormBuilder({ team, user, editing, onSave, onCancel, reportKind }) {
  const [kind,setKind]=useState(editing?.kind || reportKind || 'match');
  const [title,setTitle]=useState(editing?.title||"");
  const [qs,setQs]=useState(editing?.questions||[]);
  const [allowTeamSelect,setAllowTeamSelect]=useState(editing?.allow_team_select??true);
  const [maxPerTeam,setMaxPerTeam]=useState(editing?.max_submissions_per_team||"");
  const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);

  function addQ()       { setQs(q=>[...q,{id:uid(),text:"",type:"text",required:false,options:[]}]); }
  function upd(i,k,v)   { setQs(q=>q.map((x,j)=>j===i?{...x,[k]:v}:x)); }
  function del(i)        { setQs(q=>q.filter((_,j)=>j!==i)); }
  function move(i,d)     { setQs(q=>{const a=[...q],b=i+d;if(b<0||b>=a.length)return a;[a[i],a[b]]=[a[b],a[i]];return a;}); }

  async function save() {
    if (!title.trim())              { setErr("Title required."); return; }
    if (!qs.length)                 { setErr("Add at least one question."); return; }
    if (qs.some(q=>!q.text.trim())){ setErr("All questions need text."); return; }
    const conditionError = validateConditions(qs);
    if (conditionError) { setErr(conditionError); return; }
    if(allowTeamSelect&&maxPerTeam&&(!Number.isInteger(Number(maxPerTeam))||Number(maxPerTeam)<1)){setErr('Enter a positive whole-number submission limit.');return;}
    setBusy(true); setErr("");
    const form={
      ...editing,
      kind,
      id: editing?.id||uid(),
      team_id:team.id,
      title:title.trim(),
      questions:qs,
      allow_team_select:allowTeamSelect,
      max_submissions_per_team:allowTeamSelect&&maxPerTeam?Number(maxPerTeam):null,
      created_by: editing?.created_by||user.username,
      created_at: editing?.created_at||tsNow(),
      updated_at:tsNow(),
    };
    try { await fbInsert("forms",form); window.dispatchEvent(new Event('argus-workspace-updated')); onSave(); }
    catch { setErr("Error saving form."); }
    setBusy(false);
  }

  return (
    <div className="form-builder page-enter">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <button style={sx.sm()} onClick={onCancel}>Back</button>
        <div style={{fontSize:20,fontWeight:650,color:C.text}}>{editing?"Edit form":"New form"}</div>
      </div>
      <div style={sx.card}>
        <label style={sx.lbl}>Report type</label><select aria-label="Report type" style={sx.inp} value={kind} onChange={e=>setKind(e.target.value)}><option value="match">Match scouting</option><option value="pit">Pit scouting</option></select>
        <label style={sx.lbl}>Form title</label>
        <input style={sx.inp} placeholder="e.g. Qual Match Scout" value={title} onChange={e=>setTitle(e.target.value)}/>
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.text,cursor:"pointer"}}>
            <input type="checkbox" checked={allowTeamSelect} onChange={e=>setAllowTeamSelect(e.target.checked)}/>
            Scouter picks team being scouted
          </label>
        </div>
        {allowTeamSelect&&(
          <>
            <label style={sx.lbl}>Max submissions per team per event (blank = unlimited)</label>
            <input style={{...sx.inp,marginBottom:0}} aria-label="Max submissions per team per event" type="number" min="1" step="1" placeholder="e.g. 1" value={maxPerTeam} onChange={e=>setMaxPerTeam(e.target.value)} inputMode="numeric"/>
          </>
        )}
      </div>
      {qs.map((q,i)=>(
        <div key={q.id} style={sx.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:11,color:C.accent}}>Q{i+1}</span>
              <button style={sx.sm(C.muted)} onClick={()=>move(i,-1)}>↑</button>
              <button style={sx.sm(C.muted)} onClick={()=>move(i,+1)}>↓</button>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.muted,cursor:"pointer"}}>
                <input type="checkbox" checked={q.required} onChange={e=>upd(i,"required",e.target.checked)}/> Required
              </label>
              <button style={sx.sm(C.red)} onClick={()=>del(i)}>✕</button>
            </div>
          </div>
          <label style={sx.lbl}>Question</label>
          <input style={sx.inp} placeholder="e.g. Auto pieces scored?" value={q.text} onChange={e=>upd(i,"text",e.target.value)}/>
          <label style={sx.lbl}>Type</label>
          <select style={sx.inp} value={q.type} onChange={e=>upd(i,"type",e.target.value)}>
            {QTYPES.map(t=><option key={t.id} value={t.id}>{t.l}</option>)}
          </select>
          <label style={sx.lbl}>Phase (optional, explicitly configured)</label>
          <select aria-label={`Phase for question ${i+1}`} style={sx.inp} value={q.phase||''} onChange={e=>upd(i,'phase',e.target.value||null)}><option value="">No phase / general observation</option><option value="auto">Autonomous</option><option value="teleop">Teleoperated</option><option value="endgame">Endgame</option></select>
          {q.type==='number'&&<><label style={sx.lbl}>Counter step</label><input aria-label={`Counter step for question ${i+1}`} style={sx.inp} type="number" min="0.000001" step="any" value={q.step??1} onChange={e=>upd(i,'step',e.target.value===''?'':Number(e.target.value))}/></>}
          {q.type==="select"&&<>
            <label style={sx.lbl}>Options (one per line)</label>
            <textarea style={{...sx.inp,height:80,resize:"vertical"}} value={q.options?.join("\n")||""} onChange={e=>upd(i,"options",e.target.value.split("\n"))} placeholder={"Option A\nOption B\nOption C"}/>
          </>}
          {q.type==="draw"&&<>
            <label style={sx.lbl}>Background image URL (optional)</label>
            <input style={sx.inp} placeholder="https://… or blank for default field" value={q.imageUrl||""} onChange={e=>upd(i,"imageUrl",e.target.value)}/>
          </>}
          <ConditionEditor question={q} earlier={qs.slice(0,i)} onChange={value=>upd(i,"visibility",value)}/>
        </div>
      ))}
      <button style={{...sx.btn(C.muted),marginBottom:10}} onClick={addQ}>Add question</button>
      {err&&<div style={sx.err}>{err}</div>}
      <button style={sx.btn()} onClick={save} disabled={busy}>{busy?"Saving…":"Save form"}</button>
    </div>
  );
}

function ConditionEditor({ question, earlier, onChange }) {
  const visibility = question.visibility || { mode: 'all', rules: [] };
  const rules = visibility.rules || [];
  function update(index, patch) {
    onChange({ ...visibility, rules: rules.map((rule, i) => i === index ? { ...rule, ...patch } : rule) });
  }
  return <section className="condition-editor" aria-label="Question visibility">
    <div className="condition-heading"><div><strong>When to show this question</strong>
      <p>{rules.length ? 'Only show it when these conditions match.' : 'Always visible to the scouter.'}</p></div>
      <button type="button" style={sx.sm()} disabled={!earlier.length} onClick={()=>onChange({ ...visibility, rules:[...rules, { questionId:earlier[0].id, operator:'answered', value:'' }] })}>Add condition</button>
    </div>
    {!earlier.length && <p className="field-help">Conditions can use questions above this one.</p>}
    {rules.length > 1 && <label className="condition-mode">Show when <select aria-label="Combine conditions" value={visibility.mode || 'all'} onChange={e=>onChange({...visibility, mode:e.target.value})}>
      <option value="all">all conditions match</option><option value="any">any condition matches</option>
    </select></label>}
    {rules.map((rule,index)=>{
      const source = earlier.find(q=>q.id===rule.questionId);
      const needsValue = !['answered','unanswered'].includes(rule.operator);
      const choices = source?.type === 'boolean' ? ['Yes','No'] : source?.type === 'select' ? (source.options||[]).filter(o=>o.trim()) : null;
      return <div key={index} className="condition-row">
        <select aria-label={`Condition ${index+1} source question`} style={sx.inp} value={rule.questionId} onChange={e=>update(index,{questionId:e.target.value,operator:'answered',value:''})}>
          {!source && <option value={rule.questionId}>Choose a question above</option>}
          {earlier.map((q,i)=><option key={q.id} value={q.id}>{i+1}. {q.text || 'Untitled question'}</option>)}
        </select>
        <select aria-label={`Condition ${index+1} comparison`} style={sx.inp} value={rule.operator} onChange={e=>update(index,{operator:e.target.value,value:''})}>
          {!conditionOperators(source?.type).some(([id])=>id===rule.operator) && <option value={rule.operator}>Choose a comparison</option>}
          {conditionOperators(source?.type).map(([id,label])=><option key={id} value={id}>{label}</option>)}
        </select>
        {needsValue && (choices ? <select aria-label={`Condition ${index+1} answer`} style={sx.inp} value={rule.value ?? ''} onChange={e=>update(index,{value:e.target.value})}>
          <option value="">Choose an answer</option>{choices.map(choice=><option key={choice} value={choice}>{choice}</option>)}
        </select> : <input aria-label={`Condition ${index+1} value`} style={sx.inp} type={['number','scale'].includes(source?.type)?'number':'text'} step="any" placeholder="Value to match" value={rule.value ?? ''} onChange={e=>update(index,{value:e.target.value})}/>)}
        <button type="button" style={sx.sm(C.muted)} aria-label={`Remove condition ${index+1}`} onClick={()=>onChange({...visibility,rules:rules.filter((_,i)=>i!==index)})}>Remove</button>
      </div>;
    })}
  </section>;
}

// ─── Form Filler ──────────────────────────────────────────────────────────────
export function FormFiller({ form, user, team, onDone, onCancel, reportKind, context={}, practice=false }) {
  const localDraftKey=practice?`practice:${draftKey(user.id,team.id,form.id)}`:draftKey(user.id,team.id,form.id);
  const draft=useReportDraft(localDraftKey,()=>({id:uid(),questions_snapshot:structuredClone(form.questions||[]),form_title:form.title,answers:{},scoutedTeam:context.scouted_team==null?'':String(context.scouted_team),event_key:context.event_key || context.event?.event_key || '',match_key:context.match_key || '',match_number:context.match_number ?? '',alliance:context.alliance || '',assignment_id:context.assignment_id || null,report_kind:form.kind || reportKind || 'match'}));
  const questions=draft.value.questions_snapshot||form.questions||[];
  const ans=draft.value.answers || {};
  const setContext=(field,value)=>draft.change(current=>({...current,[field]:value}));
  const contextDiffers=!!((context.event_key&&draft.value.event_key!==context.event_key)||(context.match_key&&draft.value.match_key!==context.match_key)||(context.scouted_team&&String(context.scouted_team)!==String(draft.value.scoutedTeam)));
  const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const scoutedTeam=draft.value.scoutedTeam ?? '';
  const setScoutedTeam=value=>draft.change(current=>{const event=availableEvents.find(event=>event.event_key===current.event_key),match=event?.matches?.find(match=>match.key===current.match_key),slot=assignedRobots({event,match,assignments:assignmentData,userId:user.id}).find(slot=>slot.teamNumber===String(value));return {...current,scoutedTeam:value,assignment_id:slot?.assignment?.id||null,alliance:slot?.alliance||current.alliance};});
  const [eventTeams,setEventTeams]=useState([]);
  const [availableEvents,setAvailableEvents]=useState([]);
  const [assignmentData,setAssignmentData]=useState([]);
  const isMatchForm=!practice&&(form.kind||reportKind||'match')!=='pit';
  const reportEvent=availableEvents.find(event=>event.event_key===draft.value.event_key);
  const reportMatch=reportEvent?.matches?.find(match=>match.key===draft.value.match_key);
  const allowedReportRobots=assignedRobots({event:reportEvent,match:reportMatch,assignments:assignmentData,userId:user.id});
  const selectableTeams=isMatchForm?allowedReportRobots.map(slot=>eventTeams.find(team=>String(team.team_number)===slot.teamNumber)||{team_number:slot.teamNumber}):eventTeams;
  const [subCounts,setSubCounts]=useState({});
  const [countsFresh,setCountsFresh]=useState(false);
  const countsRefresh=useRef(null),knownCounts=useRef({});
  useEffect(()=>{
    let active=true,metadataLoaded=false,sequence=0;
    async function load(updateContext=false){
      const version=++sequence;
      if(!metadataLoaded||updateContext)try {
        const [events,assigned]=await Promise.all([idbAll('scout_events'),idbAll('assignments')]);
        const owned=events.filter(e=>e.team_id===team.id),event=owned.find(e=>e.event_key===draft.value.event_key);
        if(active&&version===sequence){setAssignmentData(assigned);setAvailableEvents(owned);setEventTeams(event?.event_teams||[]);metadataLoaded=true;}
      }catch{/* Keep the last downloaded context and draft. */}
      if(practice||!form.max_submissions_per_team)return {};
      let counts;
      try{
        counts={...await apiCall('GET',`/form-submission-counts/${encodeURIComponent(form.id)}?event_key=${encodeURIComponent(draft.value.event_key||'')}`)};
        for(const entry of await offline.pending()){const row=entry.row;if(row.team_id===team.id&&row.form_id===form.id&&(row.event_key||'')===(draft.value.event_key||'')&&row.scouted_team)counts[row.scouted_team]=(counts[row.scouted_team]||0)+1;}
        if(active&&version===sequence)setCountsFresh(navigator.onLine!==false);
      }catch{
        if(active&&version===sequence)setCountsFresh(false);
        try{const reports=await fbSelect('submissions',{form_id:form.id});counts={};for(const row of reports)if((row.event_key||'')===(draft.value.event_key||'')&&row.scouted_team)counts[row.scouted_team]=(counts[row.scouted_team]||0)+1;}catch{return knownCounts.current;}
      }
      if(active&&version===sequence){knownCounts.current=counts;setSubCounts(counts);}return counts;
    }
    countsRefresh.current=load;
    const stop=watchLive(()=>load()),changed=()=>load(true),disconnected=()=>setCountsFresh(false);window.addEventListener('argus-live-updated',changed);window.addEventListener('scout-report-saved',changed);window.addEventListener('offline',disconnected);
    return()=>{active=false;stop();countsRefresh.current=null;window.removeEventListener('argus-live-updated',changed);window.removeEventListener('scout-report-saved',changed);window.removeEventListener('offline',disconnected);};
  },[draft.value.event_key,team.id,form.id,form.max_submissions_per_team,practice]);

  const shownQuestions = visibleQuestions(questions, ans);
  function set(id,v){ draft.change(current=>({...current,answers:visibleAnswers(questions,{...current.answers,[id]:v})}));setErr(''); }

  async function submit() {
    if (busy) return;
    if (form.allow_team_select && !scoutedTeam) { setErr("Please select the team you are scouting."); return; }
    const missing=shownQuestions.filter(q=>q.required&&!hasAnswer(ans[q.id]));
    if (missing.length){ setErr(`Required: ${missing.map(q=>q.text).join(", ")}`); return; }
    if(draft.value.match_number!=null&&draft.value.match_number!==''&&!Number.isFinite(Number(draft.value.match_number))){setErr('Enter a valid match number.');return;}
    setBusy(true); setErr("");
    if(!practice&&form.max_submissions_per_team&&scoutedTeam){
      const latest=await countsRefresh.current?.()||knownCounts.current;
      const count=latest[scoutedTeam]||0;
      if(count>=form.max_submissions_per_team){
        try{await draft.flush();setErr(`Team #${scoutedTeam} has already been scouted ${count} times (max: ${form.max_submissions_per_team}). Your draft has been kept.`);}catch{setErr('This team has reached its report limit, and the draft could not be saved. Keep this page open and free up browser storage.');}
        setBusy(false);return;
      }
    }
    const sub={id:draft.value.id,form_id:form.id,form_title:draft.value.form_title||form.title,team_id:team.id,scouted_team:scoutedTeam||null,submitted_by:user.username,user_id:user.id,event_key:draft.value.event_key||null,match_key:draft.value.match_key||null,match_number:draft.value.match_number==null||draft.value.match_number===''?null:Number(draft.value.match_number),alliance:draft.value.alliance||null,assignment_id:draft.value.assignment_id||null,report_kind:draft.value.report_kind||form.kind||reportKind||'match',questions_snapshot:structuredClone(questions||[]),answers:visibleAnswers(questions,ans),created_at:tsNow()};
    try {
      if(isMatchForm){const [events,assignments]=await Promise.all([idbAll('scout_events'),idbAll('assignments')]);const event=events.find(event=>event.team_id===team.id&&event.event_key===sub.event_key);const accessError=matchReportError({event,assignments,userId:user.id,report:sub});if(accessError)throw new Error(accessError);}
      await draft.flush();
      await offline.enqueue(practice?{...sub,practice:true,event_key:'practice',match_key:null,assignment_id:null}:sub,localDraftKey,practice?'practice':'submissions');
      setDone(true);
    } catch(error) { setErr(error.message || 'Could not save this report. Keep the page open and try again.'); }
    setBusy(false);
  }

  if (done) return (
    <div className="panel success-panel">
      <div className="success-mark" aria-hidden="true">✓</div>
      <h1>{practice?'Practice report saved.':'Report saved.'}</h1>
      <p>Saved on this device. Argus uploads it automatically when the server is reachable. Check the sync indicator for its upload status.</p>
      <button style={sx.btn(C.accent)} onClick={onDone}>Back to forms</button>
    </div>
  );

  if(!draft.ready)return <div className="panel" role="status">Opening your saved draft…</div>;

  return (
    <div className="report-layout page-enter">
      <div className="report-heading"><button style={sx.sm()} onClick={onCancel}>← Back</button><div><span className="eyebrow">Scouting report</span><h1>{form.title}</h1></div></div>
      <aside className="report-summary panel"><span className="eyebrow">Your progress</span><strong className="progress-count">{shownQuestions.filter(q=>hasAnswer(ans[q.id])).length}<small> / {shownQuestions.length}</small></strong><progress value={shownQuestions.filter(q=>hasAnswer(ans[q.id])).length} max={Math.max(1,shownQuestions.length)}/><p>{draft.saving?'Saving draft…':draft.error?'Draft needs attention':'Draft saved as you go'}</p><p className="muted">You can leave this form and return later. Submit when you're finished to add it to the upload queue.</p><span className="outline-tag">Offline saving enabled</span></aside>
      <div className="report-questions">
      {draft.error&&<div className="notice notice-error" role="alert">{draft.error}</div>}

      {contextDiffers&&<div className="notice" role="status">A saved draft has different team, event, or match context. Its values have been preserved. Review the fields below before submitting.</div>}
      <section style={sx.card} aria-labelledby="report-context-title"><h2 id="report-context-title" style={{fontSize:18,marginTop:0}}>Report context</h2>
        {isMatchForm&&<label style={sx.lbl}>Your assigned match<select style={sx.inp} aria-label="Your assigned match" value={draft.value.match_key||''} onChange={e=>{const match=reportEvent?.matches?.find(match=>match.key===e.target.value),slot=assignedRobots({event:reportEvent,match,assignments:assignmentData,userId:user.id})[0];if(match&&slot)draft.change(current=>({...current,match_key:match.key,match_number:match.match_number,alliance:slot.alliance,scoutedTeam:slot.teamNumber,assignment_id:slot.assignment?.id||null}));}}><option value="">Choose an assigned match</option>{(reportEvent?.matches||[]).filter(match=>assignedRobots({event:reportEvent,match,assignments:assignmentData,userId:user.id}).length).map(match=><option value={match.key} key={match.key}>Match {match.match_number}</option>)}</select></label>}
        <label style={sx.lbl} htmlFor="report-event">Event key</label><input id="report-event" readOnly={isMatchForm} list="report-events" style={sx.inp} value={draft.value.event_key||''} onChange={e=>draft.change(current=>({...current,event_key:e.target.value,assignment_id:null}))} placeholder="Event key, or blank for an unlinked report"/><datalist id="report-events">{availableEvents.map(event=><option key={event.id||event.event_key} value={event.event_key}>{event.event_name}</option>)}</datalist>
        <p className="muted" style={{fontSize:12}}>{isMatchForm?'Match reports use your assigned event and robot. Ask a coordinator or accept a handoff to change coverage.':'Blank event keys stay unlinked and are excluded from event analytics.'}</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12}}><div><label style={sx.lbl} htmlFor="report-match">Match key</label><input id="report-match" readOnly={isMatchForm} style={sx.inp} value={draft.value.match_key||''} onChange={e=>draft.change(current=>({...current,match_key:e.target.value,assignment_id:null}))} placeholder="e.g. 2026event_qm1"/></div><div><label style={sx.lbl} htmlFor="report-match-number">Match number</label><input id="report-match-number" readOnly={isMatchForm} type="number" style={sx.inp} value={draft.value.match_number??''} onChange={e=>setContext('match_number',e.target.value)}/></div><div><label style={sx.lbl} htmlFor="report-alliance">Alliance</label><select id="report-alliance" disabled={isMatchForm} style={sx.inp} value={draft.value.alliance||''} onChange={e=>setContext('alliance',e.target.value)}><option value="">Unknown / not applicable</option><option value="red">Red alliance</option><option value="blue">Blue alliance</option></select></div></div>
        <label style={sx.lbl} htmlFor="report-kind">Report type</label><select id="report-kind" disabled style={sx.inp} value={draft.value.report_kind||form.kind||reportKind||'match'} onChange={e=>setContext('report_kind',e.target.value)}><option value="match">Match scouting</option><option value="pit">Pit scouting</option></select>
        <label style={sx.lbl} htmlFor="report-scout">Scout identity</label><input id="report-scout" style={sx.inp} value={user.username} readOnly/><p className="muted" style={{fontSize:12}}>Reports use your signed-in identity.{draft.value.assignment_id?' Linked assignment: '+draft.value.assignment_id:''}</p>
      </section>
      {!practice&&form.max_submissions_per_team&&<p className="muted" role="status">{countsFresh?'Report limits update automatically while connected.':'Report limits could not be checked live. Downloaded counts may be out of date; the server checks the limit when reports upload.'}</p>}
      {/* Team selector */}
      {(form.allow_team_select||isMatchForm)&&(
        <div style={sx.card}>
          <label htmlFor="report-scouted-team" style={sx.lbl}>Team you are scouting *</label>
          {selectableTeams.length > 0||isMatchForm ? (
            <select id="report-scouted-team" style={sx.inp} value={scoutedTeam} onChange={e=>setScoutedTeam(e.target.value)}>
              <option value="">— Select Team —</option>
              {selectableTeams.map(t=>{
                const count = subCounts[t.team_number]||0;
                const atMax = form.max_submissions_per_team && count >= form.max_submissions_per_team;
                return <option key={t.team_number} value={t.team_number} disabled={atMax}>
                  #{t.team_number}{t.nickname?` — ${t.nickname}`:""}{atMax?" [MAXED]":""}
                </option>;
              })}
            </select>
          ) : (
            <input id="report-scouted-team" style={sx.inp} placeholder="Team number e.g. 4027" value={scoutedTeam} onChange={e=>setScoutedTeam(e.target.value)} inputMode="numeric"/>
          )}
        </div>
      )}

      <div className="form-progress">{shownQuestions.filter(q=>hasAnswer(ans[q.id])).length} of {shownQuestions.length} questions answered <span>Required questions are marked *</span></div>
      {shownQuestions.map((q,i)=>(
        <div key={q.id} className="question-card" style={sx.card}>
          {['auto','teleop','endgame'].includes(q.phase)&&shownQuestions[i-1]?.phase!==q.phase&&<h2 style={{fontSize:18,margin:'0 0 16px'}}>{{auto:'Autonomous',teleop:'Teleoperated',endgame:'Endgame'}[q.phase]}</h2>}
          <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>{i+1}. {q.text}{q.required&&<span style={{color:C.red,marginLeft:4}}>*</span>}</div>
          <QInput q={q} value={ans[q.id]} onChange={v=>set(q.id,v)}/>
        </div>
      ))}
      {err&&<div role="alert" style={{...sx.err,marginBottom:10}}>{err}</div>}
      <button style={sx.btn()} onClick={submit} disabled={busy}>{busy?"Saving report…":"Submit scouting report"}</button>
      </div>
    </div>
  );
}

// ─── Draw Input (own component so hooks run unconditionally) ─────────────────

// ─── Question Input ───────────────────────────────────────────────────────────
function QInput({ q, value, onChange }) {
  if (q.type==="text")    return <textarea aria-label={q.text} style={{...sx.inp,height:100,resize:"vertical",marginBottom:0}} value={value||""} onChange={e=>onChange(e.target.value)} placeholder="Type your answer…"/>;
  if (q.type==="number") {
    const step=Number(q.step)>0?Number(q.step):1;
    const increment=direction=>{const base=value==null||value===''?0:Number(value);onChange(Number(((Number.isFinite(base)?base:0)+direction*step).toPrecision(12)));};
    return <div style={{display:'flex',gap:12,alignItems:'center'}}><button type="button" aria-label={`Decrease ${q.text} by ${step}`} style={{...sx.sm(),width:54,height:54,fontSize:26,flexShrink:0}} onClick={()=>increment(-1)}>−</button><input aria-label={q.text} style={{...sx.inp,marginBottom:0,minWidth:0,textAlign:'center',fontSize:26,height:54}} type="number" step={step} inputMode="decimal" value={value??""} onChange={e=>onChange(e.target.value === '' ? '' : Number(e.target.value))}/><button type="button" aria-label={`Increase ${q.text} by ${step}`} style={{...sx.sm(),width:54,height:54,fontSize:26,flexShrink:0}} onClick={()=>increment(1)}>+</button></div>;
  }
  if (q.type==="boolean") return (
    <div style={{display:"flex",gap:10}}>
      {["Yes","No"].map(o=><button key={o} aria-pressed={value===o} style={{...sx.sm(value===o?C.accent:C.muted),flex:1,padding:14,fontSize:14}} onClick={()=>onChange(o)}>{o}</button>)}
    </div>
  );
  if (q.type==="scale") return (
    <div>
      <div style={{textAlign:"center",fontSize:24,fontWeight:700,color:C.accent,marginBottom:8}}>{value ?? 'Choose a rating'}</div>
      <div className="rating-options">{Array.from({length:10},(_,i)=>i+1).map(n=><button key={n} aria-pressed={value===n} style={sx.sm(value===n?C.accent:C.muted)} onClick={()=>onChange(n)}>{n}</button>)}</div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.muted,marginTop:4}}>
        <span>1 — Poor</span><span>10 — Excellent</span>
      </div>
    </div>
  );
  if (q.type==="select") {
    const opts=(q.options||[]).filter(o=>o.trim());
    return <div className="answer-options">{opts.map(o=><button key={o} aria-pressed={value===o} style={{...sx.sm(value===o?C.accent:C.muted),textAlign:"left",padding:"12px 14px",fontSize:14}} onClick={()=>onChange(o)}>{o}</button>)}</div>;
  }
  if (q.type==='photo') return <ReportPhoto question={q} value={value} onChange={onChange}/>;
  if (q.type==='draw') return <ReportDrawing question={q} value={value} onChange={onChange}/>;
  return null;
}

  function MatchCard({ m, highlightTeam }) {
    const blue=m.alliances?.blue?.team_keys?.map(k=>parseInt(k.replace("frc","")));
    const red=m.alliances?.red?.team_keys?.map(k=>parseInt(k.replace("frc","")));
    const isComp=!!(m.actual_time||m.post_result_time);
    const blueScore=m.alliances?.blue?.score; const redScore=m.alliances?.red?.score;
    const highlightNum = Number(highlightTeam);
    const onBlue=m.alliances?.blue?.team_keys?.includes(`frc${highlightTeam}`);
    const onRed=m.alliances?.red?.team_keys?.includes(`frc${highlightTeam}`);
    const predTime=m.predicted_time?new Date(m.predicted_time*1000).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):null;
    // Determine winner highlight
    let blueWon=false,redWon=false;
    if(isComp&&blueScore!=null&&redScore!=null&&blueScore>=0&&redScore>=0){blueWon=blueScore>redScore;redWon=redScore>blueScore;}
    return (
      <div style={{borderBottom:`1px solid ${C.border}`,padding:"12px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <span style={{fontSize:11,fontWeight:700,color:isComp?C.green:C.accent}}>{isComp?"✅":""} {m.comp_level?.toUpperCase()} {m.match_number}</span>
          {predTime&&!isComp&&<span style={{fontSize:11,color:C.muted}}>{predTime}</span>}
          {onBlue&&<span style={{...sx.tag("#3b82f6"),fontSize:9}}>🔵 YOUR ALLIANCE</span>}
          {onRed&&<span style={{...sx.tag("#ef4444"),fontSize:9}}>🔴 YOUR ALLIANCE</span>}
        </div>
        <div style={{display:"flex",gap:6,justifyContent:"center"}}>
          <div style={{flex:1,background:onBlue?"#1e40af55":(blueWon?"#1e3a8a33":"#1e40af22"),border:`2px solid ${onBlue?"#3b82f6":"#3b82f633"}`,borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
            <div style={{fontSize:9,color:"#60a5fa",letterSpacing:2,marginBottom:2}}>BLUE{blueWon?" 🏆":""}</div>
            {blue?.map(n=><div key={n} style={{fontSize:11,fontWeight:n===highlightNum?700:400,color:n===highlightNum?"#93c5fd":C.text}}>#{n}</div>)}
            {isComp&&blueScore!=null&&blueScore>=0&&<div style={{fontSize:16,fontWeight:700,color:"#60a5fa"}}>{blueScore}</div>}
          </div>
          <div style={{display:"flex",alignItems:"center",color:C.muted,fontWeight:700}}>VS</div>
          <div style={{flex:1,background:onRed?"#7f1d1d55":(redWon?"#7f1d1d44":"#7f1d1d22"),border:`2px solid ${onRed?"#ef4444":"#ef444433"}`,borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
            <div style={{fontSize:9,color:"#f87171",letterSpacing:2,marginBottom:2}}>RED{redWon?" 🏆":""}</div>
            {red?.map(n=><div key={n} style={{fontSize:11,fontWeight:n===highlightNum?700:400,color:n===highlightNum?"#fca5a5":C.text}}>#{n}</div>)}
            {isComp&&redScore!=null&&redScore>=0&&<div style={{fontSize:16,fontWeight:700,color:"#f87171"}}>{redScore}</div>}
          </div>
        </div>
      </div>
    );
  }

  function RankingCard({ ranking, color=C.orange }) {
    return (
      <div style={{...sx.card,borderColor:color+"66"}}>
        <div style={sx.ct}>🏅 Event Ranking</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,textAlign:"center"}}>
          <div style={sx.sc}>
            <div style={{fontSize:28,fontWeight:700,color:color}}>#{ranking.rank}</div>
            <div style={{fontSize:10,color:C.muted,letterSpacing:2}}>RANK</div>
          </div>
          <div style={sx.sc}>
            <div style={{fontSize:22,fontWeight:700,color:C.text}}>{ranking.total}</div>
            <div style={{fontSize:10,color:C.muted,letterSpacing:2}}>TEAMS</div>
          </div>
          <div style={sx.sc}>
            <div style={{fontSize:16,fontWeight:700,color:C.green}}>{ranking.record?.wins??"-"}-{ranking.record?.losses??"-"}-{ranking.record?.ties??"-"}</div>
            <div style={{fontSize:10,color:C.muted,letterSpacing:2}}>W-L-T</div>
          </div>
        </div>
        {ranking.sort_orders&&ranking.sort_order_info&&(
          <div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:8}}>
            {ranking.sort_order_info.map((info,i)=>(
              <div key={i} style={sx.sc}>
                <div style={{fontSize:14,fontWeight:700,color:C.accent}}>{Number(ranking.sort_orders[i]).toFixed(2)}</div>
                <div style={{fontSize:9,color:C.muted}}>{info.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

function MyTeamTab({ team, eventKey }) {
  const [subTab,setSubTab]=useState("myteam"); // myteam | search
  const [streamMode,setStreamMode]=useState(true);
  const [teamInfo,setTeamInfo]=useState(null);
  const [ranking,setRanking]=useState(null);
  const [upcomingMatches,setUpcomingMatches]=useState([]);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const currentEventKey=eventKey||null;
  const [liveData, setLiveData] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveErr, setLiveErr] = useState("");
  const [liveRefreshTs, setLiveRefreshTs] = useState(null);

  // Search tab state
  const [searchNum,setSearchNum]=useState("");
  const [searchLoading,setSearchLoading]=useState(false);
  const [searchErr,setSearchErr]=useState("");
  const [searchInfo,setSearchInfo]=useState(null);
  const [searchRanking,setSearchRanking]=useState(null);
  const [searchMatches,setSearchMatches]=useState([]);


  const autoEventKey = null; // Legacy badge stays inert; explicit workspace event wins.
  const [manualStreamUrl, setManualStreamUrl] = useState("");
  const [manualStreamInput, setManualStreamInput] = useState("");
  const [showStreamInput, setShowStreamInput] = useState(false);

  // The explicit workspace event is shared across every scouting surface.
  const effectiveEventKey = currentEventKey;

  // ── Live feed: auto-poll every 60s, pause when tab hidden ───────────────
  useEffect(()=>{
    if(!team.frc_team_number||!effectiveEventKey) return;
    const num=team.frc_team_number, evKey=effectiveEventKey;
    fetchLiveFeed(num, evKey);
    const interval = setInterval(()=>{
      if(document.hidden) return;
      fetchLiveFeed(num, evKey);
    }, 60000);
    const onVisibility = () => {
      if(!document.hidden) fetchLiveFeed(num, evKey);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return ()=>{ clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  },[team.frc_team_number, effectiveEventKey]);

  // ── Parse any YouTube/Twitch URL into an embeddable src ─────────────────
  function parseStreamUrl(url) {
    if (!url) return null;
    try {
      const u = new URL(url.trim());
      // YouTube watch: youtube.com/watch?v=ID or youtu.be/ID
      if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
        const v = u.searchParams.get("v") || u.pathname.replace(/^\//, "").split("/")[0];
        if (v) return { type:"youtube", embedSrc:`https://www.youtube.com/embed/${v}?autoplay=0&rel=0`, href:url };
      }
      // Twitch: twitch.tv/channelname
      if (u.hostname.includes("twitch.tv")) {
        const channel = u.pathname.replace(/^\//, "").split("/")[0];
        if (channel) return { type:"twitch", embedSrc:`https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&autoplay=false`, href:url, channel };
      }
    } catch { /* Keep the previous downloaded state. */ }
    return null;
  }

  async function fetchLiveFeed(num, evKey) {
    if(!num||!evKey) return;
    setLiveLoading(true); setLiveErr("");
    try {
      const [evInfo, status, allMatches, webcasts] = await Promise.all([
        tbaFetch(`/event/${evKey}`).catch(()=>null),
        tbaFetch(`/team/frc${num}/event/${evKey}/status`).catch(()=>null),
        tbaFetch(`/event/${evKey}/matches/simple`).catch(()=>[]),
        tbaFetch(`/event/${evKey}`).then(e=>e.webcasts||[]).catch(()=>[]),
      ]);
      // Find the most recently played match (highest actual_time)
      const played = Array.isArray(allMatches)
        ? allMatches.filter(m=>m.actual_time||m.post_result_time).sort((a,b)=>(b.actual_time||b.post_result_time)-(a.actual_time||a.post_result_time))
        : [];
      // Find the next upcoming match for this team
      const teamKey = `frc${num}`;
      const upcoming = Array.isArray(allMatches)
        ? allMatches
            .filter(m=>!(m.actual_time||m.post_result_time)&&[...(m.alliances?.blue?.team_keys||[]),...(m.alliances?.red?.team_keys||[])].includes(teamKey))
            .sort((a,b)=>(a.predicted_time||0)-(b.predicted_time||0))
        : [];
      setLiveData({ evInfo, status, lastPlayed: played[0]||null, nextMatch: upcoming[0]||null, allMatches, webcasts });
      setLiveRefreshTs(Date.now());
    } catch {
      setLiveErr("Could not load live event data.");
    }
    setLiveLoading(false);
  }

  useEffect(()=>{
    if (team.frc_team_number&&currentEventKey) loadTeamData(team.frc_team_number,currentEventKey);
  },[currentEventKey,team.frc_team_number]);

  async function loadTeamData(num,evKey) {
    if (!num||!evKey) return;
    setLoading(true); setErr("");
    try {
      const [info, rankData, matches] = await Promise.all([
        tbaFetch(`/team/frc${num}`).catch(()=>null),
        tbaFetch(`/event/${evKey}/rankings`).catch(()=>null),
        tbaFetch(`/event/${evKey}/matches/simple`).catch(()=>[]),
      ]);
      if (info) setTeamInfo(info);
      if (rankData?.rankings) {
        const myRank = rankData.rankings.find(r=>r.team_key===`frc${num}`);
        setRanking(myRank ? {...myRank, total:rankData.rankings.length} : null);
      }
      if (Array.isArray(matches)) {
        const teamKey = `frc${num}`;
        const myMatches = matches.filter(m=>[
          ...(m.alliances?.blue?.team_keys||[]),
          ...(m.alliances?.red?.team_keys||[])
        ].includes(teamKey));
        myMatches.sort((a,b)=>{
          const ac=a.actual_time||a.post_result_time; const bc=b.actual_time||b.post_result_time;
          if(!ac&&!bc)return(a.predicted_time||0)-(b.predicted_time||0);
          if(!ac)return -1; if(!bc)return 1; return ac-bc;
        });
        setUpcomingMatches(myMatches);
      }
    } catch { setErr("Could not load team data from TBA."); }
    setLoading(false);
  }

  async function searchTeam() {
    if (!searchNum.trim()) { setSearchErr("Enter a team number."); return; }
    if (!currentEventKey) { setSearchErr("No event selected. Set one in the EVENT tab first."); return; }
    setSearchLoading(true); setSearchErr(""); setSearchInfo(null); setSearchRanking(null); setSearchMatches([]);
    try {
      const num = searchNum.trim();
      const [info, rankData, matches] = await Promise.all([
        tbaFetch(`/team/frc${num}`).catch(()=>null),
        tbaFetch(`/event/${currentEventKey}/rankings`).catch(()=>null),
        tbaFetch(`/event/${currentEventKey}/matches/simple`).catch(()=>[]),
      ]);
      if (info) setSearchInfo(info);
      if (rankData?.rankings) {
        const r = rankData.rankings.find(r=>r.team_key===`frc${num}`);
        setSearchRanking(r ? {...r, total:rankData.rankings.length} : null);
      }
      if (Array.isArray(matches)) {
        const teamKey = `frc${num}`;
        const myMatches = matches.filter(m=>[
          ...(m.alliances?.blue?.team_keys||[]),
          ...(m.alliances?.red?.team_keys||[])
        ].includes(teamKey));
        myMatches.sort((a,b)=>{
          const ac=a.actual_time||a.post_result_time; const bc=b.actual_time||b.post_result_time;
          if(!ac&&!bc)return(a.predicted_time||0)-(b.predicted_time||0);
          if(!ac)return -1; if(!bc)return 1; return ac-bc;
        });
        setSearchMatches(myMatches);
      }
      if (!info && (!rankData?.rankings)) setSearchErr(`No TBA data found for team #${num}.`);
    } catch { setSearchErr("Error fetching team data."); }
    setSearchLoading(false);
  }

  return (
    <div>
      <div className="page-heading section-heading"><div><h1 className="page-title">My team</h1><p className="page-subtitle">Your robot, rankings, and upcoming matches.</p></div></div>

      {/* Sub-tab nav */}
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
        <button style={sx.nb(subTab==="myteam")} onClick={()=>setSubTab("myteam")}>My team</button>
        <button style={sx.nb(subTab==="search")} onClick={()=>setSubTab("search")}>Find a team</button>
        {subTab==="myteam"&&team.frc_team_number&&effectiveEventKey&&(
          <button
            style={{...sx.sm(streamMode?C.green:C.muted),marginLeft:"auto",display:"flex",alignItems:"center",gap:5,fontSize:10}}
            onClick={()=>setStreamMode(v=>!v)}
          >
            📺 {streamMode?"STREAM ON":"STREAM OFF"}
          </button>
        )}
      </div>

      {/* ── MY TEAM sub-tab ── */}
      {subTab==="myteam"&&(
        <div>
          {/* helpers extracted so both layouts can reuse them */}
          {(()=>{
            const teamCard = team.frc_team_number?(
              <div style={{...sx.card,borderColor:C.accent+"44",marginBottom:4}}>
                <div style={{fontSize:10,color:C.muted,letterSpacing:3,marginBottom:2}}>YOUR FRC TEAM</div>
                <div style={{fontSize:26,fontWeight:700,color:C.accent}}>#{team.frc_team_number}</div>
                {teamInfo&&<div style={{fontSize:13,color:C.dim,marginTop:2}}>{teamInfo.nickname}</div>}
              </div>
            ):null;

            const noTeamMsg = !team.frc_team_number?(
              <div style={{...sx.card,textAlign:"center",color:C.muted,padding:30}}>
                <div style={{fontSize:32,marginBottom:8}}>⚙️</div>
                <div>Ask an owner or admin to set your FRC team number in the Manage tab.</div>
              </div>
            ):null;

            const noEventMsg = !currentEventKey&&team.frc_team_number?(
              <div style={{...sx.card,textAlign:"center",color:C.muted,padding:30}}>
                <div style={{fontSize:28,marginBottom:8}}>📅</div>
                <div>No event selected. Set an event in the EVENT tab to see rankings and matches.</div>
              </div>
            ):null;

            const statsBlock = (
              <>
                {loading&&<div style={{textAlign:"center",color:C.muted,padding:24}}>Loading from The Blue Alliance…</div>}
                {err&&<div style={{...sx.err,padding:10}}>{err}</div>}
                {ranking&&<RankingCard ranking={ranking}/>}
                {upcomingMatches.length>0&&(
                  <div style={sx.card}>
                    <div style={sx.ct}>📅 Our Matches</div>
                    {upcomingMatches.map(m=><MatchCard key={m.key} m={m} highlightTeam={team.frc_team_number}/>)}
                  </div>
                )}
                {team.frc_team_number&&!loading&&upcomingMatches.length===0&&currentEventKey&&(
                  <div style={{...sx.card,textAlign:"center",color:C.muted,padding:30}}>No matches found for team #{team.frc_team_number} at this event.</div>
                )}
              </>
            );

            // ── LIVE FEED BLOCK (shared) ──────────────────────────────────────
            const liveFeedBlock = team.frc_team_number&&effectiveEventKey?(
              <div style={streamMode?{}:sx.card}>
                {!streamMode&&(
                  <div style={{marginBottom:12}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={sx.ct}>📡 LIVE EVENT FEED</div>
                        {autoEventKey&&<span style={{...sx.tag(C.green),fontSize:9,marginTop:-2}}>AUTO</span>}
                        {manualStreamUrl&&<span style={{...sx.tag(C.orange),fontSize:9,marginTop:-2}}>MANUAL</span>}
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button style={{...sx.sm(manualStreamUrl?C.orange:C.muted),fontSize:10}} onClick={()=>setShowStreamInput(v=>!v)}>
                          {showStreamInput?"✕ CLOSE":"🔗 URL"}
                        </button>
                        <button style={{...sx.sm(C.accent),fontSize:10}} onClick={()=>fetchLiveFeed(team.frc_team_number,effectiveEventKey)} disabled={liveLoading}>
                          {liveLoading?"…":"↻"}
                        </button>
                      </div>
                    </div>
                    {showStreamInput&&(
                      <div style={{marginTop:10,display:"flex",gap:8}}>
                        <input
                          style={{...sx.inp,flex:1,marginBottom:0,fontSize:12,padding:"8px 10px"}}
                          placeholder="Paste YouTube or Twitch URL…"
                          value={manualStreamInput}
                          onChange={e=>setManualStreamInput(e.target.value)}
                          onKeyDown={e=>{
                            if(e.key==="Enter"){
                              const parsed=parseStreamUrl(manualStreamInput);
                              if(parsed){setManualStreamUrl(manualStreamInput);setShowStreamInput(false);}
                            }
                          }}
                        />
                        <button style={sx.sm(C.green)} onClick={()=>{
                          const parsed=parseStreamUrl(manualStreamInput);
                          if(parsed){setManualStreamUrl(manualStreamInput);setShowStreamInput(false);}
                        }}>Set</button>
                        {manualStreamUrl&&<button style={sx.sm(C.red)} onClick={()=>{setManualStreamUrl("");setManualStreamInput("");setShowStreamInput(false);}}>Clear</button>}
                      </div>
                    )}
                    {showStreamInput&&manualStreamInput&&!parseStreamUrl(manualStreamInput)&&(
                      <div style={{fontSize:11,color:C.red,marginTop:6}}>⚠ Must be a YouTube or Twitch URL</div>
                    )}
                  </div>
                )}
                {liveLoading&&!liveData&&<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:16}}>Fetching live data…</div>}
                {liveErr&&<div style={{color:C.red,fontSize:12,marginBottom:8}}>{liveErr}</div>}
                {liveData&&(
                  <>
                    {liveData.evInfo&&(
                      <div style={{marginBottom:10}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.orange}}>{liveData.evInfo.name}</div>
                        <div style={{fontSize:11,color:C.muted}}>{liveData.evInfo.city}, {liveData.evInfo.state_prov} — {liveData.evInfo.event_type_string}</div>
                      </div>
                    )}
                    {(()=>{
                      // Manual override takes priority
                      const manual = parseStreamUrl(manualStreamUrl);
                      const wcs=liveData.webcasts||[];
                      const yt=wcs.find(w=>w.type==="youtube");
                      const tw=wcs.find(w=>w.type==="twitch");
                      const tbaChosen=yt||tw;

                      // Build embed from manual URL if set
                      if(manual){
                        const label = manual.type==="youtube"?"📺 LIVE STREAM — YOUTUBE (MANUAL)":"📺 LIVE STREAM — TWITCH (MANUAL)";
                        const labelColor = manual.type==="youtube"?C.green:"#9147ff";
                        return(
                          <div style={{marginBottom:10}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                              <div style={{fontSize:10,color:labelColor,letterSpacing:2}}>{label}</div>
                              <button style={{...sx.sm(C.red),fontSize:9,padding:"3px 7px"}} onClick={()=>{setManualStreamUrl("");setManualStreamInput("");setShowStreamInput(false);}}>✕ CLEAR</button>
                            </div>
                            <div style={{position:"relative",paddingBottom:"56.25%",height:0,overflow:"hidden",borderRadius:8,border:`1px solid ${C.border}`}}>
                              <iframe src={manual.embedSrc} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none"}} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="FRC Event Stream"/>
                            </div>
                            <a href={manual.href} target="_blank" rel="noreferrer" style={{color:C.muted,fontSize:10,letterSpacing:1,display:"block",marginTop:4,textAlign:"right"}}>OPEN IN BROWSER ↗</a>
                          </div>
                        );
                      }

                      // Fall back to TBA webcast
                      if(!tbaChosen)return(
                        <div style={{background:C.bg0,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 12px",marginBottom:12,textAlign:"center"}}>
                          <div style={{fontSize:20,marginBottom:6}}>📺</div>
                          <div style={{fontSize:12,color:C.muted}}>No webcast listed for this event on TBA.</div>
                          <a href={`https://frc-events.firstinspires.org/${new Date().getFullYear()}/${effectiveEventKey}/watch`} target="_blank" rel="noreferrer" style={{color:C.accent,fontSize:11,letterSpacing:1,display:"block",marginTop:6}}>CHECK FIRST EVENTS SITE →</a>
                        </div>
                      );
                      if(tbaChosen.type==="youtube"){
                        const isVideoId=tbaChosen.channel&&tbaChosen.channel.length===11&&!/\s/.test(tbaChosen.channel);
                        const embedSrc=isVideoId?`https://www.youtube.com/embed/${tbaChosen.channel}?autoplay=0&rel=0`:`https://www.youtube.com/embed/live_stream?channel=${tbaChosen.channel}&rel=0`;
                        return(
                          <div style={{marginBottom:10}}>
                            <div style={{fontSize:10,color:C.green,letterSpacing:2,marginBottom:6}}>📺 LIVE STREAM — YOUTUBE</div>
                            <div style={{position:"relative",paddingBottom:"56.25%",height:0,overflow:"hidden",borderRadius:8,border:`1px solid ${C.border}`}}>
                              <iframe src={embedSrc} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none"}} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="FRC Event Stream"/>
                            </div>
                            <a href={`https://youtube.com/watch?v=${tbaChosen.channel}`} target="_blank" rel="noreferrer" style={{color:C.muted,fontSize:10,letterSpacing:1,display:"block",marginTop:4,textAlign:"right"}}>OPEN IN YOUTUBE ↗</a>
                          </div>
                        );
                      }
                      if(tbaChosen.type==="twitch"){
                        return(
                          <div style={{marginBottom:10}}>
                            <div style={{fontSize:10,color:"#9147ff",letterSpacing:2,marginBottom:6}}>📺 LIVE STREAM — TWITCH</div>
                            <div style={{position:"relative",paddingBottom:"56.25%",height:0,overflow:"hidden",borderRadius:8,border:`1px solid ${C.border}`}}>
                              <iframe src={`https://player.twitch.tv/?channel=${tbaChosen.channel}&parent=${window.location.hostname}&autoplay=false`} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none"}} allowFullScreen title="FRC Event Stream"/>
                            </div>
                            <a href={`https://twitch.tv/${tbaChosen.channel}`} target="_blank" rel="noreferrer" style={{color:C.muted,fontSize:10,letterSpacing:1,display:"block",marginTop:4,textAlign:"right"}}>OPEN IN TWITCH ↗</a>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {!streamMode&&(
                      <>
                        {liveData.status?.overall_status_str&&(
                          <div style={{background:C.bg0,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",marginBottom:10,fontSize:12,lineHeight:1.6}} children={String(liveData.status.overall_status_str).replace(/<[^>]*>/g, "")}/>
                        )}
                        {liveData.status?.playoff&&liveData.status.playoff.status!=="not_picked"&&(
                          <div style={{background:C.orange+"18",border:`1px solid ${C.orange}44`,borderRadius:8,padding:"8px 12px",marginBottom:10}}>
                            <div style={{fontSize:10,color:C.orange,letterSpacing:2,marginBottom:4}}>PLAYOFFS</div>
                            <div style={{fontSize:12,color:C.text}}>{liveData.status.playoff.level?.toUpperCase()} — {liveData.status.playoff.current_level_record?.wins??"-"}-{liveData.status.playoff.current_level_record?.losses??"-"}{liveData.status.playoff.status==="won"&&" 🏆"}{liveData.status.playoff.status==="eliminated"&&" ❌"}</div>
                          </div>
                        )}
                        {liveData.nextMatch&&(
                          <div style={{background:"#0f2a1a",border:`1px solid ${C.green}44`,borderRadius:8,padding:"10px 12px",marginBottom:10}}>
                            <div style={{fontSize:10,color:C.green,letterSpacing:2,marginBottom:6}}>⏭ NEXT MATCH</div>
                            <MatchCard m={liveData.nextMatch} highlightTeam={team.frc_team_number}/>
                          </div>
                        )}
                        {liveData.lastPlayed&&(
                          <div style={{background:"#0a0a1a",border:`1px solid ${C.accent}33`,borderRadius:8,padding:"10px 12px",marginBottom:10}}>
                            <div style={{fontSize:10,color:C.accent,letterSpacing:2,marginBottom:6}}>🕐 LAST PLAYED AT EVENT</div>
                            <MatchCard m={liveData.lastPlayed} highlightTeam={team.frc_team_number}/>
                          </div>
                        )}
                        {liveData.status?.qual?.ranking&&(
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                            <div style={sx.sc}><div style={{fontSize:22,fontWeight:700,color:C.orange}}>#{liveData.status.qual.ranking.rank}</div><div style={{fontSize:9,color:C.muted,letterSpacing:2}}>RANK</div></div>
                            <div style={sx.sc}><div style={{fontSize:16,fontWeight:700,color:C.green}}>{liveData.status.qual.ranking.record?.wins??"-"}-{liveData.status.qual.ranking.record?.losses??"-"}-{liveData.status.qual.ranking.record?.ties??"-"}</div><div style={{fontSize:9,color:C.muted,letterSpacing:2}}>W-L-T</div></div>
                            <div style={sx.sc}><div style={{fontSize:16,fontWeight:700,color:C.text}}>{liveData.status.qual.num_teams??"-"}</div><div style={{fontSize:9,color:C.muted,letterSpacing:2}}>TEAMS</div></div>
                          </div>
                        )}
                        {liveRefreshTs&&<div style={{fontSize:10,color:C.muted,textAlign:"right",marginTop:4}}>Updated {new Date(liveRefreshTs).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</div>}
                      </>
                    )}
                  </>
                )}
                {!liveLoading&&!liveData&&!liveErr&&(
                  <div style={{color:C.muted,fontSize:12,textAlign:"center",padding:12}}>No live data yet. Tap ↻ REFRESH.</div>
                )}
              </div>
            ):null;

            // ── STREAM MODE layout ─────────────────────────────────────────────
            if(streamMode&&team.frc_team_number&&effectiveEventKey){
              return(
                <>
                  {/* Top bar: event name + refresh */}
                  <div style={{...sx.card,padding:"10px 14px",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        {liveData?.evInfo&&<span style={{fontSize:13,fontWeight:700,color:C.orange}}>{liveData.evInfo.name}</span>}
                        {!liveData?.evInfo&&<span style={{fontSize:12,color:C.muted}}>📡 LIVE MODE</span>}
                        {team.frc_team_number&&<span style={{fontSize:11,color:C.accent}}>#{team.frc_team_number}{teamInfo?` · ${teamInfo.nickname}`:""}</span>}
                        {autoEventKey&&<span style={{...sx.tag(C.green),fontSize:9}}>AUTO</span>}
                        {manualStreamUrl&&<span style={{...sx.tag(C.orange),fontSize:9}}>MANUAL</span>}
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button style={{...sx.sm(manualStreamUrl?C.orange:C.muted),fontSize:10}} onClick={()=>setShowStreamInput(v=>!v)}>
                          {showStreamInput?"✕ CLOSE":"🔗 URL"}
                        </button>
                        <button style={{...sx.sm(C.accent),fontSize:10}} onClick={()=>fetchLiveFeed(team.frc_team_number,effectiveEventKey)} disabled={liveLoading}>
                          {liveLoading?"…":"↻"}
                        </button>
                      </div>
                    </div>
                    {showStreamInput&&(
                      <div style={{marginTop:10,display:"flex",gap:8}}>
                        <input
                          style={{...sx.inp,flex:1,marginBottom:0,fontSize:12,padding:"8px 10px"}}
                          placeholder="Paste YouTube or Twitch URL…"
                          value={manualStreamInput}
                          onChange={e=>setManualStreamInput(e.target.value)}
                          onKeyDown={e=>{
                            if(e.key==="Enter"){
                              const parsed=parseStreamUrl(manualStreamInput);
                              if(parsed){setManualStreamUrl(manualStreamInput);setShowStreamInput(false);}
                            }
                          }}
                        />
                        <button style={sx.sm(C.green)} onClick={()=>{
                          const parsed=parseStreamUrl(manualStreamInput);
                          if(parsed){setManualStreamUrl(manualStreamInput);setShowStreamInput(false);}
                        }}>Set</button>
                        {manualStreamUrl&&<button style={sx.sm(C.red)} onClick={()=>{setManualStreamUrl("");setManualStreamInput("");setShowStreamInput(false);}}>Clear</button>}
                      </div>
                    )}
                    {showStreamInput&&manualStreamInput&&!parseStreamUrl(manualStreamInput)&&(
                      <div style={{fontSize:11,color:C.red,marginTop:6}}>⚠ Must be a YouTube or Twitch URL</div>
                    )}
                  </div>

                  {/* Two-column layout */}
                  <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    {/* LEFT — stream + live info below (60%) */}
                    <div style={{flex:"0 0 60%",minWidth:0}}>
                      <div style={{...sx.card,padding:10}}>
                        {liveFeedBlock}
                      </div>
 {/* Last played match */}
                      {liveData?.lastPlayed&&(
                        <div style={{...sx.card,marginTop:8,borderColor:C.accent+"33"}}>
                          <div style={{fontSize:10,color:C.accent,letterSpacing:2,marginBottom:6}}>🕐 LAST PLAYED AT EVENT</div>
                          <MatchCard m={liveData.lastPlayed} highlightTeam={team.frc_team_number}/>
                        </div>
                      )}
                      {/* TBA status string */}
                      {liveData?.status?.overall_status_str&&(
                        <div style={{...sx.card,fontSize:12,lineHeight:1.6,marginTop:8}} children={String(liveData.status.overall_status_str).replace(/<[^>]*>/g, "")}/>
                      )}
                      {/* Playoff status */}
                      {liveData?.status?.playoff&&liveData.status.playoff.status!=="not_picked"&&(
                        <div style={{...sx.card,marginTop:8,borderColor:C.orange+"44"}}>
                          <div style={{fontSize:10,color:C.orange,letterSpacing:2,marginBottom:4}}>PLAYOFFS</div>
                          <div style={{fontSize:12,color:C.text}}>
                            {liveData.status.playoff.level?.toUpperCase()} — {liveData.status.playoff.current_level_record?.wins??"-"}-{liveData.status.playoff.current_level_record?.losses??"-"}
                            {liveData.status.playoff.status==="won"&&" 🏆"}
                            {liveData.status.playoff.status==="eliminated"&&" ❌"}
                          </div>
                        </div>
                      )}
                     
                    </div>

                    {/* RIGHT — stats + matches (40%) */}
                    <div style={{flex:"0 0 calc(40% - 10px)",minWidth:0,overflowY:"auto"}}>
                      {ranking&&<RankingCard ranking={ranking}/>}
                      {liveData?.status?.qual?.ranking&&(
                        <div style={{...sx.card,padding:"10px 12px",marginBottom:10}}>
                          <div style={{fontSize:10,color:C.muted,letterSpacing:2,marginBottom:8}}>QUAL RECORD</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                            <div style={sx.sc}><div style={{fontSize:18,fontWeight:700,color:C.orange}}>#{liveData.status.qual.ranking.rank}</div><div style={{fontSize:8,color:C.muted,letterSpacing:1}}>RANK</div></div>
                            <div style={sx.sc}><div style={{fontSize:13,fontWeight:700,color:C.green}}>{liveData.status.qual.ranking.record?.wins??"-"}-{liveData.status.qual.ranking.record?.losses??"-"}-{liveData.status.qual.ranking.record?.ties??"-"}</div><div style={{fontSize:8,color:C.muted,letterSpacing:1}}>W-L-T</div></div>
                          </div>
                        </div>
                      )}
                      {liveData?.nextMatch&&(
                        <div style={{...sx.card,padding:"10px 10px",marginBottom:8,borderColor:C.green+"44"}}>
                          <div style={{fontSize:9,color:C.green,letterSpacing:2,marginBottom:6}}>⏭ NEXT</div>
                          <MatchCard m={liveData.nextMatch} highlightTeam={team.frc_team_number}/>
                        </div>
                      )}
                      {upcomingMatches.length>0&&(
                        <div style={sx.card}>
                          <div style={{fontSize:9,color:C.accent,letterSpacing:2,marginBottom:6}}>📅 OUR MATCHES</div>
                          {upcomingMatches.map(m=><MatchCard key={m.key} m={m} highlightTeam={team.frc_team_number}/>)}
                        </div>
                      )}
                      {liveRefreshTs&&<div style={{fontSize:9,color:C.muted,textAlign:"right",marginTop:4}}>Updated {new Date(liveRefreshTs).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</div>}
                    </div>
                  </div>
                </>
              );
            }

            // ── NORMAL layout ──────────────────────────────────────────────────
            return(
              <>
                {noTeamMsg}
                {teamCard}
                {noEventMsg}
                {statsBlock}
                {liveFeedBlock}
              </>
            );
          })()}
        </div>
      )}
      {subTab==="search"&&(
        <div>
          <div style={sx.card}>
            <div style={sx.ct}>Search a Team</div>
            {!currentEventKey&&<div style={{color:C.orange,fontSize:12,marginBottom:10}}>⚠ No event selected — set one in the EVENT tab for match data.</div>}
            <label style={sx.lbl}>FRC Team Number</label>
            <div style={{display:"flex",gap:8}}>
              <input style={{...sx.inp,flex:1,marginBottom:0}} placeholder="e.g. 254" value={searchNum} onChange={e=>setSearchNum(e.target.value)} inputMode="numeric" onKeyDown={e=>e.key==="Enter"&&searchTeam()}/>
              <button style={sx.sm(C.accent)} onClick={searchTeam} disabled={searchLoading}>{searchLoading?"…":"SEARCH"}</button>
            </div>
            {searchErr&&<div style={{...sx.err,marginTop:8}}>{searchErr}</div>}
          </div>

          {searchInfo&&(
            <div style={{...sx.card,borderColor:C.purple+"44"}}>
              <div style={{fontSize:10,color:C.muted,letterSpacing:3,marginBottom:2}}>TEAM</div>
              <div style={{fontSize:26,fontWeight:700,color:C.purple}}>#{searchInfo.team_number}</div>
              <div style={{fontSize:14,color:C.text,marginTop:2}}>{searchInfo.nickname}</div>
              {searchInfo.city&&<div style={{fontSize:12,color:C.muted,marginTop:2}}>{searchInfo.city}, {searchInfo.state_prov} {searchInfo.country}</div>}
            </div>
          )}

          {searchRanking&&<RankingCard ranking={searchRanking} color={C.purple}/>}
          {searchInfo&&!searchRanking&&currentEventKey&&!searchLoading&&(
            <div style={{...sx.card,textAlign:"center",color:C.muted,padding:20,fontSize:13}}>Team not ranked at this event.</div>
          )}

          {searchMatches.length>0&&(
            <div style={sx.card}>
              <div style={sx.ct}>📅 Matches at Current Event</div>
              {searchMatches.map(m=><MatchCard key={m.key} m={m} highlightTeam={searchNum.trim()}/>)}
            </div>
          )}
          {searchInfo&&!searchLoading&&searchMatches.length===0&&currentEventKey&&(
            <div style={{...sx.card,textAlign:"center",color:C.muted,padding:20,fontSize:13}}>No matches found for this team at the current event.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Data Tab ─────────────────────────────────────────────────────────────────
// ─── Manage Tab ───────────────────────────────────────────────────────────────
function ManageTab({ team, user, onTeamUpdate, onRoleChange }) {
  const [members,setMembers]=useState([]);
  const [tName,setTName]=useState(team.name);
  const [editName,setEditName]=useState(false);
  const [msg,setMsg]=useState(""); const [err,setErr]=useState("");
  const [pitScoutEnabled,setPitScoutEnabled]=useState(team.pit_scout_enabled!==false);
  const [frcTeamNum,setFrcTeamNum]=useState(team.frc_team_number||"");
  const [editFrc,setEditFrc]=useState(false);
  const [savingFrc,setSavingFrc]=useState(false);

  useEffect(()=>{let active=true;fbSelect("memberships",{team_id:team.id}).then(rows=>{if(active)setMembers(rows);}).catch(()=>{ /* Keep members until a successful refresh. */ });return()=>{active=false;};},[team.id]);

  async function setRole(m,role){
    try{
      const u={...m,role}; await idbPut("memberships",u);
      setMembers(ms=>ms.map(x=>x.id===m.id?u:x));
      setMsg(`${m.username} is now ${role}.`);setErr("");
      if(m.user_id===user.id)onRoleChange?.();
    }catch{setErr("Failed to update role.");}
  }

  async function transferOwnership(m){
    setMsg(`Use the secure transfer form to offer ownership to ${m.username}.`);
    window.location.hash='/admin?tab=members';
  }

  async function kick(m){
    if(!confirm(`Kick ${m.username}?`))return;
    try{await idbDel("memberships",m.id);setMembers(ms=>ms.filter(x=>x.id!==m.id));setMsg(`${m.username} removed.`);setErr("");}
    catch{setErr("Failed to kick member.");}
  }

  async function saveName(){
    try{const u={...team,name:tName};await idbPut("teams",u);onTeamUpdate(u);setEditName(false);setMsg("Name updated.");setErr("");}
    catch{setErr("Failed to update name.");}
  }

  async function togglePitScoutEnabled(){
    const val=!pitScoutEnabled;
    try{
      const t=await idbGet("teams",team.id);
      if(t)await idbPut("teams",{...t,pit_scout_enabled:val});
      setPitScoutEnabled(val);
      setMsg(`Pit scouting tracking ${val?"enabled":"disabled"}.`);
    }catch{setErr("Failed to update setting.");}
  }

  async function saveFrcTeamNum(){
    if(!frcTeamNum.trim()){setErr("Enter a team number.");return;}
    setSavingFrc(true);setErr("");
    try{
      const t=await idbGet("teams",team.id);
      if(t)await idbPut("teams",{...t,frc_team_number:frcTeamNum.trim()});
      const updated={...team,frc_team_number:frcTeamNum.trim()};
      onTeamUpdate(updated);
      setEditFrc(false);setMsg("FRC team number updated.");
    }catch{setErr("Failed to update FRC team number.");}
    setSavingFrc(false);
  }

  return (
    <div>
      <div className="page-heading section-heading"><div><h1 className="page-title">Team settings</h1><p className="page-subtitle">Manage your team, members, and scouting preferences.</p></div></div>
      {msg&&<div style={{...sx.card,color:C.green,fontSize:13,borderColor:C.green+"44",padding:12}}>{msg}</div>}
      {err&&<div style={{...sx.card,color:C.red,fontSize:13,borderColor:C.red+"44",padding:12}}>{err}</div>}

      <div style={sx.card}>
        <div style={sx.ct}>Team info</div>
        {editName?<>
          <label style={sx.lbl}>Team name</label>
          <input style={sx.inp} value={tName} onChange={e=>setTName(e.target.value)}/>
          <div style={{display:"flex",gap:8}}>
            <button style={{...sx.btn(C.green),flex:1}} onClick={saveName}>Save</button>
            <button style={{...sx.btn(C.red),flex:1}} onClick={()=>{setEditName(false);setTName(team.name);}}>Cancel</button>
          </div>
        </>:<>
          <div style={{fontSize:14,marginBottom:4}}>#{team.number} — {team.name}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:10}}>Password: <span style={{color:C.green,letterSpacing:4,fontWeight:700}}>{team.password}</span></div>
          <button style={sx.btn()} onClick={()=>setEditName(true)}>Edit name</button>
        </>}
      </div>

      <div style={sx.card}>
        <div style={sx.ct}>Settings</div>
        <div style={{...sx.row,borderBottom:"none"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700}}>Pit scout tracking</div>
            <div style={{fontSize:11,color:C.muted}}>Allow scouters to mark teams as pit scouted</div>
          </div>
          <button style={sx.sm(pitScoutEnabled?C.green:C.muted)} onClick={togglePitScoutEnabled}>
            {pitScoutEnabled?"ON":"OFF"}
          </button>
        </div>
      </div>

      <div style={sx.card}>
        <div style={sx.ct}>FRC Team Number (for My Team tab)</div>
        {!editFrc&&team.frc_team_number?(
          <>
            <div style={{fontSize:22,fontWeight:700,color:C.accent,marginBottom:8}}>#{team.frc_team_number}</div>
            <button style={sx.btn()} onClick={()=>setEditFrc(true)}>Change</button>
          </>
        ):(
          <>
            <label style={sx.lbl}>FRC Team Number</label>
            <input style={sx.inp} placeholder="e.g. 254" value={frcTeamNum} onChange={e=>setFrcTeamNum(e.target.value)} inputMode="numeric"/>
            <div style={{display:"flex",gap:8}}>
              <button style={{...sx.btn(C.green),flex:1}} onClick={saveFrcTeamNum} disabled={savingFrc}>{savingFrc?"Saving…":"Save"}</button>
              {editFrc&&<button style={{...sx.btn(C.muted),flex:1}} onClick={()=>{setEditFrc(false);setFrcTeamNum(team.frc_team_number||"");}}>Cancel</button>}
            </div>
          </>
        )}
      </div>

      <div style={sx.card}>
        <div style={sx.ct}>Members</div>
        {members.map(m=>(
          <div key={m.id} style={{...sx.row,flexWrap:"wrap",gap:8}}>
            <div style={sx.avatar(RC[m.role]||C.muted)}>{m.username?.[0]?.toUpperCase()}</div>
            <div style={{flex:1,minWidth:80}}>
              <div style={{fontSize:13}}>{m.username}</div>
              <span style={sx.tag(RC[m.role]||C.muted)}>{m.role?.toUpperCase()}</span>
            </div>
            {m.user_id!==user.id&&m.role!=="owner"&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {m.role==="member"&&<button style={sx.sm(C.accent)} onClick={()=>setRole(m,"admin")}>Admin</button>}
                {m.role==="admin" &&<button style={sx.sm(C.muted)}  onClick={()=>setRole(m,"member")}>Member</button>}
                <button style={sx.sm(C.orange)} onClick={()=>transferOwnership(m)} title="Transfer ownership">👑</button>
                <button style={sx.sm(C.red)} onClick={()=>kick(m)}>Remove</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
