import { previewIdentity } from '../lib/administratorRoles'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { sessionPreferences } from '../lib/storage'
import { loginBrands, type LoginBrand } from '../lib/loginBranding'
import { supportService } from '../lib/supportService'
import { LoginArtwork } from './LoginArtwork'
import './Login.css'
import { verifyDemoCredentials } from '../lib/demoAuth'
type AccountRole = 'signed-out' | `user:${string}`
const DemoAccess = createContext({ role: 'user:user-agent-1' as AccountRole, setRole: (_role: AccountRole) => {}, signOut: () => {} })
export function DemoAccessProvider({ children }: { children: ReactNode }) {
  const [role, setValue] = useState<AccountRole>(() => { const saved = sessionPreferences.getItem('qalo-profile-preview'); return saved === 'signed-out' ? saved : (import.meta.env.DEV ? previewIdentity(saved) : null) || (import.meta.env.DEV && saved !== null ? 'signed-out' : 'user:user-agent-1') })
  const client = useQueryClient()
  useEffect(() => {
    // A browser Back/Forward-cache restore may resume an older React identity.
    const restore = () => {
      if (sessionPreferences.getItem('qalo-profile-preview') !== 'signed-out') return
      setValue('signed-out')
      void client.cancelQueries().finally(() => client.clear())
    }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [client])
  function setRole(next: AccountRole) {
    const previous = sessionPreferences.getItem('qalo-profile-preview')
    const saved = sessionPreferences.setItem('qalo-profile-preview', next)
    if (next === 'signed-out' && !saved) {
      if (previous === null) sessionPreferences.removeItem('qalo-profile-preview')
      else sessionPreferences.setItem('qalo-profile-preview', previous)
      throw new Error('Sign-out could not be saved. Allow browser session storage and try again.')
    }
    setValue(next)
  }
  function signOut() { setRole('signed-out'); sessionPreferences.removeItem('qalo-developer-user') }
  return <DemoAccess.Provider value={{ role, setRole, signOut }}>{children}</DemoAccess.Provider>
}
// Presentation state only; see docs/BACKEND.md for authentication requirements.
export const useDemoAccess = () => useContext(DemoAccess)
export function DemoSignIn({ brand = 'qalo' }: { brand?: LoginBrand }) {
  const config = loginBrands[brand]
  const { setRole } = useDemoAccess()
  const navigate = useNavigate()
  const [step, setStep] = useState<'credentials' | 'code'>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [oneTimeCode, setOneTimeCode] = useState('')
  const [emailPreviewCode, setEmailPreviewCode] = useState('')
  const [expiresAt, setExpiresAt] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSigningIn(true)
    if (!await verifyDemoCredentials(email, password)) {
      setError('Email or password is incorrect.')
      setSigningIn(false)
      return
    }
    setError('')
    setEmailPreviewCode(createOneTimeCode())
    setExpiresAt(Date.now() + 5 * 60 * 1000)
    setOneTimeCode('')
    setStep('code')
    setSigningIn(false)
  }

  function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (Date.now() > expiresAt) { setError('This code has expired. Request a new one.'); return }
    if (oneTimeCode !== emailPreviewCode) { setError('That code is incorrect.'); return }
    const preferred = import.meta.env.DEV ? sessionPreferences.getItem('qalo-developer-user') : null
    const identity = preferred === null ? 'user:user-agent-1' : previewIdentity(preferred)
    if (!identity) { setError('Saved developer identity is unavailable. Select a fixture in the developer session preview.'); return }
    try {
      supportService.selectWorkspace(config.workspaceId, identity.slice(5))
      setRole(identity)
      navigate('/overview', { replace: true })
    } catch { setError('This account cannot open the selected workspace. Please contact your administrator.') }
  }

  function resendCode() {
    setEmailPreviewCode(createOneTimeCode(emailPreviewCode))
    setExpiresAt(Date.now() + 5 * 60 * 1000)
    setOneTimeCode('')
    setError('')
  }

  function backToCredentials() {
    setStep('credentials')
    setPassword('')
    setOneTimeCode('')
    setEmailPreviewCode('')
    setError('')
  }

  return <div className={`login-page login-brand-${brand}`}>
    <main className="login-shell">
      <LoginArtwork brand={brand} />
      <section className="login-panel" aria-label={`${config.name} staff sign-in`}>
      <div className="login-content">
        <div className="login-welcome"><h1>{step === 'credentials' ? 'Welcome back.' : 'Check your code.'}</h1><p>{step === 'credentials' ? 'Sign in to your workspace.' : `Enter the six-digit code for ${email}.`}</p></div>
        {step === 'credentials' ? <form className="login-form" onSubmit={signIn}>
          <label htmlFor="login-email">Email address</label>
          <div className="login-input-field"><Mail size={19} aria-hidden="true" /><input id="login-email" type="email" autoComplete="username" value={email} onChange={event => { setEmail(event.target.value); setError('') }} required /></div>
          <label htmlFor="login-password">Password</label>
          <div className="login-input-field"><LockKeyhole size={19} aria-hidden="true" /><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => { setPassword(event.target.value); setError('') }} required /><button className="login-password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          <Link className="login-forgot-link" to={`/${brand}/forgot-password`}>Forgot password?</Link>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" disabled={signingIn}><span>{signingIn ? 'Signing in…' : 'Sign In'}</span><ArrowRight size={18} aria-hidden="true" /></button>
        </form> : <>
          <section className="email-code-preview" aria-label="Email preview"><span>Email preview</span><strong>To: {email}</strong><p>Your {config.name} sign-in code</p><output data-testid="email-preview-code">{emailPreviewCode}</output><small>Use this code within 5 minutes to finish signing in.</small></section>
          <form className="login-form" onSubmit={verifyCode}>
            <label htmlFor="login-one-time-code">One-time code</label>
            <div className="login-input-field"><LockKeyhole size={19} aria-hidden="true" /><input id="login-one-time-code" aria-label="One-time code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={oneTimeCode} onChange={event => { setOneTimeCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} required /></div>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" disabled={oneTimeCode.length !== 6}><span>Verify code</span><ArrowRight size={18} aria-hidden="true" /></button>
            <div className="otp-actions"><button type="button" onClick={resendCode}>Resend code</button><button type="button" onClick={backToCredentials}>Change email or password</button></div>
          </form>
        </>}
        <span className="login-staff-note">Access for authorised staff. Accounts are managed by your administrator.</span>
      </div>
      </section>
    </main>
  </div>
}

function createOneTimeCode(exclude = '') {
  let code = ''
  do { code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0') } while (code === exclude)
  return code
}
