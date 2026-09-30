import { createContext, useContext, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import type { Role } from '../data/mockCatalog'
import { branding } from '../lib/branding'
import { verifyDemoCredentials } from '../lib/demoAuth'
const DemoAccess = createContext({ role: 'Admin' as Role, setRole: (_role: Role) => {} })
export function DemoAccessProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('Admin')
  return <DemoAccess.Provider value={{ role, setRole }}>{children}</DemoAccess.Provider>
}
// Presentation state only; see docs/BACKEND.md for authentication requirements.
export const useDemoAccess = () => useContext(DemoAccess)
export function DemoSignIn() {
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
    setRole('Admin')
    navigate('/overview')
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

  return <div className="app-shell standalone demo-login">
    <div className="login-backdrop" aria-hidden="true"><img src="/qalo-login-background.png" alt="" /></div>
    <main className="login-panel">
      <div className="login-content">
        <img className="login-logo" src="/Logo%20Light%20Moded.svg" alt={branding.name} />
        <div className="login-welcome"><span>QALO YA AFRIKA SUPPORT</span><h1>{step === 'credentials' ? 'Welcome back' : 'Check your code'}</h1><p>{step === 'credentials' ? 'Sign in to continue to your workspace.' : `Enter the six-digit code for ${email}.`}</p></div>
        {step === 'credentials' ? <form className="login-form" onSubmit={signIn}>
          <label htmlFor="login-email">Email address</label>
          <div className="login-input-field"><Mail size={19} aria-hidden="true" /><input id="login-email" type="email" autoComplete="username" value={email} onChange={event => { setEmail(event.target.value); setError('') }} required /></div>
          <label htmlFor="login-password">Password</label>
          <div className="login-input-field"><LockKeyhole size={19} aria-hidden="true" /><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => { setPassword(event.target.value); setError('') }} required /><button className="login-password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" disabled={signingIn}><span>Sign in</span><ArrowRight size={18} aria-hidden="true" /></button>
        </form> : <>
          <section className="email-code-preview" aria-label="Email preview"><span>Email preview</span><strong>To: {email}</strong><p>Your Qalo sign-in code</p><output data-testid="email-preview-code">{emailPreviewCode}</output><small>Use this code within 5 minutes to finish signing in.</small></section>
          <form className="login-form" onSubmit={verifyCode}>
            <label htmlFor="login-one-time-code">One-time code</label>
            <div className="login-input-field"><LockKeyhole size={19} aria-hidden="true" /><input id="login-one-time-code" aria-label="One-time code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={oneTimeCode} onChange={event => { setOneTimeCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} required /></div>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" disabled={oneTimeCode.length !== 6}><span>Verify code</span><ArrowRight size={18} aria-hidden="true" /></button>
            <div className="otp-actions"><button type="button" onClick={resendCode}>Resend code</button><button type="button" onClick={backToCredentials}>Change email or password</button></div>
          </form>
        </>}
        <Link className="login-support-link" to="/chat">Looking for help? Contact support</Link>
      </div>
    </main>
  </div>
}

function createOneTimeCode(exclude = '') {
  let code = ''
  do { code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0') } while (code === exclude)
  return code
}
