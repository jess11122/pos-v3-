import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { subDays, format } from 'date-fns'
import { SkeletonTable } from '../../components/ui/Skeleton'

function fmt(n) { return `£${(n || 0).toFixed(2)}` }

const PERIODS = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
]

function heatColour(rank, total) {
  const pct = 1 - rank / total
  if (pct >= 0.66) return { dot: 'bg-green-500', badge: 'bg-green-900/40 text-green-400', label: 'Top seller' }
  if (pct >= 0.33) return { dot: 'bg-amber-500', badge: 'bg-amber-900/40 text-amber-400', label: 'Average' }
  return { dot: 'bg-red-500', badge: 'bg-red-900/40 text-red-400', label: 'Slow mover' }
}

export default function HeatmapAdmin() {
  const { settings, refreshSettings } = useApp()
  const [period, setPeriod] = useState(7)
  const [category, setCategory] = useState('all')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [healthScore, setHealthScore] = useState(null)

  const menuItems = settings?.menu_items || []
  const categories = ['all', ...new Set(menuItems.map(i => i.category || i.type).filter(Boolean))]

  const load = useCallback(async () => {
    setLoading(true)
    const from = period === 0
      ? new Date().toISOString().split('T')[0] + 'T00:00:00'
      : subDays(new Date(), period).toISOString()

    const { data: orders } = await supabase
      .from('orders')
      .select('items,total')
      .gte('created_at', from)
      .eq('status', 'complete')

    const countMap = {}
    const revenueMap = {}
    for (const order of orders || []) {
      for (const item of order.items || []) {
        countMap[item.name] = (countMap[item.name] || 0) + (item.qty || 1)
        revenueMap[item.name] = (revenueMap[item.name] || 0) + (item.price || 0) * (item.qty || 1)
      }
    }

    const enriched = menuItems
      .filter(m => m.active !== false)
      .filter(m => category === 'all' || m.category === category || m.type === category)
      .map(m => ({
        ...m,
        ordersCount: countMap[m.name] || 0,
        revenue: revenueMap[m.name] || 0,
      }))
      .sort((a, b) => b.ordersCount - a.ordersCount)

    setItems(enriched)

    // Health score: % of items with ordersCount > 0
    const withSales = enriched.filter(i => i.ordersCount > 0).length
    setHealthScore(enriched.length > 0 ? Math.round((withSales / enriched.length) * 100) : null)

    setLoading(false)
  }, [period, category, menuItems])

  useEffect(() => { load() }, [load])

  const quickHide = async (id) => {
    const updated = (settings?.menu_items || []).map(i => i.id === id ? { ...i, active: false } : i)
    await supabase.from('settings').update({ menu_items: updated }).eq('id', settings.id)
    await refreshSettings()
  }

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5">
      <div className="bg-zinc-800 rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-oswald text-white text-xl">Menu Performance Heatmap</h2>
            <p className="font-barlow text-zinc-400 text-sm mt-1">See what's selling — no spreadsheets needed</p>
          </div>
          {healthScore !== null && (
            <div className="text-center">
              <div className={`font-oswald text-2xl ${healthScore >= 70 ? 'text-green-400' : healthScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{healthScore}%</div>
              <div className="font-barlow text-zinc-500 text-xs">Menu health</div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex bg-zinc-800 rounded-xl p-1 gap-1">
          {PERIODS.map(p => (
            <button
              key={p.days}
              onClick={() => setPeriod(p.days)}
              className={`px-3 py-1.5 rounded-lg font-barlow text-sm transition-colors ${period === p.days ? 'bg-amber-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="input-field text-sm px-3 py-2"
        >
          {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
        </select>
      </div>

      {/* Legend */}
      <div className="flex gap-4 font-barlow text-xs text-zinc-500">
        {[{ colour: 'bg-green-500', label: 'Top seller (top 33%)' }, { colour: 'bg-amber-500', label: 'Average' }, { colour: 'bg-red-500', label: 'Slow mover (bottom 33%)' }].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${l.colour}`} />
            {l.label}
          </div>
        ))}
      </div>

      {loading ? (
        <SkeletonTable rows={8} />
      ) : items.length === 0 ? (
        <div className="bg-zinc-800 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="font-oswald text-zinc-400 text-lg">No data yet</p>
          <p className="font-barlow text-zinc-600 text-sm mt-1">Complete some orders to see performance data</p>
        </div>
      ) : (
        <div className="bg-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-900/50 border-b border-zinc-700">
              <tr>
                {['Item', 'Category', 'Orders', 'Revenue', 'Avg Price', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-barlow text-zinc-500 text-xs uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700/50">
              {items.map((item, rank) => {
                const colour = heatColour(rank, items.length)
                return (
                  <tr key={item.id} className="hover:bg-zinc-700/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colour.dot}`} />
                        <span className="font-barlow text-white text-sm">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-barlow text-zinc-500 text-xs capitalize">{item.category || item.type || '—'}</td>
                    <td className="px-4 py-3 font-oswald text-white text-lg">{item.ordersCount}</td>
                    <td className="px-4 py-3 font-oswald text-amber-400">{fmt(item.revenue)}</td>
                    <td className="px-4 py-3 font-barlow text-zinc-400 text-sm">{fmt(item.price)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-barlow text-xs px-2 py-1 rounded-full ${colour.badge}`}>{colour.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {colour.label === 'Slow mover' && item.ordersCount === 0 && (
                        <button
                          onClick={() => quickHide(item.id)}
                          className="font-barlow text-xs px-3 py-1.5 bg-zinc-700 hover:bg-red-900/40 text-zinc-400 hover:text-red-400 rounded-lg transition-colors"
                        >
                          86 It
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-4">
          <p className="font-barlow text-zinc-500 text-xs">
            <strong className="text-zinc-400">Menu Health Score: {healthScore}%</strong> —{' '}
            {healthScore >= 70 ? 'Great balance. Most items are selling.' :
             healthScore >= 40 ? 'Some items need attention. Consider removing zero-sellers or running a promotion.' :
             'Many items have no sales. Reduce menu size to improve kitchen focus and stock efficiency.'}
          </p>
        </div>
      )}
    </div>
  )
}
