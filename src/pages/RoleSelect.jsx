import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const ROLES = [
  { label: 'Waiter', path: '/waiter', icon: '🍽️', colour: '#16a34a', desc: 'Take orders & manage tables' },
  { label: 'Bar', path: '/bar', icon: '🍺', colour: '#d97706', desc: 'Drinks queue & walk-up orders' },
  { label: 'Kitchen', path: '/kitchen', icon: '👨‍🍳', colour: '#dc2626', desc: 'Food ticket queue' },
  { label: 'Live Tables', path: '/tables', icon: '📋', colour: '#7c3aed', desc: 'Open tabs & payments' },
  { label: 'Bookings', path: '/bookings', icon: '📅', colour: '#0891b2', desc: 'Reservations management' },
  { label: 'Admin', path: '/admin', icon: '⚙️', colour: '#374151', desc: 'Settings & reports (PIN)' },
]

// PWA install prompt
function InstallBanner() {
  const [prompt, setPrompt] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show) return null

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    setShow(false)
  }

  return (
    <div className="mx-auto max-w-2xl w-full mb-4 bg-amber-900/30 border border-amber-700/40 rounded-2xl px-5 py-3 flex items-center justify-between gap-4">
      <div>
        <p className="font-barlow text-amber-200 text-sm font-semibold">Install TabFlow on your device</p>
        <p className="font-barlow text-amber-400/70 text-xs">Works offline · No App Store needed · Looks native</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={install} className="bg-amber-600 hover:bg-amber-700 text-white font-barlow text-sm px-4 py-2 rounded-xl transition-colors">Install</button>
        <button onClick={() => setShow(false)} className="text-amber-600 font-barlow text-sm px-2 py-2">✕</button>
      </div>
    </div>
  )
}

export default function RoleSelect() {
  const navigate = useNavigate()
  const { settings } = useApp()
  const wl = settings?.white_label
  const appName = wl?.enabled && wl.app_name ? wl.app_name : 'TabFlow'
  const primaryColour = wl?.enabled && wl.primary_colour ? wl.primary_colour : null

  // Apply white label colour
  useEffect(() => {
    if (primaryColour) document.documentElement.style.setProperty('--colour-primary', primaryColour)
    else document.documentElement.style.removeProperty('--colour-primary')
  }, [primaryColour])

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      <header className="p-6 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {wl?.enabled && wl.logo_url && (
            <img src={wl.logo_url} alt="Logo" className="w-10 h-10 rounded-xl object-cover" onError={e => { e.target.style.display = 'none' }} />
          )}
          <div>
            <h1 className="font-oswald text-3xl text-white tracking-wide">{appName}</h1>
            <p className="font-barlow text-zinc-400 text-base">{settings?.venue_name || 'POS System'}</p>
          </div>
        </div>
        <div className="text-right font-barlow text-zinc-500 text-sm">
          <Clock />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <h2 className="font-oswald text-2xl text-zinc-300 mb-4 tracking-wide">SELECT YOUR ROLE</h2>
        <InstallBanner />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-2xl">
          {ROLES.map(role => (
            <button
              key={role.path}
              onClick={() => navigate(role.path)}
              className="touch-btn rounded-2xl p-6 text-left shadow-lg active:scale-95 transition-all hover:brightness-110 flex flex-col gap-2"
              style={{ backgroundColor: role.colour }}
            >
              <span className="text-4xl">{role.icon}</span>
              <span className="font-oswald text-white text-2xl">{role.label}</span>
              <span className="font-barlow text-white/70 text-sm leading-tight">{role.desc}</span>
            </button>
          ))}
        </div>
        {/* Display & Group links for managers */}
        <div className="flex gap-4 mt-6">
          <button onClick={() => navigate('/display')} className="font-barlow text-zinc-600 hover:text-zinc-400 text-xs transition-colors">📺 TV Display</button>
          <button onClick={() => navigate('/group')} className="font-barlow text-zinc-600 hover:text-zinc-400 text-xs transition-colors">🏢 Group Dashboard</button>
        </div>
      </main>

      {!wl?.enabled && (
        <footer className="text-center pb-4">
          <p className="font-barlow text-zinc-800 text-xs">Powered by TabFlow POS · v3.0.0</p>
        </footer>
      )}
    </div>
  )
}

function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div>
      <div className="font-oswald text-white text-2xl">{time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
      <div className="text-zinc-500">{time.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
    </div>
  )
}
