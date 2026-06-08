import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

const QUOTES = [
  "The secret of getting ahead is getting started.",
  "Success is not the key to happiness. Happiness is the key to success.",
  "Great service is the difference between a good night and a legendary one.",
  "Every table is an opportunity to make someone's evening perfect.",
  "The best teams communicate without being asked.",
  "Attitude is a small thing that makes a big difference.",
  "Excellence is not a skill, it's an attitude.",
  "Teamwork makes the dream work.",
  "Go the extra mile — it's never crowded.",
  "A smooth sea never made a skilled sailor.",
]

function useWeather(lat = 51.5074, lon = -0.1278) {
  const [weather, setWeather] = useState(null)
  useEffect(() => {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&timezone=Europe/London`)
      .then(r => r.json())
      .then(d => setWeather(d.current))
      .catch(() => {})
  }, [lat, lon])
  return weather
}

function weatherIcon(code) {
  if (code == null) return '🌡'
  if (code === 0) return '☀️'
  if (code <= 3) return '🌤'
  if (code <= 49) return '🌫'
  if (code <= 67) return '🌧'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌦'
  return '⛈'
}

function fmt(n) { return `£${(n || 0).toFixed(2)}` }

function useClosingCountdown(closingTime) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!closingTime) return
    const calc = () => {
      const now = new Date()
      const [h, m] = closingTime.split(':').map(Number)
      const close = new Date(now)
      close.setHours(h, m, 0, 0)
      if (close <= now) close.setDate(close.getDate() + 1)
      setSecs(Math.max(0, Math.floor((close - now) / 1000)))
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [closingTime])
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export default function DisplayPage() {
  const { settings } = useApp()
  const [data, setData] = useState({ revenue: 0, completed: 0, pending: 0, tables: {}, staffOrders: {}, staffTips: {}, tipsTotal: 0 })
  const weather = useWeather()
  const countdown = useClosingCountdown(settings?.closing_time)
  const [quote] = useState(() => QUOTES[Math.floor(Date.now() / 3600000) % QUOTES.length])
  const [clock, setClock] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const load = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const [ordersRes, tipsRes] = await Promise.all([
      supabase.from('orders').select('table_number,total,status,staff_name,voided_amount').gte('created_at', today + 'T00:00:00'),
      supabase.from('tips').select('amount,staff_name').gte('created_at', today + 'T00:00:00'),
    ])
    const orders = ordersRes.data || []
    const tips = tipsRes.data || []

    const revenue = orders.filter(o => o.status === 'complete').reduce((s, o) => s + (o.total || 0), 0)
    const completed = orders.filter(o => o.status === 'complete').length
    const pending = orders.filter(o => o.status === 'pending').length
    const tipsTotal = tips.reduce((s, t) => s + (t.amount || 0), 0)

    const tables = {}
    const staffOrders = {}
    const staffTips = {}
    for (const o of orders) {
      if (o.status === 'pending') {
        tables[o.table_number] = (tables[o.table_number] || 0) + (o.total || 0)
      }
      if (o.staff_name) staffOrders[o.staff_name] = (staffOrders[o.staff_name] || 0) + 1
    }
    for (const t of tips) {
      if (t.staff_name) staffTips[t.staff_name] = (staffTips[t.staff_name] || 0) + (t.amount || 0)
    }
    setData({ revenue, completed, pending, tables, staffOrders, staffTips, tipsTotal })
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [load])

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('display-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tips' }, load)
      .subscribe()
    return () => ch.unsubscribe()
  }, [load])

  const busiestTable = Object.entries(data.tables).sort(([,a],[,b]) => b-a)[0]
  const topStaffOrders = Object.entries(data.staffOrders).sort(([,a],[,b]) => b-a).slice(0,5)
  const topStaffTips = Object.entries(data.staffTips).sort(([,a],[,b]) => b-a).slice(0,5)

  const MEDALS = ['🥇','🥈','🥉','4️⃣','5️⃣']

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden" style={{ fontFamily: "'Oswald', sans-serif" }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <div className="text-amber-500 text-2xl font-bold tracking-widest">TABFLOW</div>
          <div className="text-zinc-600 text-sm">|</div>
          <div className="text-zinc-300 text-lg tracking-wider">{settings?.venue_name || 'Live Dashboard'}</div>
        </div>
        <div className="flex items-center gap-6 text-zinc-400 text-sm tracking-wider">
          {weather && (
            <span>{weatherIcon(weather.weathercode)} {Math.round(weather.temperature_2m)}°C</span>
          )}
          <span className="text-white text-xl font-mono">
            {clock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Main grid */}
      <div className="p-6 grid grid-cols-12 gap-4 h-[calc(100vh-80px)]">

        {/* Revenue — hero stat */}
        <div className="col-span-4 bg-gradient-to-br from-amber-900/40 to-amber-600/10 border border-amber-700/40 rounded-2xl flex flex-col items-center justify-center p-8">
          <div className="text-zinc-400 text-sm tracking-[0.3em] uppercase mb-2">Revenue Today</div>
          <div className="text-7xl font-bold text-amber-400 tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmt(data.revenue)}
          </div>
          <div className="mt-4 text-zinc-400 text-sm">Tips: <span className="text-green-400 font-bold">{fmt(data.tipsTotal)}</span></div>
          <div className="mt-1 text-zinc-400 text-sm">Combined: <span className="text-white font-bold">{fmt(data.revenue + data.tipsTotal)}</span></div>
        </div>

        {/* Orders stats */}
        <div className="col-span-2 flex flex-col gap-4">
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center p-4">
            <div className="text-zinc-500 text-xs tracking-widest uppercase mb-1">Completed</div>
            <div className="text-5xl font-bold text-green-400">{data.completed}</div>
            <div className="text-zinc-600 text-xs mt-1">orders</div>
          </div>
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center p-4">
            <div className="text-zinc-500 text-xs tracking-widest uppercase mb-1">Open Tabs</div>
            <div className={`text-5xl font-bold ${data.pending > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>{data.pending}</div>
            <div className="text-zinc-600 text-xs mt-1">tables</div>
          </div>
        </div>

        {/* Busiest table + countdown */}
        <div className="col-span-3 flex flex-col gap-4">
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-center">
            <div className="text-zinc-500 text-xs tracking-widest uppercase mb-2">Busiest Table</div>
            {busiestTable ? (
              <>
                <div className="text-5xl font-bold text-white">T{busiestTable[0]}</div>
                <div className="text-amber-400 text-xl mt-1">{fmt(busiestTable[1])}</div>
              </>
            ) : (
              <div className="text-zinc-600 text-2xl">No open tabs</div>
            )}
          </div>
          {settings?.closing_time && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center justify-center">
              <div className="text-zinc-500 text-xs tracking-widest uppercase mb-2">Closing In</div>
              <div className="text-3xl font-mono text-red-400">{countdown}</div>
            </div>
          )}
        </div>

        {/* Staff leaderboards */}
        <div className="col-span-3 flex flex-col gap-4">
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="text-zinc-500 text-xs tracking-widest uppercase mb-3">Orders Leaderboard</div>
            <div className="space-y-2">
              {topStaffOrders.length === 0 && <div className="text-zinc-700 text-sm">No orders yet</div>}
              {topStaffOrders.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-lg w-6">{MEDALS[i]}</span>
                  <span className="flex-1 text-zinc-200 text-sm truncate">{name}</span>
                  <span className="text-amber-400 font-bold text-sm">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="text-zinc-500 text-xs tracking-widest uppercase mb-3">Tips Leaderboard</div>
            <div className="space-y-2">
              {topStaffTips.length === 0 && <div className="text-zinc-700 text-sm">No tips yet</div>}
              {topStaffTips.map(([name, amount], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-lg w-6">{MEDALS[i]}</span>
                  <span className="flex-1 text-zinc-200 text-sm truncate">{name}</span>
                  <span className="text-green-400 font-bold text-sm">{fmt(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quote footer — full width */}
        <div className="col-span-12 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-center justify-center py-4 px-8">
          <p className="text-zinc-400 text-center text-lg tracking-wide italic">"{quote}"</p>
        </div>
      </div>
    </div>
  )
}
