import type { LoginBrand } from './loginBranding'

/** Opt-in integration contract, NOT an authentication backend. Disabled by default. */
export const recoveryConfigured = import.meta.env.VITE_STAFF_PASSWORD_RECOVERY_ENABLED === 'true'
export const recoveryUnavailable = 'Password recovery is not available yet. Please contact your administrator.'
export const recoveryConfirmation = "If an account exists for this email address, you'll receive password reset instructions shortly."
export type PasswordPolicy = { minLength: number; maxLength: number }
export class RecoveryError extends Error {}
async function post(action: string, body: object) {
  if (!recoveryConfigured) throw new RecoveryError(recoveryUnavailable)
  let response: Response
  try {
    response = await fetch(`/api/staff-auth/recovery/${action}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer', signal:AbortSignal.timeout(15000) })
  } catch { throw new RecoveryError('The recovery service is unavailable. Please try again later.') }
  if (response.status === 429) throw new RecoveryError('Too many attempts. Please wait before trying again.')
  if ((response.status === 400 || response.status === 410) && action !== 'request') throw new RecoveryError('This reset link is invalid or has expired. Request a new link.')
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new RecoveryError('The recovery service is unavailable. Please try again later.')
  try { return await response.json() as Record<string, unknown> } catch { throw new RecoveryError('The recovery service is unavailable. Please try again later.') }
}
export async function requestPasswordRecovery(email: string, brand: LoginBrand) {
  const result = await post('request', {email:email.trim().toLowerCase(), brand})
  if (result.accepted !== true) throw new RecoveryError('The recovery service is unavailable. Please try again later.')
}
export async function validateRecoveryToken(token: string, brand: LoginBrand): Promise<PasswordPolicy> {
  const result = await post('validate', {token, brand})
  const policy = result.policy as PasswordPolicy | undefined
  if (result.valid !== true || !policy || !Number.isInteger(policy.minLength) || !Number.isInteger(policy.maxLength) || policy.minLength < 8 || policy.maxLength < policy.minLength || policy.maxLength > 1024) throw new RecoveryError('This reset link is invalid or has expired. Request a new link.')
  return {minLength:policy.minLength,maxLength:policy.maxLength}
}
export async function completePasswordRecovery(token: string, password: string, brand: LoginBrand) {
  const result = await post('complete', {token,password,brand})
  if (result.updated !== true) throw new RecoveryError('The password could not be updated. Please request a new link.')
}
export function passwordValidation(password: string, confirmation: string, policy: PasswordPolicy) {
  if (password.length < policy.minLength) return `Use at least ${policy.minLength} characters.`
  if (password.length > policy.maxLength) return `Use no more than ${policy.maxLength} characters.`
  if (password !== confirmation) return 'Passwords do not match.'
  return ''
}
