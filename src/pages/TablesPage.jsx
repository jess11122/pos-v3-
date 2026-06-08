import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { useRealtime } from '../hooks/useRealtime'
import { openCashDrawer } from '../lib/printer'
import Spinner from '../components/ui/Spinner'
import Modal from '../components/ui/Modal'
import { formatDistanceToNow } from 'date-fns'

export default function TablesPage() {
  const navigate = useNavigate()
  const { settings } = useApp()
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTable, setSelectedTable] = useState(null)
  const [tip, setTip] = useState('')
  const [customTip, setCustomTip] = useState('')
  const [processing, setProcessing] = useState(false)
  const [staffName, setStaffName] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const todayStart = () => new Date().toISOString().split('T')[0] + 'T00:00:00'

  const loadTables = useCallback(async () => {
    // FIX: add date filter so we only fetch today's open tabs
    const [ordersRes, routedRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id,table_number,total,status,created_at,staff_name,staff_colour,items,allergens,note')
        .eq('tab_closed', false)
        .eq('status', 'pending')
        .gte('created_at', todayStart())
        .order('table_number'),
      supabase
        .from('order_items_routed')
        .select('order_id,status,routed_to')
        .in('status', ['pending', 'making', 'ready'])
        .gte('created_at', todayStart()),
    ])

    if (!mountedRef.current) return

    const grouped = {}
    for (const o of (ordersRes.data || [])) {
      if (!grouped[o.table_number]) {
        grouped[o.table_number] = {
          tableNumber: o.table_number,
          orders: [],
          staffName: o.staff_name,
          staffColour: o.staff_colour,
          openedAt: o.created_at,
          barPending: false,
          kitchenPending: false,
          ready: false,
        }
      }
      grouped[o.table_number].orders.push(o)
    }

    // FIX: build order-id → table-number lookup to avoid O(n*m) nested loop
    const orderToTable = {}
    for (const t of Object.values(grouped)) {
      for (const o of t.orders) orderToTable[o.id] = t.tableNumber
    }

    for (const r of (routedRes.data || [])) {
      const tn = orderToTable[r.order_id]
      if (tn && grouped[tn]) {
        if (r.routed_to === 'bar' && ['pending', 'making'].includes(r.status)) grouped[tn].barPending = true
        if (r.routed_to === 'kitchen' && ['pending', 'making'].includes(r.status)) grouped[tn].kitchenPending = true
        if (r.routed_to === 'kitchen' && r.status === 'ready') grouped[tn].ready = true
      }
    }

    setTables(Object.values(grouped).sort((a, b) => a.tableNumber - b.tableNumber))
    setLoading(false)
  }, [])

  useEffect(() => { loadTables() }, [loadTables])
  useRealtime('orders', loadTables)
  useRealtime('order_items_routed', loadTables)

  const openTable = (t) => {
    setSelectedTable(t)
    setStaffName(t.staffName)
    setTip('')
    setCustomTip('')
  }

  const totalAmount = selectedTable ? selectedTable.orders.reduce((s, o) => s + (o.total || 0), 0) : 0
  const tipAmount = parseFloat(tip || customTip || 0)
  const grandTotal = totalAmount + tipAmount

  const handlePayment = async (method) => {
    if (!selectedTable) return
    setProcessing(true)
    try {
      const orderIds = selectedTable.orders.map(o => o.id)
      await supabase.from('orders').update({
        status: 'complete', tab_closed: true,
        completed_at: new Date().toISOString(), payment_method: method,
      }).in('id', orderIds)
      await supabase.from('order_items_routed').update({ status: 'complete' }).in('order_id', orderIds)
      if (tipAmount > 0) {
        await supabase.from('tips').insert({ table_number: selectedTable.tableNumber, staff_name: staffName, amount: tipAmount, payment_method: method })
      }
      if (method === 'cash') await openCashDrawer()
      setSelectedTable(null)
      loadTables()
    } catch (e) {
      alert('Payment error: ' + e.message)
    } finally {
      setProcessing(false)
    }
  }

  const allItems = selectedTable
    ? selectedTable.orders.flatMap(o => (o.items || []).map(i => ({ ...i, note: o.note, allergens: o.allergens })))
    : []
  const mergedItems = allItems.reduce((acc, item) => {
    const existing = acc.find(x => x.name === item.name)
    if (existing) existing.qty += (item.qty || 1)
    else acc.push({ ...item, qty: item.qty || 1 })
    return acc
  }, [])

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      <header className="bg-zinc-900 px-5 py-4 flex items-center justify-between border-b border-zinc-800">
        <div>
          <h1 className="font-oswald text-2xl text-white">📋 Live Tables</h1>
          <p className="font-barlow text-zinc-400">{tables.length} open tab{tables.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => navigate('/')} className="font-barlow text-zinc-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors">← Home</button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="text-5xl">🍽</div>
            <p className="font-barlow text-zinc-500 text-lg">No open tabs right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {tables.map(t => (
              <TableCard key={t.tableNumber} table={t} onClick={() => openTable(t)} />
            ))}
          </div>
        )}
      </div>

      {selectedTable && (
        <Modal title={`Table ${selectedTable.tableNumber}`} onClose={() => setSelectedTable(null)} size="lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-barlow text-zinc-400 text-sm">Staff: <span style={{ color: selectedTable.staffColour }} className="font-semibold">{selectedTable.staffName}</span></p>
                <p className="font-barlow text-zinc-400 text-sm">Opened: {formatDistanceToNow(new Date(selectedTable.openedAt), { addSuffix: true })}</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                {selectedTable.barPending && <span className="bg-amber-600/20 border border-amber-600 text-amber-400 font-barlow text-xs px-2 py-1 rounded-full">Bar making</span>}
                {selectedTable.kitchenPending && <span className="bg-red-600/20 border border-red-600 text-red-400 font-barlow text-xs px-2 py-1 rounded-full">Kitchen making</span>}
                {selectedTable.ready && <span className="bg-green-600/20 border border-green-600 text-green-400 font-barlow text-xs px-2 py-1 rounded-full pulse-ready">READY</span>}
              </div>
            </div>

            <div className="bg-zinc-700 rounded-xl p-4 space-y-2">
              {mergedItems.map((item, i) => (
                <div key={i} className="flex justify-between font-barlow text-white text-base">
                  <span>{item.qty}× {item.name}</span>
                  <span>£{((item.price || 0) * item.qty).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-zinc-600 pt-2 flex justify-between">
                <span className="font-oswald text-white">Subtotal</span>
                <span className="font-oswald text-white">£{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {selectedTable.orders.some(o => o.allergens?.length > 0) && (
              <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3">
                <p className="font-barlow text-red-400 text-sm">
                  ⚠ Allergens: {[...new Set(selectedTable.orders.flatMap(o => o.allergens || []))].join(', ')}
                </p>
              </div>
            )}

            <div>
              <label className="font-barlow text-zinc-300 text-base block mb-2">Add Tip (optional)</label>
              <div className="flex gap-2 mb-2 flex-wrap">
                {[2, 5, 10, 20].map(amt => (
                  <button key={amt} onClick={() => { setTip(String(amt)); setCustomTip('') }}
                    className={`py-2 px-4 rounded-xl font-oswald text-base transition-colors ${tip === String(amt) ? 'bg-amber-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}>
                    £{amt}
                  </button>
                ))}
                <button onClick={() => { setTip(''); setCustomTip('') }}
                  className={`py-2 px-4 rounded-xl font-barlow text-base transition-colors ${!tip && !customTip ? 'bg-zinc-600 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'}`}>
                  No tip
                </button>
              </div>
              <input type="number" placeholder="Custom amount £" value={customTip}
                onChange={e => { setCustomTip(e.target.value); setTip('') }}
                min="0" step="0.50"
                className="w-full bg-zinc-700 text-white font-barlow text-base rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-amber-600" />
            </div>

            <div className="bg-zinc-700 rounded-xl px-4 py-3 flex justify-between">
              <span className="font-oswald text-white text-xl">Total to Pay</span>
              <span className="font-oswald text-amber-500 text-xl">£{grandTotal.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handlePayment('cash')} disabled={processing}
                className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-oswald text-xl py-5 rounded-2xl transition-colors flex items-center justify-center gap-2">
                {processing ? <Spinner size="sm" color="white" /> : '💵'} Cash
              </button>
              <button onClick={() => handlePayment('card')} disabled={processing}
                className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-oswald text-xl py-5 rounded-2xl transition-colors flex items-center justify-center gap-2">
                {processing ? <Spinner size="sm" color="white" /> : '💳'} Card
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function TableCard({ table, onClick }) {
  const total = table.orders.reduce((s, o) => s + (o.total || 0), 0)
  const itemCount = table.orders.reduce((s, o) => s + (o.items?.length || 0), 0)
  return (
    <button onClick={onClick} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 rounded-2xl p-5 text-left transition-all active:scale-95 w-full">
      <div className="flex items-start justify-between mb-3">
        <span className="font-oswald text-white text-2xl">Table {table.tableNumber}</span>
        <div className="flex flex-col gap-1 items-end">
          {table.barPending && <span className="bg-amber-600/20 border border-amber-600 text-amber-400 font-barlow text-xs px-2 py-0.5 rounded-full">Bar</span>}
          {table.kitchenPending && <span className="bg-red-600/20 border border-red-600 text-red-400 font-barlow text-xs px-2 py-0.5 rounded-full">Kitchen</span>}
          {table.ready && <span className="bg-green-600/20 border border-green-500 text-green-400 font-barlow text-xs px-2 py-0.5 rounded-full pulse-ready">READY</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: table.staffColour }} />
        <span className="font-barlow text-zinc-400 text-sm">{table.staffName}</span>
      </div>
      <div className="flex justify-between items-end mt-3">
        <span className="font-barlow text-zinc-500 text-sm">{itemCount} item{itemCount !== 1 ? 's' : ''} · {formatDistanceToNow(new Date(table.openedAt), { addSuffix: true })}</span>
        <span className="font-oswald text-amber-500 text-xl">£{total.toFixed(2)}</span>
      </div>
    </button>
  )
}

