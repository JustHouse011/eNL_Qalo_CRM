import { localPreferences } from './storage'

const passwordStorageKey = 'qalo-demo-password-hash'
const defaultDemoPassword = import.meta.env.DEV ? '12345678' : undefined
const iterations = 120_000

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

function fromHex(value: string) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) return null
  return Uint8Array.from(value.match(/.{2}/g) || [], byte => Number.parseInt(byte, 16))
}

async function derivePasswordHash(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const saltBuffer = new Uint8Array(salt.byteLength)
  saltBuffer.set(salt)
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBuffer.buffer, iterations, hash: 'SHA-256' }, key, 256)
  return toHex(new Uint8Array(bits))
}

export function hasStoredDemoPassword() {
  return localPreferences.getItem(passwordStorageKey) !== null
}

export async function matchesDemoPassword(password: string) {
  const saved = localPreferences.getItem(passwordStorageKey)
  if (!saved) return password === defaultDemoPassword

  try {
    const parsed: unknown = JSON.parse(saved)
    if (!parsed || typeof parsed !== 'object' || !('salt' in parsed) || !('hash' in parsed) || typeof parsed.salt !== 'string' || typeof parsed.hash !== 'string') return false
    const salt = fromHex(parsed.salt)
    if (!salt) return false
    return await derivePasswordHash(password, salt) === parsed.hash
  } catch {
    return false
  }
}

export async function verifyDemoCredentials(email: string, password: string) {
  if (!import.meta.env.DEV) return false
  return email.trim().toLowerCase() === 'bongani.nombamba@enlbank.co.za' && matchesDemoPassword(password)
}

export async function saveDemoPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivePasswordHash(password, salt)
  localPreferences.setItem(passwordStorageKey, JSON.stringify({ salt: toHex(salt), hash }))
}