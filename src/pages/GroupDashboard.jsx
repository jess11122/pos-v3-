import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Skeleton } from '../components/ui/Skeleton'

function fmt(n) { return `£${(n || 0).toFixed(2)}` }

export default function GroupDashboard() {
  const navigate = useNavigate()
  const [venues, setVenues] = useState([])
  const [venueData, setVenueData] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: venueList } = await supabase.from('venues').select('*').order('created_at')
    if (!venueList?.length) { setLoading(false); return }
    setVenues(venueList)

    const today = new Date().toISOString().split('T')[0]
    const results = await Promise.all(venueList.map(async v => {
      const [ordersRes, staffRes, settingsRes] = await Promise.all([
        supabase.from('orders').select('total,status,allergens,voided_amount').eq('venue_id', v.id).gte('created_at', today + 'T00:00:00'),
        supabase.from('staff').select('id').eq('venue_id', v.id).eq('active', true),
        supabase.from('settings').select('venue_name').eq('venue_id', v.id).maybeSingle(),
      ])
      const orders = ordersRes.data || []
      const revenue = orders.filter(o => o.status === 'complete').reduce((s, o) => s + (o.total || 0), 0)
      const pending = orders.filter(o => o.status === 'pending').length
      const completed = orders.filter(o => o.status === 'complete').length
      const allergenAlerts = orders.filter(o => o.allergens?.length > 0).length
      return {
        id: v.id,
        name: settingsRes.data?.venue_name || v.name,
        revenue, pending, completed,
        staffCount: staffRes.data?.length || 0,
        allergenAlerts,
      }
    }))

    const map = {}
    for (const r of results) map[r.id] = r
    setVenueData(map)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const totalRevenue = Object.values(venueData).reduce((s, d) => s + d.revenue, 0)
  const totalOrders = Object.values(venueData).reduce((s, d) => s + d.completed, 0)

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      <header className="bg-zinc-900 px-5 py-4 flex items-center justify-between border-b border-zinc-800">
        <div>
          <h1 className="font-oswald text-2xl text-white">🏢 Group Dashboard</h1>
          <p className="font-barlow text-zinc-400 text-sm">{venues.length} venues · live today</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="font-oswald text-amber-400 text-xl">{fmt(totalRevenue)}</div>
            <div className="font-barlow text-zinc-500 text-xs">Group Revenue</div>
          </div>
          <div className="text-center">
            <div className="font-oswald text-green-400 text-xl">{totalOrders}</div>
            <div className="font-barlow text-zinc-500 text-xs">Orders</div>
          </div>
          <button onClick={() => navigate('/')} className="font-barlow text-zinc-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-zinc-800">← Home</button>
        </div>
      </header>

      <div className="flex-1 p-5">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : venues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
            <div className="text-5xl mb-4">🏢</div>
            <p className="font-oswald text-xl">No venues found</p>
            <p className="font-barlow text-sm mt-1">Add venues in Admin → Venues</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {venues.map(v => {
              const d = venueData[v.id]
              if (!d) return <Skeleton key={v.id} className="h-48" />
              return (
                <div key={v.id} className="bg-zinc-800 rounded-2xl p-5 border border-zinc-700 hover:border-amber-600 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="font-oswald text-white text-xl">{d.name}</h2>
                      <p className="font-barlow text-zinc-500 text-xs">{v.slug}</p>
                    </div>
                    {d.allergenAlerts > 0 && (
                      <span className="bg-red-900/50 border border-red-700 text-red-400 text-xs font-barlow px-2 py-1 rounded-lg">
                        ⚠️ {d.allergenAlerts} allergen{d.allergenAlerts !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-zinc-700/50 rounded-xl p-3 text-center">
                      <div className="font-oswald text-amber-400 text-2xl">{fmt(d.revenue)}</div>
                      <div className="font-barlow text-zinc-500 text-xs mt-0.5">Revenue today</div>
                    </div>
                    <div className="bg-zinc-700/50 rounded-xl p-3 text-center">
                      <div className="font-oswald text-green-400 text-2xl">{d.completed}</div>
                      <div className="font-barlow text-zinc-500 text-xs mt-0.5">Completed</div>
                    </div>
                    <div className="bg-zinc-700/50 rounded-xl p-3 text-center">
                      <div className={`font-oswald text-2xl ${d.pending > 0 ? 'text-amber-300' : 'text-zinc-600'}`}>{d.pending}</div>
                      <div className="font-barlow text-zinc-500 text-xs mt-0.5">Open tabs</div>
                    </div>
                    <div className="bg-zinc-700/50 rounded-xl p-3 text-center">
                      <div className="font-oswald text-zinc-300 text-2xl">{d.staffCount}</div>
                      <div className="font-barlow text-zinc-500 text-xs mt-0.5">Staff</div>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/admin')}
                    className="w-full bg-zinc-700 hover:bg-amber-600 text-white font-barlow text-sm py-2 rounded-xl transition-colors"
                  >
                    Drill into venue →
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
