/** Preferences are optional: restricted browser storage must not block review. */
const fallback = new Map<string, string>()
function safe(kind: 'localStorage' | 'sessionStorage') {
  return {
    getItem(key: string) { try { return window[kind].getItem(key) ?? fallback.get(`${kind}:${key}`) ?? null } catch { return fallback.get(`${kind}:${key}`) ?? null } },
    setItem(key: string, value: string) { fallback.set(`${kind}:${key}`, value); try { window[kind].setItem(key, value); return true } catch { return false } },
    removeItem(key: string) { fallback.delete(`${kind}:${key}`); try { window[kind].removeItem(key) } catch { /* optional persistence */ } },
  }
}
export const localPreferences = safe('localStorage')
export const sessionPreferences = safe('sessionStorage')
