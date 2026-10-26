import {useState} from 'react';

export default function AccountSecurity({api,user,onUserUpdate,workspace,role,onWorkspaceUpdate}){
 const [password,setPassword]=useState(''),[username,setUsername]=useState(user.username),[code,setCode]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(action){
  if(busy)return;setBusy(true);setError('');setMessage('');setCode('');
  try{
   const result=await api('POST',`/auth/${action}`,{current_password:password,username,team_id:workspace.id});setPassword('');
   if(action==='recovery-code'){setCode(result.recovery_code);setMessage('Save this code somewhere private. It is shown only here and replaces any previous code.');}
   else if(action==='rotate-join-code'){await onWorkspaceUpdate(result.team);setMessage('Team join code replaced. Existing members keep access. Share the new code privately.');}
   else{await onUserUpdate(result);setMessage('Username changed. Your reports and assignments are unchanged.');}
  }catch(e){setError(e.message||'Could not update your account.');}finally{setBusy(false);}
 }
 return <section className="a-panel" aria-labelledby="account-security-heading"><h2 id="account-security-heading">Account security</h2>
  <p>Change your username or create a recovery code. If you forget your password, use that code from the sign-in screen. Email recovery is not available.</p>
  <form className="a-stack" onSubmit={e=>{e.preventDefault();submit('change-username');}}>
   <label>Username<input className="a-input" autoComplete="username" maxLength={80} value={username} onChange={e=>setUsername(e.target.value)} required/></label>
   <label>Current password<input className="a-input" type="password" autoComplete="current-password" maxLength={1024} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
   <div className="a-actions"><button className="a-button" disabled={busy} type="submit">Change username</button><button className="a-button" type="button" disabled={busy||!password} onClick={()=>submit('recovery-code')}>Create recovery code</button></div>
  </form>
  {role==='owner'&&<details className="a-disclosure"><summary>Team join code</summary><p>Replacing the code stops new members joining with the old code. Existing members keep access. Enter your current password above first.</p><label>Current team join code<input className="a-input" readOnly value={workspace.password||''}/></label><button className="a-button" type="button" disabled={busy||!password} onClick={()=>submit('rotate-join-code')}>Replace team join code</button></details>}
  {error&&<p className="a-danger" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {code&&<div><label>Recovery code<input className="a-input" aria-label="Recovery code" readOnly value={code} onFocus={e=>e.target.select()}/></label><p>Keep it outside this browser. Anyone with this code and your username can reset your password. It works once; create a new one after using it.</p><button className="a-button" onClick={()=>{setCode('');setMessage('');}}>Hide code</button></div>}
 </section>;
}
