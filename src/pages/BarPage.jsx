import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { useRealtime } from '../hooks/useRealtime'
import { playPing } from '../lib/audio'
import { connectPrinter, disconnectPrinter, isPrinterConnected } from '../lib/printer'
import StaffPicker from '../components/ui/StaffPicker'
import Spinner from '../components/ui/Spinner'
import Modal from '../components/ui/Modal'
import { formatDistanceToNow } from 'date-fns'

export default function BarPage() {
  const { selectedStaff, saveStaff } = useApp()
  const [tab, setTab] = useState('queue')
  const [pendingOrders, setPendingOrders] = useState([])
  const [historyOrders, setHistoryOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [flashing, setFlashing] = useState(false)
  const [printerConnected, setPrinterConnected] = useState(isPrinterConnected())
  const [walkUpModal, setWalkUpModal] = useState(false)
  const isFirstLoad = useRef(true)

  const { settings } = useApp()

  const loadPending = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('order_items_routed')
      .select('*, orders!inner(table_number, staff_name, staff_colour, allergens, created_at, note)')
      .eq('routed_to', 'bar')
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
          staff_colour: item.orders.staff_colour,
          allergens: item.orders.allergens || [],
          note: item.orders.note,
          created_at: item.orders.created_at,
          items: [],
          status: 'pending',
        }
      }
      grouped[key].items.push(item)
      if (item.status === 'making') grouped[key].status = 'making'
    }

    const orders = Object.values(grouped)
    setPendingOrders(orders)
    setLoading(false)

    if (!isFirstLoad.current && orders.length > (pendingOrders.length || 0)) {
      playPing('bar')
      setFlashing(true)
      setTimeout(() => setFlashing(false), 3000)
    }
    isFirstLoad.current = false
  }, [])

  const loadHistory = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('order_items_routed')
      .select('*, orders!inner(table_number, staff_name, created_at)')
      .eq('routed_to', 'bar')
      .eq('status', 'complete')
      .gte('orders.created_at', today + 'T00:00:00')
      .order('created_at', { foreignTable: 'orders', ascending: false })
      .limit(100)

    const grouped = {}
    for (const item of (data || [])) {
      const key = item.order_id
      if (!grouped[key]) {
        grouped[key] = { order_id: key, table_number: item.orders.table_number, staff_name: item.orders.staff_name, created_at: item.orders.created_at, items: [] }
      }
      grouped[key].items.push(item)
    }
    setHistoryOrders(Object.values(grouped))
  }, [])

  useEffect(() => { loadPending(); loadHistory() }, [loadPending, loadHistory])
  useRealtime('order_items_routed', () => { loadPending(); loadHistory() })

  const markDone = async (orderId) => {
    await supabase.from('order_items_routed')
      .update({ status: 'complete' })
      .eq('order_id', orderId)
      .eq('routed_to', 'bar')
    loadPending()
    loadHistory()
  }

  const markMaking = async (orderId) => {
    await supabase.from('order_items_routed')
      .update({ status: 'making' })
      .eq('order_id', orderId)
      .eq('routed_to', 'bar')
      .in('status', ['pending'])
    loadPending()
  }

  const handlePrinterConnect = async () => {
    if (printerConnected) { await disconnectPrinter(); setPrinterConnected(false) }
    else { const r = await connectPrinter(); setPrinterConnected(r.ok) }
  }

  if (!selectedStaff) return <StaffPicker onSelect={saveStaff} />

  return (
    <div className={`min-h-screen flex flex-col transition-colors ${flashing ? 'flash-amber' : ''}`} style={{ backgroundColor: '#f5f0e8' }}>
      <header className="px-5 py-4 flex items-center justify-between border-b border-amber-200 bg-[#f5f0e8]">
        <div>
          <h1 className="font-oswald text-2xl text-zinc-800">🍺 Bar Display</h1>
          <p className="font-barlow text-zinc-500 text-base">{settings?.venue_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrinterConnect}
            className={`font-barlow text-sm px-3 py-2 rounded-xl border transition-colors ${printerConnected ? 'bg-green-100 border-green-400 text-green-700' : 'bg-zinc-100 border-zinc-300 text-zinc-500'}`}
          >
            🖨 {printerConnected ? 'Printer On' : 'No Printer'}
          </button>
          <button
            onClick={() => saveStaff(null)}
            className="font-barlow text-zinc-500 hover:text-zinc-800 text-sm px-3 py-2 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            {selectedStaff.name} ↩
          </button>
        </div>
      </header>

      <div className="flex border-b border-amber-200 bg-[#f5f0e8]">
        {[['queue', `Queue (${pendingOrders.length})`], ['history', 'History']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-3 font-oswald text-lg transition-colors ${tab === key ? 'text-amber-700 border-b-2 border-amber-600' : 'text-zinc-400 hover:text-zinc-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner color="amber" /></div>
        ) : tab === 'queue' ? (
          pendingOrders.length === 0 ? (
            <EmptyState msg="No pending drink orders" icon="🍺" light />
          ) : (
            <div className="space-y-4 max-w-2xl mx-auto">
              {pendingOrders.map(order => (
                <OrderCard key={order.order_id} order={order} onDone={() => markDone(order.order_id)} onMaking={() => markMaking(order.order_id)} light />
              ))}
            </div>
          )
        ) : (
          historyOrders.length === 0 ? (
            <EmptyState msg="No completed orders today" icon="✅" light />
          ) : (
            <div className="space-y-3 max-w-2xl mx-auto">
              {historyOrders.map(order => (
                <div key={order.order_id} className="bg-white rounded-xl p-4 shadow-sm border border-zinc-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-oswald text-zinc-700 text-lg">Table {order.table_number}</span>
                    <span className="font-barlow text-zinc-400 text-sm">{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</span>
                  </div>
                  {order.items.map((item, i) => (
                    <div key={i} className="font-barlow text-zinc-500 text-sm">{item.quantity}× {item.item_name}</div>
                  ))}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Walk-up order button */}
      <div className="p-4 border-t border-amber-200 bg-[#f5f0e8]">
        <button
          onClick={() => setWalkUpModal(true)}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-oswald text-xl py-4 rounded-2xl transition-colors"
        >
          + Add Walk-Up Bar Order
        </button>
      </div>

      {walkUpModal && <WalkUpModal onClose={() => setWalkUpModal(false)} staff={selectedStaff} settings={settings} onDone={() => { setWalkUpModal(false); loadPending() }} />}
    </div>
  )
}

function OrderCard({ order, onDone, onMaking, light }) {
  const bgClass = light ? 'bg-white border border-zinc-200 shadow-sm' : 'bg-zinc-800'
  const titleClass = light ? 'text-zinc-800' : 'text-white'
  const subClass = light ? 'text-zinc-500' : 'text-zinc-400'

  return (
    <div className={`${bgClass} rounded-2xl p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`font-oswald text-2xl ${titleClass}`}>Table {order.table_number}</span>
            {order.status === 'making' && (
              <span className="bg-amber-500 text-white font-barlow text-xs px-2 py-0.5 rounded-full">Making</span>
            )}
          </div>
          <span className={`font-barlow text-sm ${subClass}`}>{order.staff_name} · {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</span>
        </div>
      </div>

      {order.allergens?.length > 0 && (
        <div className="bg-red-100 border border-red-300 rounded-xl px-3 py-2 mb-3">
          <p className="font-barlow text-red-700 text-sm font-semibold">⚠ ALLERGENS: {order.allergens.join(', ')}</p>
        </div>
      )}

      <div className="space-y-1 mb-4">
        {order.items.map((item, i) => (
          <div key={i} className={`font-barlow text-base ${titleClass}`}>
            {item.quantity}× {item.item_name}
          </div>
        ))}
      </div>

      {order.note && (
        <div className={`font-barlow text-sm ${subClass} italic mb-3`}>Note: {order.note}</div>
      )}

      <div className="flex gap-2">
        {order.status === 'pending' && (
          <button onClick={onMaking} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-oswald py-3 rounded-xl transition-colors">
            Making
          </button>
        )}
        <button onClick={onDone} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-oswald py-3 rounded-xl transition-colors">
          Done ✓
        </button>
      </div>
    </div>
  )
}

function WalkUpModal({ onClose, staff, settings, onDone }) {
  const menuItems = (settings?.menu_items || []).filter(i => i.type === 'drink' && i.active !== false)
  const [cart, setCart] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const addItem = (item) => setCart(prev => {
    const e = prev.find(x => x.id === item.id)
    return e ? prev.map(x => x.id === item.id ? { ...x, qty: x.qty + 1 } : x) : [...prev, { ...item, qty: 1 }]
  })
  const removeItem = (id) => setCart(prev => {
    const e = prev.find(x => x.id === id)
    if (!e || e.qty <= 1) return prev.filter(x => x.id !== id)
    return prev.map(x => x.id === id ? { ...x, qty: x.qty - 1 } : x)
  })
  const getQty = (id) => cart.find(x => x.id === id)?.qty || 0
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0)

  const handleSubmit = async () => {
    if (cart.length === 0) return
    setSubmitting(true)
    try {
      const { data: order } = await supabase.from('orders').insert({
        table_number: 0,
        items: cart.map(i => ({ id: i.id, name: i.name, type: 'drink', price: i.price, qty: i.qty })),
        note: 'Walk-up bar order',
        total,
        status: 'pending',
        tab_closed: false,
        id_checked: true,
        allergy_checked: true,
        allergens: [],
        staff_name: staff.name,
        staff_colour: staff.colour,
      }).select().single()

      await supabase.from('order_items_routed').insert(
        cart.map(i => ({ order_id: order.id, item_name: i.name, item_type: 'drink', quantity: i.qty, status: 'pending', routed_to: 'bar' }))
      )
      onDone()
    } catch (e) {
      alert('Error: ' + e.message)
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Walk-Up Bar Order" onClose={onClose} size="lg">
      <div className="space-y-3">
        <p className="font-barlow text-zinc-400 text-sm">Add drinks for a walk-up customer (Table 0)</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {menuItems.map(item => (
            <div key={item.id} className="flex items-center gap-3 bg-zinc-700 rounded-xl px-3 py-3">
              <div className="flex-1 font-barlow text-white">{item.name}</div>
              <div className="font-barlow text-zinc-300 mr-2">£{item.price.toFixed(2)}</div>
              <div className="flex items-center gap-2">
                {getQty(item.id) > 0 && (
                  <button onClick={() => removeItem(item.id)} className="w-8 h-8 bg-zinc-600 rounded-full text-white hover:bg-red-700 flex items-center justify-center">−</button>
                )}
                {getQty(item.id) > 0 && <span className="font-oswald text-white w-5 text-center">{getQty(item.id)}</span>}
                <button onClick={() => addItem(item)} className="w-8 h-8 bg-amber-600 rounded-full text-white hover:bg-amber-700 flex items-center justify-center">+</button>
              </div>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="bg-zinc-700 rounded-xl px-4 py-3 flex justify-between">
            <span className="font-oswald text-white">Total</span>
            <span className="font-oswald text-amber-500">£{total.toFixed(2)}</span>
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={cart.length === 0 || submitting}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald text-xl py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? <Spinner size="sm" color="white" /> : 'Send to Bar Queue'}
        </button>
      </div>
    </Modal>
  )
}

function EmptyState({ msg, icon, light }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="text-5xl">{icon}</div>
      <p className={`font-barlow text-lg ${light ? 'text-zinc-400' : 'text-zinc-500'}`}>{msg}</p>
    </div>
  )
}
