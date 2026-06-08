import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import MenuAdmin from './MenuAdmin'
import StaffAdmin from './StaffAdmin'
import TablesAdmin from './TablesAdmin'
import OrdersAdmin from './OrdersAdmin'
import MarketingAdmin from './MarketingAdmin'
import EndOfNight from './EndOfNight'
import SettingsAdmin from './SettingsAdmin'
import VenuesAdmin from './VenuesAdmin'

const TABS = [
  { key: 'menu', label: '🍽 Menu' },
  { key: 'staff', label: '👥 Staff' },
  { key: 'tables', label: '🪑 Tables' },
  { key: 'orders', label: '📊 Orders' },
  { key: 'marketing', label: '📣 Marketing' },
  { key: 'eod', label: '🌙 End of Night' },
  { key: 'venues', label: '🏢 Venues' },
  { key: 'settings', label: '⚙️ Settings' },
]

export default function AdminPage() {
  const navigate = useNavigate()
  const { settings } = useApp()
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [activeTab, setActiveTab] = useState('menu')

  const handlePin = () => {
    const correctPin = settings?.admin_pin || '1234'
    if (pin === correctPin) {
      setUnlocked(true)
      setPinError(false)
    } else {
      setPinError(true)
      setPin('')
    }
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-6">
        <div className="bg-zinc-800 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="font-oswald text-3xl text-white mb-2">Admin Panel</h1>
          <p className="font-barlow text-zinc-400 mb-6">Enter your PIN to continue</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setPinError(false) }}
            onKeyDown={e => e.key === 'Enter' && handlePin()}
            autoFocus
            className={`w-full bg-zinc-700 text-white font-oswald text-3xl tracking-[1rem] text-center rounded-xl px-4 py-4 outline-none mb-4 ${pinError ? 'ring-2 ring-red-500' : 'focus:ring-2 focus:ring-amber-600'}`}
          />
          {pinError && <p className="text-red-400 font-barlow mb-4">Incorrect PIN</p>}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[1,2,3,4,5,6,7,8,9,'','0','⌫'].map((k, i) => (
              <button
                key={i}
                onClick={() => {
                  if (k === '⌫') setPin(p => p.slice(0, -1))
                  else if (k !== '') setPin(p => p.length < 8 ? p + k : p)
                }}
                className="py-4 bg-zinc-700 hover:bg-zinc-600 text-white font-oswald text-xl rounded-xl transition-colors active:scale-95"
              >
                {k}
              </button>
            ))}
          </div>
          <button onClick={handlePin} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-oswald text-xl py-4 rounded-xl transition-colors">
            Unlock
          </button>
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
          <button onClick={() => setUnlocked(false)} className="font-barlow text-zinc-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors">🔒 Lock</button>
          <button onClick={() => navigate('/')} className="font-barlow text-zinc-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors">← Home</button>
        </div>
      </header>

      {/* Tab navigation */}
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
        {activeTab === 'settings' && <SettingsAdmin />}
      </div>
    </div>
  )
}
