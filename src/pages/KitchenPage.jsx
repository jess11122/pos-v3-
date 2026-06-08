import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { useRealtime } from '../hooks/useRealtime'
import { playPing } from '../lib/audio'
import { connectPrinter, disconnectPrinter, isPrinterConnected } from '../lib/printer'
import StaffPicker from '../components/ui/StaffPicker'
import Spinner from '../components/ui/Spinner'
import { formatDistanceToNow } from 'date-fns'

export default function KitchenPage() {
  const { selectedStaff, saveStaff, settings } = useApp()
  const [tab, setTab] = useState('queue')
  const [pendingOrders, setPendingOrders] = useState([])
  const [historyOrders, setHistoryOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [flashing, setFlashing] = useState(false)
  const [printerConnected, setPrinterConnected] = useState(isPrinterConnected())
  const prevCountRef = useRef(0)

  const loadPending = useCallback(async () => {
    const { data } = await supabase
      .from('order_items_routed')
      .select('*, orders!inner(table_number, staff_name, staff_colour, allergens, note, created_at)')
      .eq('routed_to', 'kitchen')
      .in('status', ['pending', 'making'])
      .order('created_at', { foreignTable: 'orders', ascending: true })

    const grouped = {}
    for (const item of (data || [])) {
      const key = item.order_id
      if (!grouped[key]) {
        grouped[key] = {
          order_id: key,
          table_number: item.orders.table_number,
          staff_name: item.orders.staff_name,
          allergens: item.orders.allergens || [],
          note: item.orders.note,
          created_at: item.orders.created_at,
          items: [],
          overallStatus: 'pending',
        }
      }
      grouped[key].items.push(item)
      if (item.status === 'making') grouped[key].overallStatus = 'making'
    }

    const orders = Object.values(grouped)
    const newCount = orders.length
    if (newCount > prevCountRef.current) {
      playPing('kitchen')
      setFlashing(true)
      setTimeout(() => setFlashing(false), 3000)
    }
    prevCountRef.current = newCount
    setPendingOrders(orders)
    setLoading(false)
  }, [])

  const loadHistory = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('order_items_routed')
      .select('*, orders!inner(table_number, staff_name, created_at, allergens)')
      .eq('routed_to', 'kitchen')
      .in('status', ['ready', 'complete'])
      .gte('orders.created_at', today + 'T00:00:00')
      .order('created_at', { foreignTable: 'orders', ascending: false })
      .limit(100)

    const grouped = {}
    for (const item of (data || [])) {
      const key = item.order_id
      if (!grouped[key]) {
        grouped[key] = { order_id: key, table_number: item.orders.table_number, staff_name: item.orders.staff_name, created_at: item.orders.created_at, allergens: item.orders.allergens || [], items: [], status: item.status }
      }
      grouped[key].items.push(item)
    }
    setHistoryOrders(Object.values(grouped))
  }, [])

  useEffect(() => { loadPending(); loadHistory() }, [loadPending, loadHistory])
  useRealtime('order_items_routed', () => { loadPending(); loadHistory() })

  const markMaking = async (orderId) => {
    await supabase.from('order_items_routed').update({ status: 'making' }).eq('order_id', orderId).eq('routed_to', 'kitchen').in('status', ['pending'])
    loadPending()
  }

  const markReady = async (orderId) => {
    await supabase.from('order_items_routed').update({ status: 'ready' }).eq('order_id', orderId).eq('routed_to', 'kitchen')
    loadPending()
    loadHistory()
  }

  const handlePrinterConnect = async () => {
    if (printerConnected) { await disconnectPrinter(); setPrinterConnected(false) }
    else { const r = await connectPrinter(); setPrinterConnected(r.ok) }
  }

  if (!selectedStaff) return <StaffPicker onSelect={saveStaff} />

  return (
    <div className={`min-h-screen bg-[#111] flex flex-col transition-all ${flashing ? 'flash-red' : ''}`}>
      <header className="px-5 py-4 flex items-center justify-between border-b border-zinc-800 bg-[#111]">
        <div>
          <h1 className="font-oswald text-2xl text-white">👨‍🍳 Kitchen Display</h1>
          <p className="font-barlow text-zinc-400 text-base">{settings?.venue_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrinterConnect}
            className={`font-barlow text-sm px-3 py-2 rounded-xl border transition-colors ${printerConnected ? 'bg-green-900 border-green-600 text-green-400' : 'bg-zinc-900 border-zinc-700 text-zinc-500'}`}
          >
            🖨 {printerConnected ? 'Printer On' : 'No Printer'}
          </button>
          <button onClick={() => saveStaff(null)} className="font-barlow text-zinc-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
            {selectedStaff.name} ↩
          </button>
        </div>
      </header>

      <div className="flex border-b border-zinc-800 bg-[#111]">
        {[['queue', `Queue (${pendingOrders.length})`], ['history', 'History']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-3 font-oswald text-lg transition-colors ${tab === key ? 'text-green-400 border-b-2 border-green-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner color="green" /></div>
        ) : tab === 'queue' ? (
          pendingOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="text-5xl">👨‍🍳</div>
              <p className="font-barlow text-zinc-500 text-lg">No pending food orders</p>
            </div>
          ) : (
            <div className="space-y-4 max-w-2xl mx-auto">
              {pendingOrders.map(order => (
                <KitchenCard key={order.order_id} order={order} onMaking={() => markMaking(order.order_id)} onReady={() => markReady(order.order_id)} />
              ))}
            </div>
          )
        ) : (
          historyOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="text-5xl">✅</div>
              <p className="font-barlow text-zinc-500 text-lg">No completed tickets today</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl mx-auto">
              {historyOrders.map(order => (
                <div key={order.order_id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-oswald text-white text-lg">Table {order.table_number}</span>
                    <span className={`font-barlow text-xs px-2 py-0.5 rounded-full ${order.status === 'ready' ? 'bg-green-700 text-green-200' : 'bg-zinc-700 text-zinc-300'}`}>
                      {order.status === 'ready' ? 'READY' : 'Complete'}
                    </span>
                  </div>
                  {order.items.map((item, i) => (
                    <div key={i} className="font-barlow text-zinc-400 text-sm">{item.quantity}× {item.item_name}</div>
                  ))}
                  {order.allergens?.length > 0 && (
                    <p className="font-barlow text-red-400 text-xs mt-1">⚠ {order.allergens.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

function KitchenCard({ order, onMaking, onReady }) {
  const age = Math.floor((Date.now() - new Date(order.created_at)) / 60000)
  const isUrgent = age > 15

  return (
    <div className={`bg-zinc-900 rounded-2xl p-5 border-2 ${isUrgent ? 'border-red-600' : order.overallStatus === 'making' ? 'border-amber-600' : 'border-zinc-700'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-oswald text-white text-2xl">Table {order.table_number}</span>
            {order.overallStatus === 'making' && (
              <span className="bg-amber-600 text-white font-barlow text-xs px-2 py-0.5 rounded-full">MAKING</span>
            )}
          </div>
          <span className="font-barlow text-zinc-400 text-sm">{order.staff_name}</span>
        </div>
        <div className={`font-oswald text-right ${isUrgent ? 'text-red-400' : 'text-zinc-400'}`}>
          <div className="text-xl">{age}m</div>
          <div className="text-xs">{isUrgent ? '⚠ LATE' : 'ago'}</div>
        </div>
      </div>

      {order.allergens?.length > 0 && (
        <div className="bg-red-900/60 border border-red-700 rounded-xl px-3 py-2 mb-3">
          <p className="font-barlow text-red-300 text-sm font-bold">🚨 ALLERGENS: {order.allergens.join(', ')}</p>
        </div>
      )}

      <div className="space-y-1 mb-4">
        {order.items.map((item, i) => (
          <div key={i} className="font-barlow text-white text-lg">
            {item.quantity}× {item.item_name}
          </div>
        ))}
      </div>

      {order.note && (
        <div className="font-barlow text-amber-400 text-sm italic mb-3">📝 {order.note}</div>
      )}

      <div className="flex gap-2">
        {order.overallStatus === 'pending' && (
          <button onClick={onMaking} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-oswald py-3 rounded-xl transition-colors text-lg">
            Making
          </button>
        )}
        <button onClick={onReady} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-oswald py-3 rounded-xl transition-colors text-lg">
          Ready ✓
        </button>
      </div>
    </div>
  )
}
