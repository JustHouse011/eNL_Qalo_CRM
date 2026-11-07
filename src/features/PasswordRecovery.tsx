import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import type { LoginBrand } from '../lib/loginBranding'
import { completePasswordRecovery, passwordValidation, recoveryConfigured, recoveryConfirmation, recoveryUnavailable, requestPasswordRecovery, validateRecoveryToken, type PasswordPolicy } from '../lib/passwordRecovery'

export function PasswordRecovery({brand, reset = false}: {brand:LoginBrand;reset?:boolean}) {
  const [email,setEmail]=useState('')
  // A fragment never reaches the HTTP server. Keep the credential only in this mounted component.
  const [token,setToken]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).get('token') || '')
  const [password,setPassword]=useState(''), [confirmation,setConfirmation]=useState('')
  const [show,setShow]=useState(false), [showConfirmation,setShowConfirmation]=useState(false)
  const [policy,setPolicy]=useState<PasswordPolicy|null>(null)
  const [busy,setBusy]=useState(false), [done,setDone]=useState(false), [error,setError]=useState('')
  useEffect(()=>{
    if (!reset) return
    const receiveLink=()=>{
      const next=new URLSearchParams(window.location.hash.slice(1)).get('token') || ''
      setPolicy(null);setError('');setDone(false);setPassword('');setConfirmation('');setToken(next)
    }
    window.addEventListener('hashchange',receiveLink)
    return ()=>window.removeEventListener('hashchange',receiveLink)
  },[reset])
  useEffect(()=>{
    if (!reset) return
    window.history.replaceState(window.history.state,'',window.location.pathname)
    if (!recoveryConfigured || !token || token.length>2048) return
    let active=true
    void validateRecoveryToken(token,brand).then(value=>{if(active)setPolicy(value)}).catch(()=>{if(active)setError('This reset link cannot be verified. It may be invalid or expired. Request a new link.')})
    return ()=>{active=false}
  },[brand,reset,token])
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(busy || done || !recoveryConfigured) return
    if(reset) {
      if(!policy || !token) return
      const message=passwordValidation(password,confirmation,policy)
      if(message){setError(message);return}
    }
    setBusy(true);setError('')
    try {
      if(reset) {await completePasswordRecovery(token,password,brand);setToken('');setPassword('');setConfirmation('');setPolicy(null)}
      else await requestPasswordRecovery(email,brand)
      setDone(true)
    } catch(e) {setError(e instanceof Error ? e.message : 'The recovery service is unavailable. Please try again later.')}
    finally {setBusy(false)}
  }
  const invalidLink=reset && (!token || token.length>2048) && !done
  return <AuthLayout brand={brand} label={`${brand === 'qalo' ? 'Qalo Ya Afrika' : 'eNL Mutual Bank'} password recovery`}><div className="login-content login-recovery-content">
    <div className="login-welcome"><h1>{done && reset ? 'Password updated successfully.' : reset ? 'Reset your password' : 'Forgot your password?'}</h1><p>{done ? reset ? 'Return to sign in with your new password.' : recoveryConfirmation : reset ? 'Choose a new password for your staff account.' : "Enter your registered work email address and we'll send you a secure link to reset your password."}</p></div>
    {!recoveryConfigured && <p className="login-recovery-notice" role="status">{recoveryUnavailable}</p>}
    {recoveryConfigured && invalidLink && <p className="login-error" role="alert">This reset link is invalid or has expired. Request a new link.</p>}
    {!done && <form className="login-form" onSubmit={submit}>
      {!reset ? <><label htmlFor="recovery-email">Email address</label><div className="login-input-field"><Mail aria-hidden="true"/><input id="recovery-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></div></> : <>
        <label htmlFor="new-password">New password</label><div className="login-input-field"><LockKeyhole aria-hidden="true"/><input id="new-password" type={show?'text':'password'} autoComplete="new-password" required value={password} disabled={!policy || busy} onChange={e=>{setPassword(e.target.value);setError('')}} aria-describedby="password-guidance"/><button className="login-password-toggle" type="button" onClick={()=>setShow(!show)} aria-label={show?'Hide new password':'Show new password'} aria-pressed={show}>{show?<EyeOff/>:<Eye/>}</button></div>
        <p id="password-guidance" className="login-password-guidance">{policy ? `Use ${policy.minLength}–${policy.maxLength} characters. Choose a long, unique passphrase that you do not use elsewhere.` : 'Password requirements will appear after your secure link is verified.'}</p>
        <label htmlFor="confirm-password">Confirm new password</label><div className="login-input-field"><LockKeyhole aria-hidden="true"/><input id="confirm-password" type={showConfirmation?'text':'password'} autoComplete="new-password" required value={confirmation} disabled={!policy || busy} onChange={e=>{setConfirmation(e.target.value);setError('')}}/><button className="login-password-toggle" type="button" onClick={()=>setShowConfirmation(!showConfirmation)} aria-label={showConfirmation?'Hide confirmed password':'Show confirmed password'} aria-pressed={showConfirmation}>{showConfirmation?<EyeOff/>:<Eye/>}</button></div>
      </>}
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="login-submit" disabled={busy || !recoveryConfigured || (reset && !policy)}>{busy?'Please wait…':reset?'Update Password':'Send Reset Link'}</button>
    </form>}
    {reset && !done && <Link className="login-recovery-link" to={`/${brand}/forgot-password`}>Request a new reset link</Link>}
    <Link className="login-recovery-link" to={`/${brand}/signin`}>Back to Sign In</Link>
    <span className="login-staff-note">Access for authorised staff. Accounts are managed by your administrator.</span>
  </div></AuthLayout>
}
