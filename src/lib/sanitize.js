import { ALLERGENS } from './constants'

// Strip any HTML tags and trim — prevents XSS via database-sourced strings
// React already escapes JSX interpolations, but this defends data passed to
// non-JSX contexts (e.g. printTicket, SMS body, email templates)
export function sanitizeText(value, maxLength = 500) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/<[^>]*>/g, '')   // strip HTML tags
    .replace(/[^\S\n]+/g, ' ') // collapse whitespace
    .trim()
    .slice(0, maxLength)
}

// Validate a name field (no angle brackets, reasonable length)
export function sanitizeName(value, max = 100) {
  return sanitizeText(value, max).replace(/[<>]/g, '')
}

// Validate phone — digits, spaces, +, (, ) only
export function sanitizePhone(value) {
  if (!value) return ''
  return value.replace(/[^\d\s\+\(\)\-]/g, '').trim().slice(0, 20)
}

// Validate email format
export function isValidEmail(value) {
  if (!value) return true // optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

// Allergens must only contain known values from the 14 EU mandatory allergens
export function sanitizeAllergens(arr) {
  if (!Array.isArray(arr)) return []
  return arr.filter(a => ALLERGENS.includes(a))
}

// Price must be a positive number with at most 2 decimal places
export function sanitizePrice(value) {
  const n = parseFloat(value)
  if (isNaN(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

// Party size must be between 1 and 100
export function sanitizePartySize(value) {
  const n = parseInt(value, 10)
  if (isNaN(n)) return 1
  return Math.max(1, Math.min(100, n))
}

// Quantity must be a positive integer
export function sanitizeQuantity(value, max = 999) {
  const n = parseInt(value, 10)
  if (isNaN(n)) return 1
  return Math.max(1, Math.min(max, n))
}

// Validate order items against known menu — rejects items not in the menu
// Returns { valid: bool, items: filtered array, unknownNames: string[] }
export function validateOrderItems(cartItems, menuItems) {
  const menuIds = new Set(menuItems.map(i => i.id))
  const valid = []
  const unknown = []
  for (const item of cartItems) {
    if (menuIds.has(item.id)) {
      valid.push(item)
    } else {
      unknown.push(item.name || String(item.id))
    }
  }
  return { valid, unknown, ok: unknown.length === 0 }
}

// Generic form error collector
export function collectErrors(rules) {
  // rules: [{ condition: bool, message: string }]
  return rules.filter(r => r.condition).map(r => r.message)
}
