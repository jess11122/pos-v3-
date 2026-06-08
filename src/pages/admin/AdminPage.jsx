import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { verifyPin, hashPin, isLockedOut, lockoutSecondsRemaining, recordFailedAttempt, clearRateLimit } from '../../lib/pin'
import MenuAdmin from './MenuAdmin'
import StaffAdmin from './StaffAdmin'
import TablesAdmin from './TablesAdmin'
import OrdersAdmin from './OrdersAdmin'
import MarketingAdmin from './MarketingAdmin'
import EndOfNight from './EndOfNight'
import SettingsAdmin from './SettingsAdmin'
import VenuesAdmin from './VenuesAdmin'
import GdprAdmin from './GdprAdmin'

const TABS = [
  { key: 'menu', label: '🍽 Menu' },
  { key: 'staff', label: '👥 Staff' },
  { key: 'tables', label: '🪑 Tables' },
  { key: 'orders', label: '📊 Orders' },
  { key: 'marketing', label: '📣 Marketing' },
  { key: 'eod', label: '🌙 End of Night' },
  { key: 'venues', label: '🏢 Venues' },
  { key: 'gdpr', label: '🔐 GDPR' },
  { key: 'settings', label: '⚙️ Settings' },
]

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000 // 8 hours
const SESSION_KEY = 'tabflow_admin_unlocked_at'

export default function AdminPage() {
  const navigate = useNavigate()
  const { settings } = useApp()
  const [unlocked, setUnlocked] = useState(() => {
    // Restore session if within 8-hour window
    try {
      const ts = parseInt(localStorage.getItem(SESSION_KEY) || '0', 10)
      return ts && Date.now() - ts < SESSION_TIMEOUT_MS
    } catch { return false }
  })
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [activeTab, setActiveTab] = useState('menu')
  const [lockoutSecs, setLockoutSecs] = useState(0)
  const lockoutTimer = useRef(null)
  const sessionTimer = useRef(null)

  // Lockout countdown tick
  useEffect(() => {
    if (!isLockedOut()) return
    const tick = () => {
      const secs = lockoutSecondsRemaining()
      setLockoutSecs(secs)
      if (secs <= 0) clearInterval(lockoutTimer.current)
    }
    tick()
    lockoutTimer.current = setInterval(tick, 1000)
    return () => clearInterval(lockoutTimer.current)
  }, [pinError])

  // Auto-lock after 8 hours of inactivity
  const resetSessionTimer = useCallback(() => {
    clearTimeout(sessionTimer.current)
    if (unlocked) {
      sessionTimer.current = setTimeout(() => {
        lock()
      }, SESSION_TIMEOUT_MS)
    }
  }, [unlocked])

  useEffect(() => {
    resetSessionTimer()
    return () => clearTimeout(sessionTimer.current)
  }, [resetSessionTimer])

  // Reset inactivity timer on any click
  useEffect(() => {
    if (!unlocked) return
    const reset = () => resetSessionTimer()
    window.addEventListener('click', reset)
    window.addEventListener('keydown', reset)
    return () => {
      window.removeEventListener('click', reset)
      window.removeEventListener('keydown', reset)
    }
  }, [unlocked, resetSessionTimer])

  const lock = () => {
    setUnlocked(false)
    setPin('')
    setPinError('')
    localStorage.removeItem(SESSION_KEY)
  }

  const handlePin = async () => {
    if (isLockedOut()) {
      setPinError(`Too many attempts. Try again in ${lockoutSecondsRemaining()}s`)
      return
    }
    if (!pin || verifying) return
    setVerifying(true)
    setPinError('')

    try {
      // Check hashed PIN first (new format), fall back to plaintext (legacy)
      const storedHash = settings?.admin_pin_hash
      const storedPlain = settings?.admin_pin || '1234'

      const ok = storedHash
        ? await verifyPin(pin, storedHash)
        : await verifyPin(pin, storedPlain)

      if (ok) {
        clearRateLimit()
        setUnlocked(true)
        setPin('')
        localStorage.setItem(SESSION_KEY, String(Date.now()))

        // Auto-migrate plaintext PIN to hash on successful login
        if (!storedHash && settings?.id) {
          const newHash = await hashPin(pin)
          await supabase.from('settings')
            .update({ admin_pin_hash: newHash })
            .eq('id', settings.id)
        }
      } else {
        const { attempts, locked } = recordFailedAttempt()
        if (locked) {
          setPinError(`Too many incorrect attempts. Locked for 60 seconds.`)
          setLockoutSecs(60)
        } else {
          setPinError(`Incorrect PIN (${attempts}/${5} attempts)`)
        }
        setPin('')
      }
    } catch {
      setPinError('Verification error — try again')
      setPin('')
    } finally {
      setVerifying(false)
    }
  }

  const locked = isLockedOut()

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-6">
        <div className="bg-zinc-800 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="font-oswald text-3xl text-white mb-2">Admin Panel</h1>
          <p className="font-barlow text-zinc-400 mb-6">Enter your PIN to continue</p>

          {locked ? (
            <div className="bg-red-900/30 border border-red-800 rounded-2xl p-6 mb-4">
              <p className="font-oswald text-red-400 text-2xl">{lockoutSecs}s</p>
              <p className="font-barlow text-red-400 text-sm mt-1">Too many attempts — locked out</p>
            </div>
          ) : (
            <>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setPinError('') }}
                onKeyDown={e => e.key === 'Enter' && handlePin()}
                autoFocus
                disabled={verifying}
                className={`w-full bg-zinc-700 text-white font-oswald text-3xl tracking-[1rem] text-center rounded-xl px-4 py-4 outline-none mb-4 disabled:opacity-50 ${pinError ? 'ring-2 ring-red-500' : 'focus:ring-2 focus:ring-amber-600'}`}
              />
              {pinError && <p className="text-red-400 font-barlow text-sm mb-4">{pinError}</p>}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[1,2,3,4,5,6,7,8,9,'','0','⌫'].map((k, i) => (
                  <button
                    key={i}
                    disabled={verifying}
                    onClick={() => {
                      if (k === '⌫') setPin(p => p.slice(0, -1))
                      else if (k !== '') setPin(p => p.length < 8 ? p + String(k) : p)
                    }}
                    className="py-4 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white font-oswald text-xl rounded-xl transition-colors active:scale-95"
                  >
                    {k}
                  </button>
                ))}
              </div>
              <button
                onClick={handlePin}
                disabled={verifying || !pin}
                className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald text-xl py-4 rounded-xl transition-colors"
              >
                {verifying ? 'Verifying…' : 'Unlock'}
              </button>
            </>
          )}
          <button onClick={() => navigate('/')} className="w-full mt-3 text-zinc-500 font-barlow py-2 hover:text-white transition-colors">← Back to Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      <header className="bg-zinc-900 px-5 py-4 flex items-center justify-between border-b border-zinc-800">
        <div>
          <h1 className="font-oswald text-2xl text-white">⚙️ Admin Panel</h1>
          <p className="font-barlow text-zinc-400 text-sm">{settings?.venue_name}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={lock} className="font-barlow text-zinc-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors">🔒 Lock</button>
          <button onClick={() => navigate('/')} className="font-barlow text-zinc-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors">← Home</button>
        </div>
      </header>

      <div className="flex overflow-x-auto bg-zinc-900 border-b border-zinc-800 px-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-shrink-0 px-4 py-3 font-barlow text-sm transition-colors whitespace-nowrap ${activeTab === t.key ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-400 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'menu' && <MenuAdmin />}
        {activeTab === 'staff' && <StaffAdmin />}
        {activeTab === 'tables' && <TablesAdmin />}
        {activeTab === 'orders' && <OrdersAdmin />}
        {activeTab === 'marketing' && <MarketingAdmin />}
        {activeTab === 'eod' && <EndOfNight />}
        {activeTab === 'venues' && <VenuesAdmin />}
        {activeTab === 'gdpr' && <GdprAdmin />}
        {activeTab === 'settings' && <SettingsAdmin />}
      </div>
    </div>
  )
}
