import { useState, useEffect } from 'react'
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

export default function RoleSelect() {
  const navigate = useNavigate()
  const { settings } = useApp()

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      <header className="p-6 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="font-oswald text-3xl text-white tracking-wide">TabFlow</h1>
          <p className="font-barlow text-zinc-400 text-base">{settings?.venue_name || 'POS System'}</p>
        </div>
        <div className="text-right font-barlow text-zinc-500 text-sm">
          <Clock />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <h2 className="font-oswald text-2xl text-zinc-300 mb-8 tracking-wide">SELECT YOUR ROLE</h2>
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
      </main>
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

