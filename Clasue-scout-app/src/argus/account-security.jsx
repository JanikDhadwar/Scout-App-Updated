import {useEffect,useState} from 'react';

export default function AccountSecurity({api,user,onUserUpdate,workspace,role,onWorkspaceUpdate}){
 const [password,setPassword]=useState(''),[username,setUsername]=useState(user.username),[code,setCode]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [mfa,setMfa]=useState(null),[enrollment,setEnrollment]=useState(null),[mfaCode,setMfaCode]=useState(''),[mfaRecovery,setMfaRecovery]=useState([]);
 useEffect(()=>{let active=true;api('GET','/auth/mfa/status').then(value=>{if(active)setMfa(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[api]);
 async function submit(action){
  if(busy)return;setBusy(true);setError('');setMessage('');setCode('');
  try{
   const result=await api('POST',`/auth/${action}`,{current_password:password,username,team_id:workspace.id});setPassword('');
   if(action==='recovery-code'){setCode(result.recovery_code);setMessage('Save this code somewhere private. It is shown only here and replaces any previous code.');}
   else if(action==='rotate-join-code'){await onWorkspaceUpdate(result.team);setMessage('Team join code replaced. Existing members keep access. Share the new code privately.');}
   else{await onUserUpdate(result);setMessage('Username changed. Your reports and assignments are unchanged.');}
  }catch(e){setError(e.message||'Could not update your account.');}finally{setBusy(false);}
 }
 async function mfaAction(action){if(busy)return;setBusy(true);setError('');setMessage('');setMfaRecovery([]);try{
  if(action==='start'){const value=await api('POST','/auth/mfa/enroll/start',{current_password:password});setEnrollment(value);setMessage('Add the secret to your authenticator, then enter its current six-digit code.');}
  else if(action==='confirm'){const value=await api('POST','/auth/mfa/enroll/confirm',{enrollment_id:enrollment.enrollment_id,code:mfaCode});setMfaRecovery(value.recovery_codes);setEnrollment(null);setMfaCode('');setPassword('');setMfa(await api('GET','/auth/mfa/status'));setMessage('MFA enabled. Save every recovery code before leaving this page.');}
  else if(action==='recovery'){const value=await api('POST','/auth/mfa/recovery-codes',{current_password:password});setMfaRecovery(value.recovery_codes);setPassword('');setMfa(await api('GET','/auth/mfa/status'));setMessage('Previous MFA recovery codes no longer work. Save these replacements.');}
  else if(action==='disable'){await api('POST','/auth/mfa/disable',{current_password:password});window.location.reload();}
 }catch(e){setError(e.message||'Could not update MFA.');}finally{setBusy(false);}}
 return <section className="a-panel" aria-labelledby="account-security-heading"><h2 id="account-security-heading">Account security</h2>
  <p>Change your username or create a recovery code. If you forget your password, use that code from the sign-in screen. Email recovery is not available.</p>
  <form className="a-stack" onSubmit={e=>{e.preventDefault();submit('change-username');}}>
   <label>Username<input className="a-input" autoComplete="username" maxLength={80} value={username} onChange={e=>setUsername(e.target.value)} required/></label>
   <label>Current password<input className="a-input" type="password" autoComplete="current-password" maxLength={1024} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
   <div className="a-actions"><button className="a-button" disabled={busy} type="submit">Change username</button><button className="a-button" type="button" disabled={busy||!password} onClick={()=>submit('recovery-code')}>Create recovery code</button></div>
  </form>
  {role==='owner'&&<details className="a-disclosure"><summary>Team join code</summary><p>Replacing the code stops new members joining with the old code. Existing members keep access. Enter your current password above first.</p><label>Current team join code<input className="a-input" readOnly value={workspace.password||''}/></label><button className="a-button" type="button" disabled={busy||!password} onClick={()=>submit('rotate-join-code')}>Replace team join code</button></details>}
  <details className="a-disclosure" open={!!enrollment||!!mfaRecovery.length}><summary>Multi-factor authentication · {mfa?.enrolled?'Enabled':mfa?.available?'Optional':'Server setup required'}</summary>
   {!mfa?.available?<p>The operator must configure the private MFA encryption key before enrollment.</p>:!mfa?.enrolled&&!enrollment?<><p>Use a TOTP authenticator when signing in. Enrollment does not become active until you confirm a valid code.</p><button className="a-button" type="button" disabled={busy||!password} onClick={()=>mfaAction('start')}>Start MFA enrollment</button></>:null}
   {enrollment&&<div className="a-stack"><label>Authenticator secret<input className="a-input" readOnly value={enrollment.secret} onFocus={e=>e.target.select()}/></label><p>Issuer: Argus. Type: time-based, SHA-1, six digits, 30 seconds. Do not share this secret.</p><label>Current six-digit code<input className="a-input" inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={e=>setMfaCode(e.target.value)} maxLength={8}/></label><button className="a-button" type="button" disabled={busy||!/^\d{6}$/.test(mfaCode)} onClick={()=>mfaAction('confirm')}>Confirm and enable MFA</button></div>}
   {mfa?.enrolled&&!enrollment&&<><p>{mfa.recovery_codes_remaining} unused MFA recovery codes remain. Regeneration invalidates every previous MFA recovery code.</p><div className="a-actions"><button className="a-button" type="button" disabled={busy||!password} onClick={()=>mfaAction('recovery')}>Replace MFA recovery codes</button><button className="a-button a-danger" type="button" disabled={busy||!password} onClick={()=>{if(confirm('Disable MFA and sign out every device?'))mfaAction('disable');}}>Disable MFA</button></div></>}
   {!!mfaRecovery.length&&<div role="status"><strong>Save these one-time MFA recovery codes now</strong><textarea className="a-input" readOnly rows={10} value={mfaRecovery.join('\n')} onFocus={e=>e.target.select()}/><p>They are shown only here. Store them outside this device.</p></div>}
  </details>
  {error&&<p className="a-danger" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {code&&<div><label>Recovery code<input className="a-input" aria-label="Recovery code" readOnly value={code} onFocus={e=>e.target.select()}/></label><p>Keep it outside this browser. Anyone with this code and your username can reset your password. It works once; create a new one after using it.</p><button className="a-button" onClick={()=>{setCode('');setMessage('');}}>Hide code</button></div>}
 </section>;
}
