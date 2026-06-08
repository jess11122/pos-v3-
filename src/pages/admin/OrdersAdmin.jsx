import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Spinner from '../../components/ui/Spinner'
import { format, startOfWeek, endOfWeek } from 'date-fns'

const PAGE_SIZE = 50

export default function OrdersAdmin() {
  const [period, setPeriod] = useState('today')
  const [orders, setOrders] = useState([])
  const [allPeriodOrders, setAllPeriodOrders] = useState([])
  const [tips, setTips] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [expanded, setExpanded] = useState(null)
  const [voids, setVoids] = useState([])

  const today = format(new Date(), 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const load = useCallback(async () => {
    setLoading(true)
    const from = period === 'today' ? today : weekStart
    const to = period === 'today' ? today : weekEnd

    const [ordersRes, tipsRes, countRes, chartRes, voidsRes] = await Promise.all([
      supabase.from('orders')
        .select('*')
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', to + 'T23:59:59')
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
      supabase.from('tips')
        .select('*')
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', to + 'T23:59:59'),
      supabase.from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', to + 'T23:59:59')
        .eq('status', 'complete'),
      // All orders for chart (no pagination)
      supabase.from('orders')
        .select('created_at,total')
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', to + 'T23:59:59')
        .eq('status', 'complete')
        .limit(5000),
      supabase.from('voids')
        .select('*')
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', to + 'T23:59:59')
        .limit(200),
    ])

    setOrders(ordersRes.data || [])
    setAllPeriodOrders(chartRes.data || [])
    setTips(tipsRes.data || [])
    setTotal(countRes.count || 0)
    setVoids(voidsRes.data || [])
    setLoading(false)
  }, [period, page, today, weekStart, weekEnd])

  useEffect(() => { setPage(0) }, [period])
  useEffect(() => { load() }, [load])

  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0)
  const tipsTotal = tips.reduce((s, t) => s + (t.amount || 0), 0)
  const voidsTotal = voids.reduce((s, v) => s + (v.amount || 0), 0)

  const byTable = orders.reduce((acc, o) => {
    const k = o.table_number
    if (!acc[k]) acc[k] = { tableNumber: k, orders: [], total: 0 }
    acc[k].orders.push(o)
    acc[k].total += o.total || 0
    return acc
  }, {})

  const pages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5">
      <div className="flex gap-2">
        {[['today', 'Today'], ['week', 'This Week']].map(([key, label]) => (
          <button key={key} onClick={() => setPeriod(key)} className={`px-4 py-2 rounded-xl font-barlow text-sm transition-colors ${period === key ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>{label}</button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Revenue" value={`£${revenue.toFixed(2)}`} colour="text-amber-500" />
        <SummaryCard label="Tips" value={`£${tipsTotal.toFixed(2)}`} colour="text-green-400" />
        <SummaryCard label="Combined" value={`£${(revenue + tipsTotal).toFixed(2)}`} colour="text-white" />
        <SummaryCard label="Voids" value={`−£${voidsTotal.toFixed(2)}`} colour="text-red-400" />
      </div>

      {/* Revenue Chart */}
      <RevenueChart orders={allPeriodOrders} period={period} today={today} weekStart={weekStart} />

      {/* Staff tips leaderboard */}
      {tips.length > 0 && <StaffTipsLeaderboard tips={tips} />}

      {/* Voids list */}
      {voids.length > 0 && <VoidsList voids={voids} />}

      {/* Per-table breakdown */}
      <div className="bg-zinc-800 rounded-2xl p-4">
        <h3 className="font-oswald text-white text-lg mb-3">Per-Table Breakdown</h3>
        <div className="space-y-2">
          {Object.values(byTable).sort((a, b) => b.total - a.total).map(t => (
            <div key={t.tableNumber} className="bg-zinc-700 rounded-xl">
              <button
                onClick={() => setExpanded(expanded === t.tableNumber ? null : t.tableNumber)}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <span className="font-barlow text-white text-base">Table {t.tableNumber} · {t.orders.length} order{t.orders.length !== 1 ? 's' : ''}</span>
                <span className="font-oswald text-amber-500">£{t.total.toFixed(2)}</span>
              </button>
              {expanded === t.tableNumber && (
                <div className="px-4 pb-3 space-y-2 border-t border-zinc-600">
                  {t.orders.map(o => (
                    <div key={o.id} className="text-sm">
                      <div className="flex justify-between font-barlow text-zinc-300 pt-2">
                        <span>{format(new Date(o.created_at), 'HH:mm')} · {o.staff_name} · {o.payment_method}</span>
                        <span>£{o.total?.toFixed(2)}</span>
                      </div>
                      {(o.items || []).map((item, i) => (
                        <div key={i} className="font-barlow text-zinc-500 text-xs ml-3">{item.qty}× {item.name}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Full order list */}
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <div className="bg-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-oswald text-white text-lg">Order History ({total} orders)</h3>
          </div>
          <div className="space-y-2">
            {orders.map(o => (
              <div key={o.id} className="flex items-center justify-between bg-zinc-700 rounded-xl px-4 py-3">
                <div>
                  <span className="font-barlow text-white text-sm">
                    {format(new Date(o.created_at), 'HH:mm')} · Table {o.table_number} · {o.staff_name}
                  </span>
                  <p className="font-barlow text-zinc-500 text-xs">{o.payment_method} · {(o.items || []).length} item{(o.items || []).length !== 1 ? 's' : ''}</p>
                </div>
                <span className="font-oswald text-amber-500">£{o.total?.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 bg-zinc-700 text-zinc-300 rounded-lg disabled:opacity-30 font-barlow text-sm">← Prev</button>
              <span className="font-barlow text-zinc-400 text-sm py-1.5">{page + 1} / {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} className="px-3 py-1.5 bg-zinc-700 text-zinc-300 rounded-lg disabled:opacity-30 font-barlow text-sm">Next →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RevenueChart({ orders, period, today, weekStart }) {
  if (orders.length === 0) return null

  const isToday = period === 'today'

  // Build buckets: hourly for today (7am–2am = 19 slots), daily Mon–Sun for week
  let buckets = []
  if (isToday) {
    for (let h = 7; h <= 24; h++) {
      buckets.push({ label: h === 24 ? '00' : `${h}`, value: 0 })
    }
    for (const o of orders) {
      const h = new Date(o.created_at).getHours()
      const idx = h < 7 ? buckets.length - 1 : h - 7
      if (idx >= 0 && idx < buckets.length) buckets[idx].value += o.total || 0
    }
  } else {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    buckets = days.map(d => ({ label: d, value: 0 }))
    for (const o of orders) {
      const dow = (new Date(o.created_at).getDay() + 6) % 7 // Mon=0
      buckets[dow].value += o.total || 0
    }
  }

  const maxVal = Math.max(...buckets.map(b => b.value), 1)

  return (
    <div className="bg-zinc-800 rounded-2xl p-4">
      <h3 className="font-oswald text-white text-lg mb-4">{isToday ? 'Revenue by Hour' : 'Revenue by Day'}</h3>
      <div className="flex items-end gap-1 h-32">
        {buckets.map((b, i) => {
          const heightPct = (b.value / maxVal) * 100
          const isActive = b.value > 0
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t-sm transition-all bg-amber-600/70 group-hover:bg-amber-500"
                  style={{ height: `${Math.max(heightPct, isActive ? 4 : 0)}%` }}
                />
              </div>
              {/* Tooltip on hover */}
              {isActive && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-zinc-700 text-white font-barlow text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity">
                  £{b.value.toFixed(0)}
                </div>
              )}
              <span className="font-barlow text-zinc-500 text-xs leading-none">{b.label}</span>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-2 font-barlow text-zinc-500 text-xs">
        <span>£0</span>
        <span>Peak: £{maxVal.toFixed(0)}</span>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, colour }) {
  return (
    <div className="bg-zinc-800 rounded-2xl p-4 text-center">
      <p className="font-barlow text-zinc-400 text-sm mb-1">{label}</p>
      <p className={`font-oswald text-2xl ${colour}`}>{value}</p>
    </div>
  )
}

function StaffTipsLeaderboard({ tips }) {
  const byStaff = tips.reduce((acc, t) => {
    if (!acc[t.staff_name]) acc[t.staff_name] = 0
    acc[t.staff_name] += t.amount || 0
    return acc
  }, {})
  const sorted = Object.entries(byStaff).sort(([,a], [,b]) => b - a)

  return (
    <div className="bg-zinc-800 rounded-2xl p-4">
      <h3 className="font-oswald text-white text-lg mb-3">Staff Tips Leaderboard</h3>
      <div className="space-y-2">
        {sorted.map(([name, amount], i) => (
          <div key={name} className="flex items-center gap-3">
            <span className="font-oswald text-zinc-500 w-6">{i + 1}</span>
            <div className="flex-1 bg-zinc-700 rounded-lg h-8 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-amber-600/40 rounded-lg" style={{ width: `${(amount / sorted[0][1]) * 100}%` }} />
              <span className="absolute inset-0 flex items-center px-3 font-barlow text-white text-sm">{name}</span>
            </div>
            <span className="font-oswald text-amber-500 w-16 text-right">£{amount.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VoidsList({ voids }) {
  return (
    <div className="bg-zinc-800 rounded-2xl p-4">
      <h3 className="font-oswald text-white text-lg mb-3">Void Log ({voids.length})</h3>
      <div className="space-y-2">
        {voids.map(v => (
          <div key={v.id} className="flex items-center justify-between bg-zinc-700 rounded-xl px-4 py-2">
            <div>
              <span className="font-barlow text-white text-sm">{v.quantity}× {v.item_name}</span>
              <p className="font-barlow text-zinc-500 text-xs">{v.reason} · {v.voided_by} · {format(new Date(v.created_at), 'HH:mm')}</p>
            </div>
            <span className="font-oswald text-red-400">−£{v.amount?.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
