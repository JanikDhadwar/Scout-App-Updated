import { useState, useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { conditionOperators, hasAnswer, visibleQuestions, visibleAnswers, validateConditions } from './form-conditions.js';
import { offline, deviceStore, draftKey } from './offline.js';
import { HomeDashboard, SyncPanel } from './workspace-ui.jsx';
import { useReportDraft } from './use-report-draft.js';
import { ReportDrawing, ReportPhoto } from './report-media.jsx';

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
async function fbUpdate(col, filters, patch) {
  const rows = await fbSelect(col, filters);
  for (const r of rows) await apiCall("PATCH", `/${col}/${r.id}`, patch);
  return rows[0] ? { ...rows[0], ...patch } : null;
}
async function fbDelete(col, filters) {
  const rows = await fbSelect(col, filters);
  for (const r of rows) await apiCall("DELETE", `/${col}/${r.id}`);
}
async function fbDeleteById(col, id) { await apiCall("DELETE", `/${col}/${id}`); }

// ─── Thin wrappers used directly in the app (session, etc.) ──────────────────
async function idbGet(store, key) { return apiCall("GET", `/${store}/${key}`); }
async function idbPut(store, val) { return apiCall("POST",   `/${store}`, val); }
async function idbAll(store)      { return apiCall("GET",    `/${store}`); }
async function idbDel(store, key) { return apiCall("DELETE", `/${store}/${key}`); }


// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid    = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)+Date.now().toString(36));
const hash   = pw => { let h=0; for (const c of pw){h=((h<<5)-h)+c.charCodeAt(0);h|=0;} return h.toString(16); };
const genPwd = () => { const c="ABCDEFGHJKMNPQRSTUVWXYZ23456789"; return Array.from({length:8},()=>c[Math.floor(Math.random()*c.length)]).join(""); };
const tsNow  = () => new Date().toISOString();
const fmtTs  = ts => { const d=new Date(ts); const diff=Date.now()-d; if(diff<60000)return"just now"; if(diff<3600000)return`${Math.floor(diff/60000)}m ago`; if(diff<86400000)return`${Math.floor(diff/3600000)}h ago`; return d.toLocaleDateString(); };

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = { bg0:"#111214", bg1:"#191b1e", bg2:"#22252a", border:"#33363c", accent:"#f07880", orange:"#e9b777", green:"#82c99a", red:"#fb7b80", muted:"#a3a7af", text:"#f4f3f1", dim:"#c1c3c8", purple:"#b7a3d5" };
const MO = "'Segoe UI', system-ui, -apple-system, sans-serif";

const sx = {
  page:   { fontFamily:MO, background:C.bg0, color:C.text, minHeight:"100vh", display:"flex", flexDirection:"column" },
  hdr:    { background:C.bg1, borderBottom:`1px solid ${C.border}`, padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", height:72, flexShrink:0, position:"sticky", top:0, zIndex:100 },
  logo:   { display:"flex", alignItems:"center", gap:12, fontWeight:650, fontSize:17, color:C.text },
  main:   { flex:1, overflowY:"auto", padding:"16px 12px", paddingBottom:80 },
  bnav:   { position:"fixed", bottom:0, left:0, right:0, background:C.bg1, borderTop:`1px solid ${C.border}`, display:"flex", zIndex:100, height:60 },
  bnavBtn:(on) => ({ flex:1, background:"transparent", border:"none", color:on?C.text:C.muted, cursor:"pointer", fontFamily:MO, fontSize:12, fontWeight:on?650:450, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:5, padding:"8px 2px" }),
  card:   { background:C.bg1, border:`1px solid ${C.border}`, borderRadius:14, padding:"clamp(16px, 2vw, 24px)", marginBottom:16 },
  ct:     { fontSize:15, fontWeight:650, color:C.text, marginBottom:16 },
  inp:    { background:C.bg0, border:`1px solid ${C.border}`, color:C.text, padding:"12px 14px", borderRadius:8, width:"100%", fontFamily:MO, fontSize:14, boxSizing:"border-box", outline:"none", marginBottom:10 },
  btn:    (c=C.accent) => ({ background:c===C.accent?"#ba2732":"transparent", border:`1px solid ${c===C.accent?"#ba2732":c}`, color:c===C.accent?"#fff":c, padding:"14px 20px", borderRadius:7, cursor:"pointer", fontFamily:MO, fontSize:15, fontWeight:600, width:"100%", minHeight:48 }),
  sm:     (c=C.accent) => ({ background:"transparent", border:`1px solid ${c===C.accent?'#9d3b44':c+'66'}`, color:c, padding:"9px 13px", borderRadius:8, cursor:"pointer", fontFamily:MO, fontSize:13, fontWeight:550, minHeight:44 }),
  lbl:    { fontSize:13, fontWeight:550, color:C.dim, marginBottom:8, display:"block" },
  err:    { color:C.red, fontSize:12, marginBottom:8 },
  ok:     { color:C.green, fontSize:12, marginBottom:8 },
  tag:    (c) => ({ background:c+"22", border:`1px solid ${c}44`, color:c, padding:"3px 8px", borderRadius:4, fontSize:10, letterSpacing:1, display:"inline-block" }),
  nb:     (on) => ({ background:on?C.bg2:"transparent", border:on?`1px solid ${C.accent}`:"1px solid transparent", color:on?C.accent:C.muted, padding:"8px 14px", borderRadius:6, cursor:"pointer", fontFamily:MO, fontSize:11, letterSpacing:1 }),
  hr:     { borderTop:`1px solid ${C.border}`, margin:"12px 0" },
  sc:     { background:C.bg0, border:`1px solid ${C.border}`, borderRadius:8, padding:"14px 12px", textAlign:"center" },
  ob:     (c) => ({ background:c+"18", borderBottom:`1px solid ${c}`, color:c, padding:"6px 20px", fontSize:11, letterSpacing:2, textAlign:"center", textTransform:"uppercase" }),
  row:    { display:"flex", alignItems:"center", gap:10, padding:"12px 0", borderBottom:`1px solid ${C.border}` },
  avatar: (c=C.accent) => ({ width:38, height:38, borderRadius:"50%", background:C.bg2, border:`1px solid ${c}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:c, flexShrink:0 }),
};
const RC = { owner:C.orange, admin:C.accent, member:C.muted };

function getNavTabs(role) {
  return [
    { id:"home", label:"Home" },
    { id:"announce", label:"News" },
    { id:"forms", label:"Forms" },
    { id:"event", label:"Event" },
    { id:"myteam", label:"My team" },
    ...(role==="owner"||role==="admin" ? [{ id:"data", label:"Data" }] : []),
    ...(role==="owner"                 ? [{ id:"manage", label:"Manage" }] : []),
  ];
}

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
const TBA_BASE = "https://www.thebluealliance.com/api/v3";
const TBA_KEY  = "PgNUlQdJ8WUGRmyYFCSiz5zYddD6F2UKLEvzRv3spx4N8fNUXkEtUoF6hM3L9kGS";
async function tbaFetch(path) {
  const headers = TBA_KEY ? { "X-TBA-Auth-Key": TBA_KEY } : {};
  const r = await fetch(`${TBA_BASE}${path}`, { headers });
  if (!r.ok) throw new Error(`TBA ${r.status}`);
  return r.json();
}

// ─── CSV export helper ────────────────────────────────────────────────────────
function exportToCSV(forms, allSubs) {
  // One sheet per form
  const lines = [];
  for (const f of forms) {
    const subs = allSubs.filter(s => s.form_id === f.id);
    if (!subs.length) continue;
    lines.push(`"=== ${f.title} ==="`);
    const headers = ["submitted_by","scouted_team","created_at",...(f.questions||[]).map(q=>q.text)];
    lines.push(headers.map(h=>`"${h}"`).join(","));
    for (const s of subs) {
      const row = [s.submitted_by||"",s.scouted_team||"",(s.created_at||"").replace("T"," ").slice(0,19),
        ...(f.questions||[]).map(q=>{const v=s.answers?.[q.id];if(q.type==="draw"||q.type==="photo")return"[image]";return String(v??"").replace(/"/g,'""');})
      ];
      lines.push(row.map(c=>`"${c}"`).join(","));
    }
    lines.push("");
  }
  const blob = new Blob([lines.join("\n")], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=`frc_scout_export_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  const [user,    setUser]    = useState(null);
  const [team,    setTeam]    = useState(null);
  const [mem,     setMem]     = useState(null);
  const [tab,     setTab]     = useState("home");
  const [booting, setBooting] = useState(true);
  const [syncState,setSyncState] = useState(offline.getState());
  const [showSync,setShowSync] = useState(false);
  const [showMore,setShowMore] = useState(false);
  const [shellReady,setShellReady] = useState(!!navigator.serviceWorker?.controller);

  useEffect(() => {
    const listener = event => setSyncState(event.detail);
    const ready = () => setShellReady(!!navigator.serviceWorker?.controller);
    window.addEventListener('scout-sync',listener);
    navigator.serviceWorker?.addEventListener('controllerchange',ready);
    return () => { window.removeEventListener('scout-sync',listener); navigator.serviceWorker?.removeEventListener('controllerchange',ready); };
  }, []);

  useEffect(()=>{
    if (!user || !team) return;
    let stopped=false, running=false, lastPrepared=0;
    const check=async()=>{
      if(stopped || running) return;
      running=true;
      try {
        await offline.setScope({userId:user.id,teamId:team.id});
        await offline.sync();
        if (offline.getState().connection==='online' && Date.now()-lastPrepared>60000) {
          await offline.prepare(); lastPrepared=Date.now();
        }
      } catch(error) { if(!stopped) setSyncState(s=>({...s,error:error.message})); }
      finally { running=false; }
    };
    check();
    const timer=setInterval(check,15000);
    window.addEventListener('online',check);
    document.addEventListener('visibilitychange',check);
    return ()=>{stopped=true;clearInterval(timer);window.removeEventListener('online',check);document.removeEventListener('visibilitychange',check);};
  },[user?.id,team?.id]);

  // Boot: restore session
  useEffect(() => {
    (async () => {
      try {
        const sess = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
        if (sess?.user) {
          await offline.setScope({userId:sess.user.id,teamId:sess.team?.id});
          setUser(sess.user);
          if (sess.team && sess.mem) {
            let mem;
            try { mem = await idbGet("memberships", sess.mem.id); }
            catch(error) { if(error.status && error.status<500) throw error; mem=sess.mem; }
            if (mem) {
              setTeam(sess.team); setMem(mem);
            } else {
              setUser(sess.user); setTeam(null); setMem(null);
              await saveSession(sess.user, null, null);
            }
          }
        }
      } catch (e) {
        console.error("Boot error (is server.js running?):", e);
      }
      setBooting(false);
    })();
  }, []);

  async function saveSession(u, t, m) {
    if (u) localStorage.setItem(SESSION_KEY, JSON.stringify({ user:u, team:t||null, mem:m||null }));
    else localStorage.removeItem(SESSION_KEY);
  }
  async function checkPending() { await offline.refresh(); }

  async function login(u) {
    // After login, check if user has a cached membership — if so, auto-restore team
    try {
      const mems = await idbAll("memberships");
      const myMems = mems.filter(m => m.user_id === u.id);
      if (myMems.length === 1) {
        const teams = await idbAll("teams");
        const t = teams.find(t => t.id === myMems[0].team_id);
        if (t) {
          setUser(u); setTeam(t); setMem(myMems[0]);
          await saveSession(u, t, myMems[0]);
          return;
        }
      }
    } catch {}
    setUser(u); await saveSession(u, null, null);
  }
  async function joinTeam(t, m) { setTeam(t); setMem(m); setTab("home"); await saveSession(user, t, m); }
  async function logout() { await saveSession(null,null,null); await offline.setScope(null); setUser(null);setTeam(null);setMem(null);setTab('home');setShowSync(false); }

  async function leaveTeam() {
    const allMems = await fbSelect("memberships", { team_id: team.id });
    if (allMems.length <= 1) { alert("You are the only member. Delete the team instead."); return; }
    if (mem.role === "owner") { alert("You cannot leave as owner. Transfer ownership first."); return; }
    if (!confirm("Leave this team? You will need the password to rejoin.")) return;
    try {
      await idbDel("memberships", mem.id);
      setTeam(null); setMem(null);
      await saveSession(user, null, null);
    } catch { alert("Error leaving team."); }
  }

  async function refreshMem() {
    if (!user || !team) return;
    try {
      const rows = await fbSelect("memberships", { team_id:team.id, user_id:user.id });
      if (rows.length) { setMem(rows[0]); await saveSession(user, team, rows[0]); }
    } catch {}
  }

  async function handleDeleteAccount() {
    if (!confirm("Delete your account? This cannot be undone.")) return;
    try {
      await fbDelete("memberships", { user_id:user.id });
      await fbDeleteById("users", user.id);
      await idbDel("users", user.id);
      logout();
    } catch { alert("Error deleting account."); }
  }

  async function handleDeleteTeam() {
    if (!confirm(`Delete team #${team?.number}? Cannot be undone.`)) return;
    try {
      const forms = await fbSelect("forms", { team_id:team.id });
      for (const f of forms) { await fbDelete("submissions", { form_id:f.id }); await fbDeleteById("forms", f.id); }
      await fbDelete("memberships",    { team_id:team.id });
      await fbDelete("announcements",  { team_id:team.id });
      await fbDelete("scout_events",   { team_id:team.id });
      await fbDeleteById("teams", team.id);
      logout();
    } catch { alert("Error deleting team."); }
  }

  if (booting) return (
    <div style={{ ...sx.page, alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:C.accent, letterSpacing:4, fontSize:13 }}>LOADING…</div>
    </div>
  );

  const role = mem?.role || "member";
  const navTabs = getNavTabs(role);
  const navigate = id => {setTab(id);setShowMore(false);window.scrollTo({top:0,behavior:'instant'});};
  const statusLabel = syncState.syncing ? 'Syncing' : syncState.pending ? `${syncState.pending} to upload` : syncState.connection==='offline' ? 'Offline' : syncState.connection==='checking' ? 'Connecting' : 'All synced';

  return (
    <div className={user&&team?'scout-shell':'scout-auth-shell'} style={sx.page}>

      {user && team && (
        <header className="workspace-header">
          <div className="workspace-heading"><span className="mobile-mark">6390</span><div><span className="eyebrow">Hephaustus / Team {team.number}</span><strong>{navTabs.find(t=>t.id===tab)?.label || 'Argus'}</strong></div></div>
          <div className="header-actions">
            <button className={`sync-pill ${syncState.connection==='offline'?'is-offline':''}`} onClick={()=>setShowSync(s=>!s)} aria-expanded={showSync}><span className={syncState.syncing?'status-dot is-syncing':'status-dot'}/>{statusLabel}</button>
            <span className="user-chip" title={user.username}>{user.username?.slice(0,2).toUpperCase()}</span>
          </div>
        </header>
      )}

      <main className="workspace-main" style={sx.main}>
        {needRefresh && <div className="notice" role="status">An update is ready. Finish saving before reloading. <button style={sx.sm()} onClick={()=>updateServiceWorker(true)}>Reload app</button></div>}
        {user&&team&&syncState.error&&<div className="notice notice-error" role="alert">{syncState.error} <button style={sx.sm()} onClick={()=>setShowSync(true)}>View sync details</button></div>}
        {showSync&&user&&team&&<SyncPanel state={syncState} shellReady={shellReady} onClose={()=>setShowSync(false)}/>}
        {!user                          && <AuthScreen onLogin={login}/>}
        {user && !team                  && <TeamScreen user={user} onJoin={joinTeam} onLogout={logout}/>}
        {user && team && tab==="home"     && <HomeDashboard api={apiCall} team={team} user={user} role={role} mem={mem} onNavigate={navigate} syncState={syncState} shellReady={shellReady} onShowSync={()=>setShowSync(true)} onDeleteAccount={handleDeleteAccount} onDeleteTeam={handleDeleteTeam} onLeaveTeam={leaveTeam}/>}
        {user && team && tab==="announce" && <AnnouncementsTab team={team} user={user} role={role}/>}
        {user && team && tab==="forms"    && <FormsTab team={team} user={user} role={role} syncState={syncState} onPending={checkPending}/>}
        {user && team && tab==="event"    && <EventTab team={team} user={user} role={role}/>}
        {user && team && tab==="myteam"   && <MyTeamTab team={team} user={user} role={role}/>}
        {user && team && tab==="data" && (role==="owner"||role==="admin") && <DataTab team={team} user={user} role={role}/>}
        {user && team && tab==="manage" && role==="owner" && <ManageTab team={team} user={user} onTeamUpdate={t=>{setTeam(t);saveSession(user,t,mem);}} onRoleChange={refreshMem}/>}
      </main>

      {user && team && (
        <nav className="workspace-nav" aria-label="Main navigation">
          <div className="nav-brand"><span className="team-mark">6390</span><div><strong>Argus</strong><span>Hephaustus</span></div></div>
          <div className="nav-section-label">Workspace</div>
          {navTabs.map(t => (
            <button key={t.id} className={`nav-link ${['myteam','data','manage'].includes(t.id)?'nav-secondary':''}`} aria-current={tab===t.id ? "page" : undefined} onClick={()=>navigate(t.id)}>
              <NavIcon name={t.id}/>
              <span>{t.label}</span>
            </button>
          ))}
          <button className="nav-link mobile-more" aria-expanded={showMore} aria-current={['myteam','data','manage'].includes(tab)?'page':undefined} onClick={()=>setShowMore(s=>!s)}><NavIcon name="more"/><span>More</span></button>
          <div className="nav-footer"><div><span style={sx.avatar()}>{user.username?.[0]?.toUpperCase()}</span><span><strong>{user.username}</strong><small>{role}</small></span></div><button onClick={logout}>Sign out</button></div>
        </nav>
      )}
      {showMore&&<div className="mobile-menu"><div className="section-heading"><strong>More in Argus</strong><button style={sx.sm(C.muted)} onClick={()=>setShowMore(false)}>Close</button></div>{navTabs.filter(t=>['myteam','data','manage'].includes(t.id)).map(t=><button key={t.id} onClick={()=>navigate(t.id)}><NavIcon name={t.id}/>{t.label}</button>)}<button onClick={logout}>Sign out</button></div>}
    </div>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [mode,setMode]=useState("login");
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);

  async function submit() {
    if (busy) return;
    if (!username.trim()||!password.trim()) { setErr("All fields required."); return; }
    setBusy(true); setErr("");
    const ph = hash(password);
    try {
      if (mode==="signup") {
        const existing = await fbSelect("users",{username:username.trim()});
        if (existing.length) { setErr("Username already taken."); setBusy(false); return; }
        const nu = {id:uid(),username:username.trim(),password_hash:ph,created_at:tsNow()};
        await idbPut("users",nu); await onLogin(nu);
      } else {
        const all = await idbAll("users");
        const user = all.find(u=>u.username===username.trim()&&u.password_hash===ph);
        if (!user) { setErr("Invalid username or password."); setBusy(false); return; }
        await onLogin(user);
      }
    } catch { setErr("Login error — please try again."); }
    setBusy(false);
  }

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"90vh",padding:"0 4px"}}>
      <div className="auth-brand">
        <div className="team-mark team-mark-large">6390</div>
        <h1>Argus<br/>Team 6390 scouting workspace</h1>
        <p>Your team's match notes, pit reports, and event data.</p>
      </div>
      <div style={{...sx.card,width:"100%",maxWidth:400}}>
        <div style={{display:"flex",gap:8,marginBottom:18}}>
          {["login","signup"].map(m=><button key={m} style={{...sx.nb(mode===m),flex:1,padding:"10px 0"}} onClick={()=>{setMode(m);setErr("");}}>
            {m==="login"?"Sign in":"Create account"}
          </button>)}
        </div>
        <label htmlFor="scout-username" style={sx.lbl}>Username</label>
        <input id="scout-username" autoComplete="username" style={sx.inp} value={username} onChange={e=>setUsername(e.target.value)} placeholder="scouter42" autoCapitalize="none" onKeyDown={e=>e.key==="Enter"&&submit()}/>
        <label htmlFor="scout-password" style={sx.lbl}>Password</label>
        <input id="scout-password" autoComplete={mode==="login" ? "current-password" : "new-password"} style={sx.inp} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&submit()}/>
        {err && <div style={sx.err}>{err}</div>}
        <button style={sx.btn(C.accent)} onClick={submit} disabled={busy}>{busy?"Please wait…":mode==="login"?"Sign in":"Create account"}</button>
      </div>
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
      } catch {}
    })();
  },[]);

  async function createTeam() {
    if (!tNum.trim()||!tName.trim()) { setErr("Number and name required."); return; }
    setBusy(true); setErr("");
    try {
      const existing = await fbSelect("teams",{number:tNum.trim()});
      if (existing.length) { setErr("Team number already exists."); setBusy(false); return; }
      const pwd=genPwd();
      const t={id:uid(),number:tNum.trim(),name:tName.trim(),password:pwd,owner_id:user.id,created_at:tsNow()};
      const saved=await fbInsert("teams",t);
      const m={id:uid(),team_id:saved.id,user_id:user.id,username:user.username,role:"owner"};
      const savedM=await fbInsert("memberships",m);
      setCreated({team:saved,mem:savedM});
    } catch { setErr("Error creating team."); }
    setBusy(false);
  }

  async function joinTeam() {
    if (!jNum.trim()||!jPwd.trim()) { setErr("Number and password required."); return; }
    setBusy(true); setErr("");
    try {
      const rows=await fbSelect("teams",{number:jNum.trim()});
      if (!rows.length) { setErr("Team not found."); setBusy(false); return; }
      const t=rows[0];
      if (t.password!==jPwd.trim().toUpperCase()) { setErr("Wrong password."); setBusy(false); return; }
      const existing=await fbSelect("memberships",{team_id:t.id,user_id:user.id});
      let m;
      if (existing.length){m=existing[0];}
      else{m=await fbInsert("memberships",{id:uid(),team_id:t.id,user_id:user.id,username:user.username,role:"member"});}
      await fbInsert("teams",t);
      onJoin(t,m);
    } catch { setErr("Error joining team."); }
    setBusy(false);
  }

  if (created) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"80vh"}}>
      <div style={{...sx.card,textAlign:"center",maxWidth:360}}>
        <div style={{fontSize:48,marginBottom:8}}>✅</div>
        <div style={{...sx.ct,textAlign:"center"}}>Team Created!</div>
        <div style={{background:C.bg0,border:`1px solid ${C.green}`,borderRadius:8,padding:20,margin:"16px 0"}}>
          <div style={{fontSize:11,color:C.muted,letterSpacing:2,marginBottom:6}}>JOIN PASSWORD</div>
          <div style={{fontSize:28,fontWeight:700,color:C.green,letterSpacing:6}}>{created.team.password}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:6}}>Share this with your scouters</div>
        </div>
        <button style={sx.btn(C.green)} onClick={()=>onJoin(created.team,created.mem)}>ENTER TEAM HQ →</button>
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
              <button style={sx.sm(C.green)}>ENTER →</button>
            </div>
          ))}
        </div>
      )}

      <div style={{...sx.card,width:"100%",maxWidth:400}}>
        <div style={sx.ct}>Join or Create</div>
        {!mode && <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <button style={sx.btn(C.accent)} onClick={()=>setMode("create")}>➕ CREATE TEAM</button>
          <button style={sx.btn(C.orange)} onClick={()=>setMode("join")}>🔗 JOIN TEAM</button>
          <div style={sx.hr}/>
          <button style={sx.btn(C.red)} onClick={onLogout}>LOGOUT</button>
        </div>}
        {mode==="create"&&<>
          <button style={{...sx.sm(),marginBottom:12}} onClick={()=>{setMode(null);setErr("");}}>← BACK</button>
          <label style={sx.lbl}>Team Number</label>
          <input style={sx.inp} placeholder="e.g. 4027" value={tNum} onChange={e=>setTNum(e.target.value)} inputMode="numeric"/>
          <label style={sx.lbl}>Team Name</label>
          <input style={sx.inp} placeholder="e.g. Tidal Force" value={tName} onChange={e=>setTName(e.target.value)}/>
          {err&&<div style={sx.err}>{err}</div>}
          <button style={sx.btn(C.green)} onClick={createTeam} disabled={busy}>{busy?"CREATING…":"CREATE TEAM →"}</button>
        </>}
        {mode==="join"&&<>
          <button style={{...sx.sm(),marginBottom:12}} onClick={()=>{setMode(null);setErr("");}}>← BACK</button>
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
        <div style={{fontSize:16,fontWeight:700,color:C.accent,letterSpacing:2}}>📢 NEWS</div>
        {isPrivileged&&<button style={{...sx.sm(C.orange),padding:"8px 14px"}} onClick={()=>setShowForm(s=>!s)}>{showForm?"CANCEL":"+ POST"}</button>}
      </div>
      {showForm&&isPrivileged&&(
        <div style={sx.card}>
          <div style={sx.ct}>Post Announcement</div>
          <label style={sx.lbl}>Title</label>
          <input style={sx.inp} placeholder="e.g. Match schedule updated" value={title} onChange={e=>setTitle(e.target.value)}/>
          <label style={sx.lbl}>Message</label>
          <textarea style={{...sx.inp,height:100,resize:"vertical"}} placeholder="Type your announcement…" value={body} onChange={e=>setBody(e.target.value)}/>
          {err&&<div style={sx.err}>{err}</div>}
          <button style={sx.btn(C.orange)} onClick={post} disabled={busy}>{busy?"POSTING…":"POST →"}</button>
        </div>
      )}
      {announcements.length===0&&!showForm&&(
        <div style={{...sx.card,textAlign:"center",color:C.muted,padding:40}}>
          <div style={{fontSize:40,marginBottom:8}}>📢</div>
          <div>{isPrivileged?"No announcements yet. Post one above.":"No announcements yet."}</div>
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
            {isPrivileged&&<button style={sx.sm(C.red)} onClick={()=>deleteAnn(a)}>🗑</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Forms Tab ────────────────────────────────────────────────────────────────
function FormsTab({ team, user, role, syncState, onPending }) {
  const [forms,setForms]=useState([]);
  const [view,setView]=useState("list"); // list | create | fill | edit
  const [active,setActive]=useState(null);
  const [search,setSearch]=useState('');
  const [drafts,setDrafts]=useState([]);
  const [loadError,setLoadError]=useState('');
  const [loading,setLoading]=useState(true);
  const canEdit=syncState.connection==='online';

  useEffect(()=>{load();},[]);
  async function load() {
    try { const r=await fbSelect("forms",{team_id:team.id}); setForms(r);setLoadError('');setDrafts(await deviceStore.all('drafts')); }
    catch(error) { setLoadError(error.message); }
    finally{setLoading(false);}
  }

  async function deleteForm(f,e) {
    e.stopPropagation();
    if (!confirm(`Delete "${f.title}"? All submissions will also be deleted.`)) return;
    try { await fbDelete("submissions",{form_id:f.id}); await fbDeleteById("forms",f.id); setForms(fs=>fs.filter(x=>x.id!==f.id)); }
    catch { alert("Error deleting form."); }
  }

  if (view==="create") return <FormBuilder team={team} user={user} onSave={()=>{setView("list");load();}} onCancel={()=>setView("list")}/>;
  if (view==="edit"&&active) return <FormBuilder team={team} user={user} editing={active} onSave={()=>{setView("list");load();}} onCancel={()=>setView("list")}/>;
  if (view==="fill"&&active) return <FormFiller key={active.id} form={active} user={user} team={team} onDone={()=>{setView("list");load();onPending();}} onCancel={()=>{setView("list");load();}}/>;

  return (
    <div className="page-enter">
      <div className="section-heading page-heading">
        <div><h1 className="page-title">Scouting forms</h1><p className="page-subtitle">Match and pit reports for your team.</p></div>
        {(role==="owner"||role==="admin")&&<button style={{...sx.btn(),width:'auto'}} disabled={!canEdit} onClick={()=>setView("create")}>New form</button>}
      </div>
      <div className="forms-toolbar"><input aria-label="Search forms" placeholder="Find a scouting form…" value={search} onChange={e=>setSearch(e.target.value)}/><span className="outline-tag">{forms.length} forms on this device</span></div>
      {!canEdit&&<div className="notice">Downloaded forms are ready to fill out offline. Creating and editing form templates needs a server connection.</div>}
      {loadError&&<div className="notice notice-error" role="alert">{loadError}</div>}
      {loading&&<div className="panel" role="status">Loading your team’s forms…</div>}
      {!loading&&forms.length===0&&(
        <div style={{...sx.card,textAlign:"center",color:C.muted,padding:40}}>
          <div style={{fontSize:40,marginBottom:8}}>📋</div>
          <div>{(role==="owner"||role==="admin")?"No forms yet. Create one above.":"No forms yet. Ask an admin."}</div>
        </div>
      )}
      <div className="forms-grid">
      {forms.filter(f=>f.title.toLowerCase().includes(search.toLowerCase())).map(f=>(
        <div key={f.id} className="form-tile" style={sx.card}>
          <div className="form-tile-content">
            <div style={{flex:1,cursor:"pointer"}} onClick={()=>{setActive(f);setView("fill");}}>
              <div className="form-type"><NavIcon name="forms"/><span>{f.allow_team_select?'Team scouting':'Scouting report'}</span></div>
              <h2>{f.title}</h2>
              <div style={{fontSize:11,color:C.muted}}>
                {f.questions?.length||0} questions · {f.created_by}
                {f.allow_team_select&&<span style={{marginLeft:6,...sx.tag(C.purple)}}>TEAM SELECT</span>}
                {f.max_submissions_per_team&&<span style={{marginLeft:6,...sx.tag(C.orange)}}>MAX {f.max_submissions_per_team}/team</span>}
              </div>
            </div>
            <div className="form-tile-actions">
              <button style={sx.sm(C.accent)} onClick={()=>{setActive(f);setView("fill");}}>{drafts.some(d=>d.key===draftKey(user.id,team.id,f.id))?'Resume draft':'Open form'} →</button>
              {(role==="owner"||role==="admin")&&<button style={sx.sm(C.muted)} disabled={!canEdit} aria-label={`Edit ${f.title}`} onClick={e=>{e.stopPropagation();setActive(f);setView("edit");}}>Edit</button>}
              {(role==="owner"||role==="admin")&&<button style={sx.sm(C.muted)} disabled={!canEdit} aria-label={`Delete ${f.title}`} onClick={e=>deleteForm(f,e)}>×</button>}
            </div>
          </div>
        </div>
      ))}
      </div>
      {forms.length>0&&!forms.some(f=>f.title.toLowerCase().includes(search.toLowerCase()))&&<div className="panel empty-state">No forms match “{search}”. Try another name.</div>}
    </div>
  );
}

// ─── Form Builder (create + edit) ────────────────────────────────────────────
const QTYPES=[{id:"text",l:"Text"},{id:"number",l:"Number"},{id:"scale",l:"Scale 1–10"},{id:"select",l:"Multiple Choice"},{id:"boolean",l:"Yes / No"},{id:"draw",l:"Draw on Field"},{id:"photo",l:"Photo"}];

function FormBuilder({ team, user, editing, onSave, onCancel }) {
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
    setBusy(true); setErr("");
    const form={
      id: editing?.id||uid(),
      team_id:team.id,
      title:title.trim(),
      questions:qs,
      allow_team_select:allowTeamSelect,
      max_submissions_per_team:maxPerTeam?Number(maxPerTeam):null,
      created_by: editing?.created_by||user.username,
      created_at: editing?.created_at||tsNow(),
      updated_at:tsNow(),
    };
    try { await fbInsert("forms",form); onSave(); }
    catch { setErr("Error saving form."); }
    setBusy(false);
  }

  return (
    <div className="form-builder page-enter">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <button style={sx.sm()} onClick={onCancel}>← BACK</button>
        <div style={{fontSize:20,fontWeight:650,color:C.text}}>{editing?"Edit form":"New form"}</div>
      </div>
      <div style={sx.card}>
        <label style={sx.lbl}>Form Title</label>
        <input style={sx.inp} placeholder="e.g. Qual Match Scout" value={title} onChange={e=>setTitle(e.target.value)}/>
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.text,cursor:"pointer"}}>
            <input type="checkbox" checked={allowTeamSelect} onChange={e=>setAllowTeamSelect(e.target.checked)}/>
            Scouter picks team being scouted
          </label>
        </div>
        {allowTeamSelect&&(
          <>
            <label style={sx.lbl}>Max submissions per team (blank = unlimited)</label>
            <input style={{...sx.inp,marginBottom:0}} type="number" placeholder="e.g. 3" value={maxPerTeam} onChange={e=>setMaxPerTeam(e.target.value)} inputMode="numeric"/>
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
function FormFiller({ form, user, team, onDone, onCancel }) {
  const localDraftKey=draftKey(user.id,team.id,form.id);
  const draft=useReportDraft(localDraftKey,()=>({id:uid(),answers:{},scoutedTeam:''}));
  const ans=draft.value.answers;
  const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const scoutedTeam=draft.value.scoutedTeam;
  const setScoutedTeam=value=>draft.change(current=>({...current,scoutedTeam:value}));
  const [eventTeams,setEventTeams]=useState([]);
  const [subCounts,setSubCounts]=useState({}); // team_number -> count

  useEffect(()=>{
    if (!form.allow_team_select) return;
    (async()=>{
      // Load event teams
      try {
        const evs = await idbAll("scout_events");
        const ev = evs.find(e=>e.team_id===team.id);
        if (ev?.event_teams) setEventTeams(ev.event_teams);
      } catch {}
      // Load submission counts per team for this form
      if (form.max_submissions_per_team) {
        try {
          const subs = await fbSelect("submissions",{form_id:form.id});
          const counts = {};
          subs.forEach(s=>{ if(s.scouted_team) counts[s.scouted_team]=(counts[s.scouted_team]||0)+1; });
          setSubCounts(counts);
        } catch {}
      }
    })();
  },[]);

  const shownQuestions = visibleQuestions(form.questions, ans);
  function set(id,v){ draft.change(current=>({...current,answers:visibleAnswers(form.questions,{...current.answers,[id]:v})}));setErr(''); }

  async function submit() {
    if (busy) return;
    if (form.allow_team_select && !scoutedTeam) { setErr("Please select the team you are scouting."); return; }
    if (form.max_submissions_per_team && scoutedTeam) {
      const count = subCounts[scoutedTeam]||0;
      if (count >= form.max_submissions_per_team) { setErr(`Team #${scoutedTeam} has already been scouted ${count} times (max: ${form.max_submissions_per_team}).`); return; }
    }
    const missing=shownQuestions.filter(q=>q.required&&!hasAnswer(ans[q.id]));
    if (missing.length){ setErr(`Required: ${missing.map(q=>q.text).join(", ")}`); return; }
    setBusy(true); setErr("");
    const sub={id:draft.value.id,form_id:form.id,form_title:form.title,team_id:team.id,scouted_team:scoutedTeam||null,submitted_by:user.username,user_id:user.id,answers:visibleAnswers(form.questions,ans),created_at:tsNow()};
    try {
      await draft.flush();
      await offline.enqueue(sub,localDraftKey);
      setDone(true);
    } catch(error) { setErr(error.message || 'Could not save this report. Keep the page open and try again.'); }
    setBusy(false);
  }

  if (done) return (
    <div className="panel success-panel">
      <div className="success-mark" aria-hidden="true">✓</div>
      <h1>Report saved.</h1>
      <p>Saved on this device. Argus uploads it automatically when the server is reachable. Check the sync indicator for its upload status.</p>
      <button style={sx.btn(C.accent)} onClick={onDone}>BACK TO FORMS</button>
    </div>
  );

  if(!draft.ready)return <div className="panel" role="status">Opening your saved draft…</div>;

  return (
    <div className="report-layout page-enter">
      <div className="report-heading"><button style={sx.sm()} onClick={onCancel}>← Back</button><div><span className="eyebrow">Scouting report</span><h1>{form.title}</h1></div></div>
      <aside className="report-summary panel"><span className="eyebrow">Your progress</span><strong className="progress-count">{shownQuestions.filter(q=>hasAnswer(ans[q.id])).length}<small> / {shownQuestions.length}</small></strong><progress value={shownQuestions.filter(q=>hasAnswer(ans[q.id])).length} max={Math.max(1,shownQuestions.length)}/><p>{draft.saving?'Saving draft…':draft.error?'Draft needs attention':'Draft saved as you go'}</p><p className="muted">You can leave this form and return later. Submit when you're finished to add it to the upload queue.</p><span className="outline-tag">Offline saving enabled</span></aside>
      <div className="report-questions">
      {draft.error&&<div className="notice notice-error" role="alert">{draft.error}</div>}

      {/* Team selector */}
      {form.allow_team_select&&(
        <div style={sx.card}>
          <label style={sx.lbl}>Team You Are Scouting *</label>
          {eventTeams.length > 0 ? (
            <select style={sx.inp} value={scoutedTeam} onChange={e=>setScoutedTeam(e.target.value)}>
              <option value="">— Select Team —</option>
              {eventTeams.map(t=>{
                const count = subCounts[t.team_number]||0;
                const atMax = form.max_submissions_per_team && count >= form.max_submissions_per_team;
                return <option key={t.team_number} value={t.team_number} disabled={atMax}>
                  #{t.team_number}{t.nickname?` — ${t.nickname}`:""}{atMax?" [MAXED]":""}
                </option>;
              })}
            </select>
          ) : (
            <input style={sx.inp} placeholder="Team number e.g. 4027" value={scoutedTeam} onChange={e=>setScoutedTeam(e.target.value)} inputMode="numeric"/>
          )}
        </div>
      )}

      <div className="form-progress">{shownQuestions.filter(q=>hasAnswer(ans[q.id])).length} of {shownQuestions.length} questions answered <span>Required questions are marked *</span></div>
      {shownQuestions.map((q,i)=>(
        <div key={q.id} className="question-card" style={sx.card}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>{i+1}. {q.text}{q.required&&<span style={{color:C.red,marginLeft:4}}>*</span>}</div>
          <QInput q={q} value={ans[q.id]} onChange={v=>set(q.id,v)}/>
        </div>
      ))}
      {err&&<div style={{...sx.err,marginBottom:10}}>{err}</div>}
      <button style={sx.btn()} onClick={submit} disabled={busy}>{busy?"Saving report…":"Submit scouting report"}</button>
      </div>
    </div>
  );
}

// ─── Draw Input (own component so hooks run unconditionally) ─────────────────

// ─── Question Input ───────────────────────────────────────────────────────────
function QInput({ q, value, onChange }) {
  if (q.type==="text")    return <textarea aria-label={q.text} style={{...sx.inp,height:100,resize:"vertical",marginBottom:0}} value={value||""} onChange={e=>onChange(e.target.value)} placeholder="Type your answer…"/>;
  if (q.type==="number")  return <input aria-label={q.text} style={{...sx.inp,marginBottom:0}} type="number" step="any" inputMode="decimal" value={value??""} onChange={e=>onChange(e.target.value === '' ? '' : Number(e.target.value))}/>;
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

function drawField(ctx,w,h){
  ctx.fillStyle="#071020";ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#1e2d45";ctx.lineWidth=2;ctx.strokeRect(8,8,w-16,h-16);
  ctx.strokeStyle="#38bdf8";ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(w/2,8);ctx.lineTo(w/2,h-8);ctx.stroke();
  ctx.beginPath();ctx.arc(w/2,h/2,36,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle="#38bdf822";ctx.fillRect(8,8,70,h-16);ctx.fillRect(w-78,8,70,h-16);
  ctx.fillStyle="#64748b";ctx.font="10px monospace";ctx.textAlign="center";
  ctx.fillText("BLUE",43,h/2+4);ctx.fillText("RED",w-43,h/2+4);
  ctx.fillText("2025 FRC FIELD",w/2,h-14);
}

// ─── Event Tab ────────────────────────────────────────────────────────────────
function assignTeams(teams, scouters) {
  if (!scouters.length || !teams.length) return {};
  const shuffled = [...teams].sort(()=>Math.random()-0.5);
  const assignment = {};
  scouters.forEach(s => { assignment[s.user_id] = { username:s.username, teams:[] }; });
  shuffled.forEach((t,i) => {
    const scouter = scouters[i % scouters.length];
    assignment[scouter.user_id].teams.push(t.team_number ?? t);
  });
  return assignment;
}

function EventTab({ team, user, role }) {
  const isPrivileged = role==="owner"||role==="admin";
  const [year,setYear]=useState(new Date().getFullYear().toString());
  const [eventKey,setEventKey]=useState("");
  const [eventSearch,setEventSearch]=useState("");
  const [events,setEvents]=useState([]);
  const [searching,setSearching]=useState(false);
  const [searchErr,setSearchErr]=useState("");
  const [currentEvent,setCurrentEvent]=useState(null);
  const [eventTeams,setEventTeams]=useState([]);
  const [members,setMembers]=useState([]);
  const [assignment,setAssignment]=useState(null);
  const [excluded,setExcluded]=useState([]);
  const [loading,setLoading]=useState(false);
  const [view,setView]=useState("main"); // main | assign | matches | pitscout_view
  const [msg,setMsg]=useState("");
  // Matches
  const [matches,setMatches]=useState([]);
  const [matchesLoading,setMatchesLoading]=useState(false);
  // Pit scouting
  const [pitScouted,setPitScouted]=useState([]); // team numbers this user marked
  const [allPitScouts,setAllPitScouts]=useState([]); // all pit scout records
  const [pitView,setPitView]=useState("mine"); // mine | all
  // Change event prompt
  const [pendingEvent,setPendingEvent]=useState(null);

  useEffect(()=>{
    (async()=>{
      // Load from local storage
      try {
        const cached = await idbAll("scout_events");
        const ev = cached.find(e=>e.team_id===team.id);
        if (ev) { setCurrentEvent(ev); if(ev.assignment)setAssignment(ev.assignment); if(ev.excluded)setExcluded(ev.excluded); if(ev.event_teams)setEventTeams(ev.event_teams); }
      } catch {}
      try {
        const mrows=await fbSelect("memberships",{team_id:team.id});
        setMembers(mrows);
      } catch {}
      // Load pit scouts
      await loadPitScouts();
    })();
  },[]);

  async function loadPitScouts() {
    try {
      const rows = (await idbAll("pit_scouts")).filter(r=>r.team_id===team.id);
      setAllPitScouts(rows);
      const mine = rows.filter(r=>r.user_id===user.id).map(r=>r.scouted_team);
      setPitScouted(mine);
    } catch {}
  }

  async function togglePitScout(teamNum) {
    const existing = allPitScouts.find(r=>r.team_id===team.id&&r.user_id===user.id&&r.scouted_team===teamNum);
    if (existing) {
      await idbDel("pit_scouts",existing.id);
      setAllPitScouts(a=>a.filter(r=>r.id!==existing.id));
      setPitScouted(p=>p.filter(t=>t!==teamNum));
    } else {
      const rec={id:uid(),team_id:team.id,user_id:user.id,username:user.username,scouted_team:teamNum,created_at:tsNow()};
      await idbPut("pit_scouts",rec);
      setAllPitScouts(a=>[...a,rec]);
      setPitScouted(p=>[...p,teamNum]);
    }
  }

  async function loadMatches() {
    if (!currentEvent) return;
    setMatchesLoading(true);
    try {
      const data = await tbaFetch(`/event/${currentEvent.event_key}/matches/simple`);
      // Sort: upcoming first, completed to back
      data.sort((a,b)=>{
        const aComp=a.actual_time||a.post_result_time; const bComp=b.actual_time||b.post_result_time;
        if(!aComp&&!bComp) return (a.predicted_time||0)-(b.predicted_time||0);
        if(!aComp) return -1;
        if(!bComp) return 1;
        return aComp-bComp;
      });
      setMatches(data);
    } catch { setMsg("❌ Could not load matches."); }
    setMatchesLoading(false);
  }

  async function searchEvents() {
    if (!year) return;
    setSearching(true); setSearchErr(""); setEvents([]);
    try {
      const data = await tbaFetch(`/events/${year}/simple`);
      let filtered = data;
      if (eventSearch.trim()) {
        const q=eventSearch.toLowerCase();
        filtered=data.filter(e=>e.name.toLowerCase().includes(q)||e.event_code.toLowerCase().includes(q)||(e.city||"").toLowerCase().includes(q));
      }
      filtered.sort((a,b)=>a.name.localeCompare(b.name));
      setEvents(filtered.slice(0,40));
      if (!filtered.length) setSearchErr("No events found.");
    } catch { setSearchErr("Could not reach The Blue Alliance."); }
    setSearching(false);
  }

  async function selectEvent(ev) {
    // If there's already a different event, prompt about data
    if (currentEvent && currentEvent.event_key !== ev.key) {
      setPendingEvent(ev);
      return;
    }
    await doSelectEvent(ev, false, false);
  }

  async function doSelectEvent(ev, exportFirst, deleteForms) {
    setLoading(true); setMsg(""); setPendingEvent(null);
    try {
      const forms = await fbSelect("forms",{team_id:team.id});
      const allSubs = [];
      for(const f of forms){ const s=await fbSelect("submissions",{form_id:f.id}); allSubs.push(...s); }

      if (exportFirst && allSubs.length) {
        exportToCSV(forms, allSubs);
      }

      // Delete all submissions locally
      for(const s of allSubs) await idbDel("submissions", s.id);

      // Optionally delete forms too
      if (deleteForms) {
        for(const f of forms) await idbDel("forms", f.id);
      }

      if (ev) {
        // Switching to a new event — fetch its teams and save scout_events doc
        const teams = await tbaFetch(`/event/${ev.key}/teams/simple`);
        teams.sort((a,b)=>a.team_number-b.team_number);
        const existing = await fbSelect("scout_events",{team_id:team.id});
        const doc2 = {
          id: existing.length ? existing[0].id : uid(),
          team_id: team.id,
          event_key: ev.key,
          event_name: ev.name,
          event_location: `${ev.city||""}, ${ev.state_prov||""}`.trim().replace(/^,\s*/,""),
          event_teams: teams.map(t=>({team_number:t.team_number, nickname:t.nickname})),
          assignment: null, excluded: [], updated_at: tsNow(),
        };
        await idbPut("scout_events", doc2);
        setCurrentEvent(doc2); setEventTeams(doc2.event_teams);
        setAssignment(null); setExcluded([]); setEvents([]); setEventSearch("");
        setMatches([]); setPitScouted([]); setAllPitScouts([]);
        setMsg(`✅ Switched to ${ev.name} — ${teams.length} teams loaded`);
      } else {
        // Ending the event — delete the scout_events doc
        const existing = await fbSelect("scout_events",{team_id:team.id});
        for(const e of existing) await idbDel("scout_events", e.id);
        setCurrentEvent(null); setEventTeams([]); setAssignment(null);
        setExcluded([]); setMatches([]); setPitScouted([]); setAllPitScouts([]);
        setMsg("✅ Event ended — all data cleared.");
      }
    } catch(e) { setMsg("❌ Error: " + e.message); }
    setLoading(false);
  }

  async function handleDeleteData(deleteForms) {
    setLoading(true); setMsg("");
    try {
      const forms = await fbSelect("forms",{team_id:team.id});
      const allSubs = [];
      for(const f of forms){ const s=await fbSelect("submissions",{form_id:f.id}); allSubs.push(...s); }
      if (allSubs.length) exportToCSV(forms, allSubs); // always export before deleting
      for(const s of allSubs) await idbDel("submissions", s.id);
      if (deleteForms) for(const f of forms) await idbDel("forms", f.id);
      // Reset assignment on the scout_events doc but keep the event
      const existing = await fbSelect("scout_events",{team_id:team.id});
      if (existing.length) {
        const patch = {assignment:null, excluded:[], updated_at:tsNow()};
        await idbPut("scout_events",{...existing[0],...patch});
      }
      setAssignment(null); setExcluded([]);
      setPitScouted([]); setAllPitScouts([]);
      setMsg(deleteForms?"✅ All submissions and forms deleted.":"✅ All submissions deleted. Forms kept.");
    } catch(e) { setMsg("❌ Error deleting data: " + e.message); }
    setLoading(false);
  }

  function toggleExclude(user_id) { setExcluded(ex => ex.includes(user_id) ? ex.filter(x=>x!==user_id) : [...ex,user_id]); }

  async function generateAssignment() {
    const scouters = members.filter(m=>!excluded.includes(m.user_id));
    if (!scouters.length) { setMsg("❌ No scouters available."); return; }
    const newAssignment = assignTeams(eventTeams, scouters);
    const existing = await fbSelect("scout_events",{team_id:team.id});
    if (existing.length) await idbPut("scout_events",{...existing[0],assignment:newAssignment,excluded,updated_at:tsNow()});
    setAssignment(newAssignment);
    setMsg(`✅ Assigned ${eventTeams.length} teams to ${scouters.length} scouters`);
  }

  async function saveExcluded() {
    const existing = await fbSelect("scout_events",{team_id:team.id});
    if (!existing.length) return;
    const scouters = members.filter(m=>!excluded.includes(m.user_id));
    const newAssignment = assignTeams(eventTeams, scouters);
    await idbPut("scout_events",{...existing[0],assignment:newAssignment,excluded,updated_at:tsNow()});
    setAssignment(newAssignment);
    setMsg(`✅ Updated — ${scouters.length} scouters`);
    setView("main");
  }

  // Get my assigned teams
  const myTeams = assignment?.[user.id]?.teams || [];

  // Matches filtered by my teams
  const myMatches = matches.filter(m=>{
    const allNums=[...m.alliances?.blue?.team_keys||[],...m.alliances?.red?.team_keys||[]].map(k=>parseInt(k.replace("frc","")));
    return myTeams.some(t=>allNums.includes(Number(t)));
  });

  // Change event dialog — shown when selecting a new event while one exists
  if (pendingEvent) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",padding:16}}>
      <div style={sx.card}>
        <div style={{...sx.ct,color:C.orange}}>⚠ Switch Event</div>
        <div style={{fontSize:13,color:C.text,marginBottom:4}}>
          Switching from <strong style={{color:C.accent}}>{currentEvent.event_name}</strong> to <strong style={{color:C.green}}>{pendingEvent.name}</strong>.
        </div>
        <div style={{fontSize:12,color:C.muted,marginBottom:16}}>
          All form submissions will be deleted. Your forms (templates) can be kept or also deleted.
        </div>

        <div style={{fontSize:11,color:C.accent,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Export data first?</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <button style={{...sx.btn(C.green),flex:1,padding:"10px 8px",fontSize:12}}
            onClick={()=>{ setPendingEvent({...pendingEvent,_export:true}); }}>
            📥 YES — EXPORT
          </button>
          <button style={{...sx.btn(C.muted),flex:1,padding:"10px 8px",fontSize:12}}
            onClick={()=>{ setPendingEvent({...pendingEvent,_export:false}); }}>
            NO EXPORT
          </button>
        </div>

        {pendingEvent._export !== undefined && <>
          <div style={{fontSize:11,color:C.accent,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Delete forms too?</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>Submissions are always deleted. Forms are the templates you built — you can keep them for the new event.</div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <button style={{...sx.btn(C.red),flex:1,padding:"10px 8px",fontSize:12}} disabled={loading}
              onClick={()=>doSelectEvent(pendingEvent, pendingEvent._export, true)}>
              {loading?"…":"🗑 DELETE FORMS TOO"}
            </button>
            <button style={{...sx.btn(C.orange),flex:1,padding:"10px 8px",fontSize:12}} disabled={loading}
              onClick={()=>doSelectEvent(pendingEvent, pendingEvent._export, false)}>
              {loading?"…":"KEEP FORMS"}
            </button>
          </div>
        </>}

        <button style={{...sx.btn(C.muted),marginTop:4}} onClick={()=>setPendingEvent(null)}>CANCEL</button>
      </div>
    </div>
  );

  // Assignment management view
  if (view==="assign"&&isPrivileged) return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <button style={sx.sm()} onClick={()=>setView("main")}>← BACK</button>
        <div style={{fontSize:14,fontWeight:700,color:C.accent}}>SCOUTER ASSIGNMENT</div>
      </div>
      <div style={sx.card}>
        <div style={sx.ct}>Exclude from Assignment</div>
        {members.map(m=>{
          const isExcluded=excluded.includes(m.user_id);
          return (
            <div key={m.id} style={{...sx.row,opacity:isExcluded?0.4:1}}>
              <div style={sx.avatar(RC[m.role]||C.muted)}>{m.username?.[0]?.toUpperCase()}</div>
              <div style={{flex:1}}><div style={{fontSize:13}}>{m.username}</div><span style={sx.tag(RC[m.role]||C.muted)}>{m.role?.toUpperCase()}</span></div>
              <button style={{...sx.sm(isExcluded?C.red:C.green),padding:"8px 14px"}} onClick={()=>toggleExclude(m.user_id)}>
                {isExcluded?"EXCLUDED":"ACTIVE"}
              </button>
            </div>
          );
        })}
      </div>
      {msg&&<div style={{...sx.card,color:msg.startsWith("✅")?C.green:C.red,fontSize:13}}>{msg}</div>}
      <button style={sx.btn(C.green)} onClick={saveExcluded}>SAVE & REASSIGN →</button>
    </div>
  );

  // Matches view
  if (view==="matches") return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <button style={sx.sm()} onClick={()=>setView("main")}>← BACK</button>
        <div style={{fontSize:14,fontWeight:700,color:C.accent}}>UPCOMING MATCHES</div>
      </div>
      {matchesLoading&&<div style={{color:C.muted,fontSize:13,textAlign:"center",padding:24}}>Loading matches…</div>}
      {!matchesLoading&&matches.length===0&&<div style={{...sx.card,textAlign:"center",color:C.muted,padding:40}}>No match data available.</div>}
      {(() => {
        const now = Math.floor(Date.now()/1000);
        const upcoming = matches.filter(m=>!(m.actual_time||m.post_result_time));
        const completed = matches.filter(m=>m.actual_time||m.post_result_time);
        const renderMatch = (m, isComplete) => {
          const blue = m.alliances?.blue?.team_keys?.map(k=>parseInt(k.replace("frc","")));
          const red  = m.alliances?.red?.team_keys?.map(k=>parseInt(k.replace("frc","")));
          const blueScore = m.alliances?.blue?.score;
          const redScore  = m.alliances?.red?.score;
          const myBlue = myTeams.some(t=>blue?.includes(Number(t)));
          const myRed  = myTeams.some(t=>red?.includes(Number(t)));
          const hasMyTeam = myBlue||myRed;
          const predTime = m.predicted_time ? new Date(m.predicted_time*1000).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : null;
          return (
            <div key={m.key} style={{...sx.card,borderColor:hasMyTeam?(isComplete?C.green+"66":C.accent+"88"):C.border,opacity:isComplete?0.7:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:11,fontWeight:700,color:isComplete?C.green:C.accent}}>{isComplete?"✅ COMPLETED":"⏳"} {m.comp_level?.toUpperCase()} {m.match_number}</span>
                {predTime&&!isComplete&&<span style={{fontSize:11,color:C.muted}}>{predTime}</span>}
                {hasMyTeam&&<span style={sx.tag(C.orange)}>MY TEAMS</span>}
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                <div style={{flex:1,background:"#1e40af33",border:"1px solid #3b82f644",borderRadius:6,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:10,color:"#60a5fa",marginBottom:4,letterSpacing:2}}>BLUE</div>
                  {blue?.map(n=><div key={n} style={{fontSize:12,fontWeight:myTeams.includes(String(n))||myTeams.includes(n)?700:400,color:myTeams.includes(String(n))||myTeams.includes(n)?"#93c5fd":C.text}}>#{n}</div>)}
                  {isComplete&&blueScore!=null&&blueScore>=0&&<div style={{fontSize:20,fontWeight:700,color:"#60a5fa",marginTop:4}}>{blueScore}</div>}
                </div>
                <div style={{display:"flex",alignItems:"center",fontWeight:700,color:C.muted,fontSize:14}}>VS</div>
                <div style={{flex:1,background:"#7f1d1d33",border:"1px solid #ef444444",borderRadius:6,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:10,color:"#f87171",marginBottom:4,letterSpacing:2}}>RED</div>
                  {red?.map(n=><div key={n} style={{fontSize:12,fontWeight:myTeams.includes(String(n))||myTeams.includes(n)?700:400,color:myTeams.includes(String(n))||myTeams.includes(n)?"#fca5a5":C.text}}>#{n}</div>)}
                  {isComplete&&redScore!=null&&redScore>=0&&<div style={{fontSize:20,fontWeight:700,color:"#f87171",marginTop:4}}>{redScore}</div>}
                </div>
              </div>
            </div>
          );
        };
        return <>
          {upcoming.length>0&&<div style={{...sx.ct,marginBottom:8}}>UPCOMING ({upcoming.length})</div>}
          {upcoming.map(m=>renderMatch(m,false))}
          {completed.length>0&&<div style={{...sx.ct,marginTop:4,marginBottom:8,color:C.muted}}>COMPLETED ({completed.length})</div>}
          {completed.map(m=>renderMatch(m,true))}
        </>;
      })()}
    </div>
  );

  // Pit scouting admin view
  if (view==="pitscout_view"&&isPrivileged) {
    // Aggregate: for each event team, who has pit scouted them
    const pitByTeam = {};
    for(const t of eventTeams){ pitByTeam[t.team_number]=[]; }
    for(const r of allPitScouts){ if(pitByTeam[r.scouted_team])pitByTeam[r.scouted_team].push(r.username); }
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <button style={sx.sm()} onClick={()=>setView("main")}>← BACK</button>
          <div style={{fontSize:14,fontWeight:700,color:C.accent}}>PIT SCOUT OVERVIEW</div>
        </div>
        <div style={sx.card}>
          <div style={sx.ct}>All Teams ({eventTeams.length})</div>
          {eventTeams.map(t=>{
            const scouts=pitByTeam[t.team_number]||[];
            return (
              <div key={t.team_number} style={{...sx.row,flexWrap:"wrap"}}>
                <div style={sx.avatar(scouts.length>0?C.green:C.muted)}>#{String(t.team_number).slice(-2)}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700}}>#{t.team_number} {t.nickname&&<span style={{fontWeight:400,color:C.muted}}>— {t.nickname}</span>}</div>
                  {scouts.length>0
                    ?<div style={{fontSize:11,color:C.green}}>✅ Scouted by: {scouts.join(", ")}</div>
                    :<div style={{fontSize:11,color:C.red}}>❌ Not pit scouted</div>
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Delete Data view ─────────────────────────────────────────────────────
  if (view==="deletedata"&&isPrivileged) {
    const [exportChoice,setExportChoice]=useState(null); // null | true | false
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <button style={sx.sm()} onClick={()=>setView("main")}>← BACK</button>
          <div style={{fontSize:14,fontWeight:700,color:C.red}}>🗑 DELETE EVENT DATA</div>
        </div>
        <div style={sx.card}>
          <div style={{fontSize:13,color:C.text,marginBottom:4}}>
            This will delete <strong style={{color:C.red}}>all form submissions</strong> for <strong style={{color:C.accent}}>{currentEvent?.event_name}</strong>.
          </div>
          <div style={{fontSize:12,color:C.muted,marginBottom:16}}>The event itself and your scouter assignments stay. You can choose whether to keep or delete your forms.</div>

          <div style={{fontSize:11,color:C.accent,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Export before deleting?</div>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <button style={{...sx.btn(C.green),flex:1,padding:"10px 8px",fontSize:12,background:exportChoice===true?C.green+"33":undefined}}
              onClick={()=>setExportChoice(true)}>📥 YES — EXPORT FIRST</button>
            <button style={{...sx.btn(C.muted),flex:1,padding:"10px 8px",fontSize:12,background:exportChoice===false?C.muted+"33":undefined}}
              onClick={()=>setExportChoice(false)}>SKIP EXPORT</button>
          </div>

          {exportChoice!==null&&<>
            <div style={{fontSize:11,color:C.accent,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Delete forms too?</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:12}}>Forms are the question templates you built. Submissions are the answers scouters filled in.</div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <button style={{...sx.btn(C.red),flex:1,padding:"10px 8px",fontSize:12}} disabled={loading} onClick={async()=>{
                if (!confirm("Delete ALL submissions AND forms? This cannot be undone.")) return;
                await handleDeleteData(true); if(!loading) setView("main");
              }}>{loading?"DELETING…":"🗑 DELETE SUBMISSIONS + FORMS"}</button>
              <button style={{...sx.btn(C.orange),flex:1,padding:"10px 8px",fontSize:12}} disabled={loading} onClick={async()=>{
                if (!confirm("Delete all submissions? Forms will be kept.")) return;
                await handleDeleteData(false); if(!loading) setView("main");
              }}>{loading?"DELETING…":"DELETE SUBMISSIONS ONLY"}</button>
            </div>
          </>}

          <button style={{...sx.btn(C.muted),marginTop:4}} onClick={()=>setView("main")}>CANCEL</button>
        </div>
      </div>
    );
  }

  // ── End Event view ────────────────────────────────────────────────────────
  if (view==="endevent"&&isPrivileged) {
    const [exportChoice,setExportChoice]=useState(null);
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <button style={sx.sm()} onClick={()=>setView("main")}>← BACK</button>
          <div style={{fontSize:14,fontWeight:700,color:C.red}}>🏁 END EVENT</div>
        </div>
        <div style={sx.card}>
          <div style={{fontSize:13,color:C.text,marginBottom:4}}>
            This will <strong style={{color:C.red}}>end</strong> <strong style={{color:C.accent}}>{currentEvent?.event_name}</strong> and delete all submissions and the event record.
          </div>
          <div style={{fontSize:12,color:C.muted,marginBottom:16}}>You can choose whether to keep or delete your forms, and whether to export first.</div>

          <div style={{fontSize:11,color:C.accent,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Export before ending?</div>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <button style={{...sx.btn(C.green),flex:1,padding:"10px 8px",fontSize:12,background:exportChoice===true?C.green+"33":undefined}}
              onClick={()=>setExportChoice(true)}>📥 YES — EXPORT FIRST</button>
            <button style={{...sx.btn(C.muted),flex:1,padding:"10px 8px",fontSize:12,background:exportChoice===false?C.muted+"33":undefined}}
              onClick={()=>setExportChoice(false)}>SKIP EXPORT</button>
          </div>

          {exportChoice!==null&&<>
            <div style={{fontSize:11,color:C.accent,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Delete forms too?</div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <button style={{...sx.btn(C.red),flex:1,padding:"10px 8px",fontSize:12}} disabled={loading} onClick={async()=>{
                if (!confirm("End event and delete ALL submissions and forms? Cannot be undone.")) return;
                await doSelectEvent(null, exportChoice, true); setView("main");
              }}>{loading?"ENDING…":"🗑 END + DELETE FORMS"}</button>
              <button style={{...sx.btn(C.orange),flex:1,padding:"10px 8px",fontSize:12}} disabled={loading} onClick={async()=>{
                if (!confirm("End event and delete all submissions? Forms will be kept.")) return;
                await doSelectEvent(null, exportChoice, false); setView("main");
              }}>{loading?"ENDING…":"END + KEEP FORMS"}</button>
            </div>
          </>}

          <button style={{...sx.btn(C.muted),marginTop:4}} onClick={()=>setView("main")}>CANCEL</button>
        </div>
      </div>
    );
  }

  // Main event view
  return (
    <div>
      <div style={{fontSize:16,fontWeight:700,color:C.accent,letterSpacing:2,marginBottom:12}}>🏆 EVENT</div>

      {currentEvent && (
        <div style={{...sx.card,borderColor:C.accent+"66"}}>
          <div style={sx.ct}>Current Event</div>
          <div style={{fontSize:16,fontWeight:700,marginBottom:2}}>{currentEvent.event_name}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:10}}>{currentEvent.event_location} · {eventTeams.length} teams</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button style={{...sx.sm(C.accent),flex:1}} onClick={()=>{setView("matches");loadMatches();}}>📅 MATCHES</button>
            {isPrivileged&&<button style={{...sx.sm(C.purple),flex:1}} onClick={()=>setView("pitscout_view")}>🔍 PIT OVERVIEW</button>}
            {isPrivileged&&<button style={{...sx.sm(C.orange),flex:1}} onClick={generateAssignment}>🎲 RANDOMIZE</button>}
            {isPrivileged&&<button style={{...sx.sm(C.muted),flex:1}} onClick={()=>setView("assign")}>👥 SCOUTERS</button>}
          </div>
          {isPrivileged&&(
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
              <button style={{...sx.sm(C.red),flex:1}} disabled={loading} onClick={async()=>{
                setView("deletedata");
              }}>🗑 DELETE DATA</button>
              <button style={{...sx.sm(C.red),flex:1}} disabled={loading} onClick={()=>setView("endevent")}>🏁 END EVENT</button>
            </div>
          )}
        </div>
      )}

      {msg&&<div style={{...sx.card,color:msg.startsWith("✅")?C.green:C.red,fontSize:13,padding:12}}>{msg}</div>}

      {/* My assignment */}
      {assignment&&(
        <div style={sx.card}>
          <div style={sx.ct}>📋 My Teams to Scout</div>
          {myTeams.length===0
            ?<div style={{color:C.muted,fontSize:13}}>Not assigned to any teams at this event.</div>
            :<div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {myTeams.map(tn=>{
                  const isPit=pitScouted.includes(tn)||pitScouted.includes(String(tn));
                  return (
                    <div key={tn} style={{background:C.bg2,border:`1px solid ${isPit?C.green+"66":C.accent+"44"}`,borderRadius:8,padding:"10px 14px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:70}}>
                      <div style={{fontSize:14,fontWeight:700,color:isPit?C.green:C.accent}}>#{tn}</div>
                      <button style={{...sx.sm(isPit?C.green:C.muted),fontSize:9,padding:"3px 6px",minHeight:"unset"}} onClick={()=>togglePitScout(tn)}>
                        {isPit?"✅ PIT":"🔍 PIT?"}
                      </button>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      )}

      {/* Pit scouting for all event teams */}
      {!assignment&&currentEvent&&eventTeams.length>0&&(
        <div style={sx.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={sx.ct} style={{margin:0}}>🔍 Pit Scouting</div>
            <div style={{display:"flex",gap:6}}>
              <button style={sx.nb(pitView==="mine")} onClick={()=>setPitView("mine")}>MINE</button>
              {isPrivileged&&<button style={sx.nb(pitView==="all")} onClick={()=>setPitView("all")}>ALL</button>}
            </div>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {eventTeams.map(t=>{
              const isPit=pitScouted.includes(t.team_number)||pitScouted.includes(String(t.team_number));
              return (
                <button key={t.team_number}
                  style={{...sx.sm(isPit?C.green:C.muted),fontSize:11,padding:"6px 10px"}}
                  onClick={()=>togglePitScout(t.team_number)}>
                  {isPit?"✅":""} #{t.team_number}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Full assignment breakdown */}
      {isPrivileged&&assignment&&(
        <div style={sx.card}>
          <div style={sx.ct}>Full Assignment</div>
          {Object.entries(assignment).map(([uid2,data])=>(
            <div key={uid2} style={{marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <div style={sx.avatar(C.green)}>{data.username?.[0]?.toUpperCase()}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:700}}>{data.username}</div>
                  <div style={{fontSize:11,color:C.muted}}>{data.teams.length} teams</div>
                </div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {data.teams.map(tn=>{
                  const pitDone = allPitScouts.some(r=>r.user_id===uid2&&(r.scouted_team===tn||r.scouted_team===String(tn)));
                  return <span key={tn} style={{...sx.tag(pitDone?C.green:C.accent),fontSize:11}}>{pitDone?"✅":""} #{tn}</span>;
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All teams */}
      {eventTeams.length>0&&(
        <div style={sx.card}>
          <div style={sx.ct}>All Teams ({eventTeams.length})</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {eventTeams.map(t=>(
              <div key={t.team_number} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 10px",fontSize:11}}>
                <span style={{color:C.accent,fontWeight:700}}>#{t.team_number}</span>
                {t.nickname&&<span style={{color:C.muted,marginLeft:4}}>{t.nickname.slice(0,16)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event search */}
      {isPrivileged&&(
        <div style={sx.card}>
          <div style={sx.ct}>{currentEvent?"Change Event":"Find Event"}</div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:"0 0 80px"}}>
              <label style={sx.lbl}>Year</label>
              <input style={{...sx.inp,marginBottom:0}} value={year} onChange={e=>setYear(e.target.value)} inputMode="numeric" maxLength={4}/>
            </div>
            <div style={{flex:1}}>
              <label style={sx.lbl}>Search (name/city)</label>
              <input style={{...sx.inp,marginBottom:0}} placeholder="e.g. Ontario or ONT" value={eventSearch} onChange={e=>setEventSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchEvents()}/>
            </div>
          </div>
          <button style={sx.btn(C.accent)} onClick={searchEvents} disabled={searching}>{searching?"SEARCHING…":"SEARCH EVENTS →"}</button>
          {searchErr&&<div style={{...sx.err,marginTop:8}}>{searchErr}</div>}
          {events.length>0&&(
            <div style={{marginTop:12}}>
              <div style={{...sx.ct,marginBottom:8}}>Results ({events.length})</div>
              {events.map(e=>(
                <div key={e.key} style={{...sx.row,cursor:"pointer"}} onClick={()=>!loading&&selectEvent(e)}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700}}>{e.name}</div>
                    <div style={{fontSize:11,color:C.muted}}>{e.city&&`${e.city}, `}{e.state_prov} · {e.key}</div>
                  </div>
                  <button style={sx.sm(C.green)} disabled={loading}>{loading?"…":"SELECT"}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!currentEvent&&!isPrivileged&&(
        <div style={{...sx.card,textAlign:"center",color:C.muted,padding:40}}>
          <div style={{fontSize:40,marginBottom:8}}>🏆</div>
          <div>No event selected yet. Ask an admin to set one up.</div>
        </div>
      )}
    </div>
  );
}

// ─── My Team Tab ──────────────────────────────────────────────────────────────
function MyTeamTab({ team, user, role }) {
  const [subTab,setSubTab]=useState("myteam"); // myteam | search
  const [streamMode,setStreamMode]=useState(true);
  const [teamInfo,setTeamInfo]=useState(null);
  const [ranking,setRanking]=useState(null);
  const [upcomingMatches,setUpcomingMatches]=useState([]);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [currentEventKey,setCurrentEventKey]=useState(null);
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


  const [autoEventKey, setAutoEventKey] = useState(null);
  const [manualStreamUrl, setManualStreamUrl] = useState("");
  const [manualStreamInput, setManualStreamInput] = useState("");
  const [showStreamInput, setShowStreamInput] = useState(false);

  // ── Auto-detect team's current active event from TBA ─────────────────────
  useEffect(()=>{
    if(!team.frc_team_number) return;
    (async()=>{
      try {
        const year = new Date().getFullYear();
        const events = await tbaFetch(`/team/frc${team.frc_team_number}/events/${year}/simple`);
        if(!Array.isArray(events)||!events.length) return;
        const today = Date.now()/1000;
        const active = events.find(e=>{
          const start = new Date(e.start_date+"T00:00:00").getTime()/1000;
          const end   = new Date(e.end_date+"T23:59:59").getTime()/1000;
          return today>=start && today<=end;
        });
        const upcoming = !active && events
          .filter(e=>new Date(e.start_date+"T00:00:00").getTime()/1000 > today)
          .sort((a,b)=>new Date(a.start_date)-new Date(b.start_date))[0];
        const detected = (active||upcoming||null)?.key||null;
        if(detected) setAutoEventKey(detected);
      } catch {}
    })();
  },[team.frc_team_number]);

  // Effective event key: auto-detected takes priority over manually set one
  const effectiveEventKey = autoEventKey || currentEventKey;

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
    } catch {}
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
    } catch(e) {
      setLiveErr("Could not load live event data.");
    }
    setLiveLoading(false);
  }

  useEffect(()=>{
    (async()=>{
      try {
        const evs = await idbAll("scout_events");
        const ev = evs.find(e=>e.team_id===team.id);
        if(ev)setCurrentEventKey(ev.event_key);
      } catch {}
    })();
  },[]);

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

  return (
    <div>
      <div style={{fontSize:16,fontWeight:700,color:C.accent,letterSpacing:2,marginBottom:12}}>⭐ MY TEAM</div>

      {/* Sub-tab nav */}
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
        <button style={sx.nb(subTab==="myteam")} onClick={()=>setSubTab("myteam")}>⭐ MY TEAM</button>
        <button style={sx.nb(subTab==="search")} onClick={()=>setSubTab("search")}>🔍 SEARCH TEAM</button>
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
                        }}>SET</button>
                        {manualStreamUrl&&<button style={sx.sm(C.red)} onClick={()=>{setManualStreamUrl("");setManualStreamInput("");setShowStreamInput(false);}}>CLEAR</button>}
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
                          <div style={{background:C.bg0,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",marginBottom:10,fontSize:12,lineHeight:1.6}} dangerouslySetInnerHTML={{__html:liveData.status.overall_status_str}}/>
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
                        }}>SET</button>
                        {manualStreamUrl&&<button style={sx.sm(C.red)} onClick={()=>{setManualStreamUrl("");setManualStreamInput("");setShowStreamInput(false);}}>CLEAR</button>}
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
                        <div style={{...sx.card,fontSize:12,lineHeight:1.6,marginTop:8}} dangerouslySetInnerHTML={{__html:liveData.status.overall_status_str}}/>
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
function DataTab({ team, user, role }) {
  const [forms,setForms]=useState([]);
  const [sel,setSel]=useState(null);
  const [subs,setSubs]=useState([]);
  const [detail,setDetail]=useState(null);
  const [search,setSearch]=useState("");
  const [searchQ,setSearchQ]=useState("");
  const [filterTeam,setFilterTeam]=useState("");
  const [eventTeams,setEventTeams]=useState([]);
  const [viewMode,setViewMode]=useState("subs"); // subs | teamview

  useEffect(()=>{
    (async()=>{
      try{const r=await fbSelect("forms",{team_id:team.id});setForms(r);}
      catch{}
      // Load event teams for team-view filter
      try {
        const evs=await idbAll("scout_events");
        const ev=evs.find(e=>e.team_id===team.id);
        if(ev?.event_teams)setEventTeams(ev.event_teams);
      } catch {}
    })();
  },[]);

  async function loadSubs(form) {
    setSel(form);setDetail(null);setSearch("");setSearchQ("");setFilterTeam("");
    try{const r=await fbSelect("submissions",{form_id:form.id});setSubs(r);}
    catch{}
  }

  async function deleteSub(s,e) {
    e.stopPropagation();
    if (!confirm("Delete this submission?"))return;
    try{await idbDel("submissions",s.id);setSubs(ss=>ss.filter(x=>x.id!==s.id));}
    catch{alert("Error deleting submission.");}
  }

  async function exportAll() {
    const allSubs=[];
    for(const f of forms){
      try{const s=await fbSelect("submissions",{form_id:f.id});allSubs.push(...s);}catch{}
    }
    exportToCSV(forms,allSubs);
  }

  if (detail) return (
    <div>
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
        <button style={sx.sm()} onClick={()=>setDetail(null)}>← BACK</button>
        <span style={{fontSize:13,color:C.accent}}>SUBMISSION</span>
      </div>
      <div style={sx.card}>
        <div style={{fontSize:12,color:C.muted,marginBottom:12}}>
          By <strong style={{color:C.accent}}>{detail.submitted_by}</strong>
          {detail.scouted_team&&<> · Team <strong style={{color:C.orange}}>#{detail.scouted_team}</strong></>}
          · {new Date(detail.created_at).toLocaleString()}
        </div>
        {sel.questions.map(q=>(
          <div key={q.id} style={{padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{q.text}</div>
            {(q.type==="draw"||q.type==="photo")
              ?(detail.answers?.[q.id]?<img src={detail.answers[q.id]} alt="ans" style={{maxWidth:"100%",borderRadius:6}}/>:<span style={{color:C.muted}}>No image</span>)
              :<div style={{fontSize:14}}>{String(detail.answers?.[q.id]??"—")}</div>}
          </div>
        ))}
      </div>
    </div>
  );

  if (!sel) return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:16,fontWeight:700,color:C.accent}}>📊 DATA</div>
        <button style={sx.sm(C.green)} onClick={exportAll}>📥 EXPORT ALL</button>
      </div>
      {forms.length===0&&<div style={{...sx.card,textAlign:"center",color:C.muted,padding:40}}>No forms yet.</div>}
      {forms.map(f=>(
        <div key={f.id} style={{...sx.card,cursor:"pointer"}} onClick={()=>loadSubs(f)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:15,fontWeight:700,marginBottom:2}}>{f.title}</div>
              <div style={{fontSize:11,color:C.muted}}>{f.questions?.length||0} questions</div>
            </div>
            <button style={sx.sm()}>VIEW →</button>
          </div>
        </div>
      ))}
    </div>
  );

  const analytics=buildAnalytics(sel,subs);
  const filtered=subs.filter(s=>{
    if(filterTeam&&s.scouted_team!==filterTeam&&String(s.scouted_team)!==filterTeam)return false;
    if(!search)return true;
    return Object.entries(s.answers||{}).some(([k,v])=>{if(searchQ&&k!==searchQ)return false;return String(v).toLowerCase().includes(search.toLowerCase());});
  });

  // Team view: pick a scouted team and see all their data
  const scoutedTeamNums = [...new Set(subs.filter(s=>s.scouted_team).map(s=>String(s.scouted_team)))].sort();

  return (
    <div>
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
        <button style={sx.sm()} onClick={()=>setSel(null)}>← BACK</button>
        <span style={{fontSize:14,fontWeight:700,color:C.accent}}>{sel.title}</span>
        <span style={sx.tag(C.green)}>{subs.length}</span>
        <button style={{...sx.sm(C.green),marginLeft:"auto"}} onClick={()=>exportToCSV([sel],subs)}>📥 CSV</button>
      </div>

      {/* View mode toggle */}
      {scoutedTeamNums.length>0&&(
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <button style={sx.nb(viewMode==="subs")} onClick={()=>setViewMode("subs")}>SUBMISSIONS</button>
          <button style={sx.nb(viewMode==="teamview")} onClick={()=>setViewMode("teamview")}>📋 TEAM VIEW</button>
        </div>
      )}

      {/* Team view: admin selects a team and sees all submissions for them */}
      {viewMode==="teamview"&&(
        <div style={sx.card}>
          <div style={sx.ct}>Select Team to View</div>
          <select style={sx.inp} value={filterTeam} onChange={e=>setFilterTeam(e.target.value)}>
            <option value="">— All Teams —</option>
            {scoutedTeamNums.map(n=>{
              const ev=eventTeams.find(t=>String(t.team_number)===n);
              return <option key={n} value={n}>#{n}{ev?.nickname?` — ${ev.nickname}`:""}</option>;
            })}
          </select>
          {filterTeam&&(
            <>
              <div style={{...sx.ct,marginTop:8}}>Analytics for Team #{filterTeam}</div>
              {buildAnalyticsDisplay(buildAnalytics(sel,filtered))}
              <div style={{...sx.ct,marginTop:8,marginBottom:8}}>Submissions ({filtered.length})</div>
              {filtered.map(s=>(
                <div key={s.id} style={{...sx.row,cursor:"pointer"}} onClick={()=>setDetail(s)}>
                  <div style={sx.avatar(C.accent)}>{s.submitted_by?.[0]?.toUpperCase()}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13}}>{s.submitted_by}</div>
                    <div style={{fontSize:11,color:C.muted}}>{new Date(s.created_at).toLocaleString()}</div>
                  </div>
                  <button style={sx.sm(C.red)} onClick={e=>deleteSub(s,e)}>🗑</button>
                  <span style={{color:C.muted}}>›</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {viewMode==="subs"&&(
        <>
          {Object.keys(analytics).length>0&&(
            <div style={sx.card}>
              <div style={sx.ct}>Analytics</div>
              {buildAnalyticsDisplay(analytics)}
            </div>
          )}
          <div style={sx.card}>
            <input style={{...sx.inp,marginBottom:6}} placeholder="Search answers…" value={search} onChange={e=>setSearch(e.target.value)}/>
            <select style={{...sx.inp,marginBottom:6}} value={searchQ} onChange={e=>setSearchQ(e.target.value)}>
              <option value="">All questions</option>
              {sel.questions.map(q=><option key={q.id} value={q.id}>{q.text}</option>)}
            </select>
            {scoutedTeamNums.length>0&&(
              <select style={{...sx.inp,marginBottom:0}} value={filterTeam} onChange={e=>setFilterTeam(e.target.value)}>
                <option value="">All teams</option>
                {scoutedTeamNums.map(n=><option key={n} value={n}>#{n}</option>)}
              </select>
            )}
          </div>
          <div style={sx.card}>
            <div style={sx.ct}>Submissions ({filtered.length})</div>
            {filtered.length===0&&<div style={{color:C.muted,fontSize:13}}>No results.</div>}
            {filtered.map(s=>(
              <div key={s.id} style={{...sx.row,cursor:"pointer"}} onClick={()=>setDetail(s)}>
                <div style={sx.avatar(C.accent)}>{s.submitted_by?.[0]?.toUpperCase()}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13}}>{s.submitted_by}{s.scouted_team&&<span style={{color:C.orange,marginLeft:6}}>→ #{s.scouted_team}</span>}</div>
                  <div style={{fontSize:11,color:C.muted}}>{new Date(s.created_at).toLocaleString()}</div>
                </div>
                <button style={sx.sm(C.red)} onClick={e=>deleteSub(s,e)}>🗑</button>
                <span style={{color:C.muted}}>›</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function buildAnalyticsDisplay(analytics) {
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
      {Object.values(analytics).map((a,i)=>(
        <div key={i} style={{background:C.bg0,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px",minWidth:130,flex:"1 1 130px"}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:4}}>{a.label}</div>
          {(a.type==="number"||a.type==="scale")&&<><div style={{fontSize:22,fontWeight:700,color:C.accent}}>{a.avg}</div><div style={{fontSize:10,color:C.muted}}>avg · {a.min}–{a.max}</div></>}
          {a.type==="dist"&&Object.entries(a.counts).sort((x,y)=>y[1]-x[1]).slice(0,3).map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:1}}>
              <span style={{color:C.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{k}</span>
              <span style={{color:C.accent,fontWeight:700}}>{Math.round(v/a.total*100)}%</span>
            </div>
          ))}
          {a.type==="text"&&<div style={{fontSize:18,fontWeight:700,color:C.accent}}>{a.n}</div>}
        </div>
      ))}
    </div>
  );
}

function buildAnalytics(form,subs){
  const out={};
  (form?.questions||[]).forEach(q=>{
    const vals=subs.map(s=>s.answers?.[q.id]).filter(v=>v!=null&&v!=="");
    if(!vals.length)return;
    if(q.type==="number"||q.type==="scale"){const nums=vals.map(Number).filter(n=>!isNaN(n));out[q.id]={type:q.type,label:q.text,min:Math.min(...nums),max:Math.max(...nums),avg:(nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(1),n:nums.length};}
    else if(q.type==="select"||q.type==="boolean"){const counts={};vals.forEach(v=>{counts[v]=(counts[v]||0)+1;});out[q.id]={type:"dist",label:q.text,counts,total:vals.length};}
    else if(q.type==="text"){out[q.id]={type:"text",label:q.text,n:vals.length};}
  });
  return out;
}

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

  useEffect(()=>{load();},[]);
  async function load(){
    try{const r=await fbSelect("memberships",{team_id:team.id});setMembers(r);}
    catch{}
  }

  async function setRole(m,role){
    try{
      const u={...m,role}; await idbPut("memberships",u);
      setMembers(ms=>ms.map(x=>x.id===m.id?u:x));
      setMsg(`${m.username} is now ${role}.`);setErr("");
      if(m.user_id===user.id)onRoleChange?.();
    }catch{setErr("Failed to update role.");}
  }

  async function transferOwnership(m){
    if(!confirm(`Transfer ownership to ${m.username}? You will become an admin.`))return;
    try{
      const myMem=members.find(x=>x.user_id===user.id);
      if(myMem){ await idbPut("memberships",{...myMem,role:"admin"}); }
      await idbPut("memberships",{...m,role:"owner"});
      const t=await idbGet("teams",team.id);
      if(t) await idbPut("teams",{...t,owner_id:m.user_id});
      setMsg(`${m.username} is now the owner. Reloading…`);
      setTimeout(()=>window.location.reload(),1500);
    }catch{setErr("Failed to transfer ownership.");}
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
      <div style={{fontSize:16,fontWeight:700,color:C.accent,letterSpacing:2,marginBottom:12}}>⚙️ MANAGE</div>
      {msg&&<div style={{...sx.card,color:C.green,fontSize:13,borderColor:C.green+"44",padding:12}}>{msg}</div>}
      {err&&<div style={{...sx.card,color:C.red,fontSize:13,borderColor:C.red+"44",padding:12}}>{err}</div>}

      <div style={sx.card}>
        <div style={sx.ct}>Team Info</div>
        {editName?<>
          <label style={sx.lbl}>Team Name</label>
          <input style={sx.inp} value={tName} onChange={e=>setTName(e.target.value)}/>
          <div style={{display:"flex",gap:8}}>
            <button style={{...sx.btn(C.green),flex:1}} onClick={saveName}>SAVE</button>
            <button style={{...sx.btn(C.red),flex:1}} onClick={()=>{setEditName(false);setTName(team.name);}}>CANCEL</button>
          </div>
        </>:<>
          <div style={{fontSize:14,marginBottom:4}}>#{team.number} — {team.name}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:10}}>Password: <span style={{color:C.green,letterSpacing:4,fontWeight:700}}>{team.password}</span></div>
          <button style={sx.btn()} onClick={()=>setEditName(true)}>EDIT NAME</button>
        </>}
      </div>

      <div style={sx.card}>
        <div style={sx.ct}>Settings</div>
        <div style={{...sx.row,borderBottom:"none"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700}}>Pit Scout Tracking</div>
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
            <button style={sx.btn()} onClick={()=>setEditFrc(true)}>CHANGE</button>
          </>
        ):(
          <>
            <label style={sx.lbl}>FRC Team Number</label>
            <input style={sx.inp} placeholder="e.g. 254" value={frcTeamNum} onChange={e=>setFrcTeamNum(e.target.value)} inputMode="numeric"/>
            <div style={{display:"flex",gap:8}}>
              <button style={{...sx.btn(C.green),flex:1}} onClick={saveFrcTeamNum} disabled={savingFrc}>{savingFrc?"SAVING…":"SAVE →"}</button>
              {editFrc&&<button style={{...sx.btn(C.muted),flex:1}} onClick={()=>{setEditFrc(false);setFrcTeamNum(team.frc_team_number||"");}}>CANCEL</button>}
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
                {m.role==="member"&&<button style={sx.sm(C.accent)} onClick={()=>setRole(m,"admin")}>ADMIN</button>}
                {m.role==="admin" &&<button style={sx.sm(C.muted)}  onClick={()=>setRole(m,"member")}>MEMBER</button>}
                <button style={sx.sm(C.orange)} onClick={()=>transferOwnership(m)} title="Transfer ownership">👑</button>
                <button style={sx.sm(C.red)} onClick={()=>kick(m)}>KICK</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
