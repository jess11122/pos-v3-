// PBKDF2 PIN hashing using Web Crypto API (built into all modern browsers)
// 100,000 iterations with SHA-256 — resistant to brute force even for short PINs
// Format stored: "pbkdf2:<saltHex>:<hashHex>"

const ITERATIONS = 100_000
const HASH = 'SHA-256'

export async function hashPin(pin) {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(String(pin)), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH },
    keyMaterial, 256
  )
  const toHex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2:${toHex(salt.buffer)}:${toHex(bits)}`
}

export async function verifyPin(input, stored) {
  if (!stored) return false

  // Legacy plaintext fallback — migrate on successful login
  if (!stored.startsWith('pbkdf2:')) {
    return String(input) === String(stored)
  }

  const parts = stored.split(':')
  if (parts.length !== 3) return false
  const [, saltHex, expectedHex] = parts

  try {
    const encoder = new TextEncoder()
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)))
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(String(input)), 'PBKDF2', false, ['deriveBits']
    )
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH },
      keyMaterial, 256
    )
    const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
    // Constant-time comparison to prevent timing attacks
    return timingSafeEqual(hashHex, expectedHex)
  } catch {
    return false
  }
}

// Constant-time string comparison — prevents timing side-channel
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// ─── Rate limiting (localStorage-backed, resets on server restart) ────────
const RL_KEY = 'tabflow_pin_rl'
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 60_000 // 60 seconds

export function getRateLimit() {
  try {
    const raw = localStorage.getItem(RL_KEY)
    return raw ? JSON.parse(raw) : { attempts: 0, lockedUntil: null }
  } catch {
    return { attempts: 0, lockedUntil: null }
  }
}

export function isLockedOut() {
  const { lockedUntil } = getRateLimit()
  if (!lockedUntil) return false
  if (Date.now() < lockedUntil) return true
  // Lock expired — clear it
  clearRateLimit()
  return false
}

export function lockoutSecondsRemaining() {
  const { lockedUntil } = getRateLimit()
  if (!lockedUntil) return 0
  return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
}

export function recordFailedAttempt() {
  const { attempts } = getRateLimit()
  const newAttempts = attempts + 1
  const lockedUntil = newAttempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null
  localStorage.setItem(RL_KEY, JSON.stringify({ attempts: newAttempts, lockedUntil }))
  return { attempts: newAttempts, lockedUntil, locked: !!lockedUntil }
}

export function clearRateLimit() {
  localStorage.removeItem(RL_KEY)
}
