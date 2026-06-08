import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { useRealtime } from '../hooks/useRealtime'
import { openCashDrawer } from '../lib/printer'
import Spinner from '../components/ui/Spinner'
import { formatDistanceToNow, differenceInMinutes } from 'date-fns'

const VOID_REASONS = ["Customer changed mind", "Wrong item ordered", "Unavailable / 86'd", "Spilled / spoiled", "Manager comp", "Other"]

// ─── Live timer hook ───────────────────────────────────────────────────────
function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function elapsed(openedAt, now) {
  const mins = differenceInMinutes(now, new Date(openedAt))
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function elapsedColour(openedAt, now) {
  const mins = differenceInMinutes(now, new Date(openedAt))
  if (mins < 45) return 'text-zinc-400'
  if (mins < 90) return 'text-amber-400'
  return 'text-red-400'
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function TablesPage() {
  const navigate = useNavigate()
  const { settings, selectedStaff, currentVenue } = useApp()
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTable, setSelectedTable] = useState(null)
  const [view, setView] = useState('floor') // 'floor' | 'list'
  const [filter, setFilter] = useState('all') // 'all' | 'ready' | 'bar' | 'kitchen'
  const mountedRef = useRef(true)
  const now = useNow(30000)

  const floorTables = settings?.floor_map?.tables || []

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const todayStart = () => new Date().toISOString().split('T')[0] + 'T00:00:00'

  const loadTables = useCallback(async () => {
    const [ordersRes, routedRes] = await Promise.all([
      supabase.from('orders')
        .select('id,table_number,total,status,created_at,staff_name,staff_colour,items,allergens,note,voided_amount')
        .eq('tab_closed', false).eq('status', 'pending')
        .gte('created_at', todayStart()).order('table_number'),
      supabase.from('order_items_routed')
        .select('order_id,status,routed_to')
        .in('status', ['pending', 'making', 'ready'])
        .gte('created_at', todayStart()),
    ])
    if (!mountedRef.current) return

    const grouped = {}
    for (const o of (ordersRes.data || [])) {
      if (!grouped[o.table_number]) {
        grouped[o.table_number] = {
          tableNumber: o.table_number, orders: [],
          staffName: o.staff_name, staffColour: o.staff_colour,
          openedAt: o.created_at,
          barPending: false, kitchenPending: false, ready: false,
        }
      }
      grouped[o.table_number].orders.push(o)
    }

    const orderToTable = {}
    for (const t of Object.values(grouped)) {
      for (const o of t.orders) orderToTable[o.id] = t.tableNumber
    }
    for (const r of (routedRes.data || [])) {
      const tn = orderToTable[r.order_id]
      if (tn && grouped[tn]) {
        if (r.routed_to === 'bar' && ['pending','making'].includes(r.status)) grouped[tn].barPending = true
        if (r.routed_to === 'kitchen' && ['pending','making'].includes(r.status)) grouped[tn].kitchenPending = true
        if (r.status === 'ready') grouped[tn].ready = true
      }
    }

    setTables(Object.values(grouped).sort((a, b) => new Date(a.openedAt) - new Date(b.openedAt)))
    setLoading(false)
  }, [])

  useEffect(() => { loadTables() }, [loadTables])
  useRealtime('orders', loadTables)
  useRealtime('order_items_routed', loadTables)

  const filteredTables = tables.filter(t => {
    if (filter === 'ready') return t.ready
    if (filter === 'bar') return t.barPending
    if (filter === 'kitchen') return t.kitchenPending
    return true
  })

  const readyCount = tables.filter(t => t.ready).length
  const totalFloat = tables.reduce((s, t) => s + t.orders.reduce((os, o) => os + (o.total || 0) - (o.voided_amount || 0), 0), 0)

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      {/* Header */}
      <header className="bg-zinc-900 px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-oswald text-2xl text-white">Live Tables</h1>
            <p className="font-barlow text-zinc-400 text-sm">{tables.length} open · £{totalFloat.toFixed(2)} on the floor</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-zinc-800 rounded-xl p-1">
              <button onClick={() => setView('floor')} className={`px-3 py-1.5 rounded-lg font-barlow text-sm transition-colors ${view === 'floor' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-white'}`}>⬜ Floor</button>
              <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded-lg font-barlow text-sm transition-colors ${view === 'list' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-white'}`}>☰ List</button>
            </div>
            <button onClick={() => navigate('/')} className="font-barlow text-zinc-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors">← Home</button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex gap-3 overflow-x-auto">
          {[
            { key: 'all', label: `All (${tables.length})`, colour: 'text-white' },
            { key: 'ready', label: `✓ Ready (${tables.filter(t => t.ready).length})`, colour: 'text-green-400' },
            { key: 'bar', label: `🍺 Bar (${tables.filter(t => t.barPending).length})`, colour: 'text-amber-400' },
            { key: 'kitchen', label: `🍽 Kitchen (${tables.filter(t => t.kitchenPending).length})`, colour: 'text-red-400' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl font-barlow text-sm transition-colors ${filter === f.key ? 'bg-zinc-700' : 'bg-transparent hover:bg-zinc-800'} ${f.colour}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>
      ) : tables.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="text-6xl">🍽</div>
          <p className="font-oswald text-zinc-500 text-xl">No open tabs</p>
          <p className="font-barlow text-zinc-600 text-sm">Tables will appear here when waiters send orders</p>
        </div>
      ) : view === 'floor' ? (
        <FloorView
          floorTables={floorTables}
          liveTables={tables}
          now={now}
          onSelect={setSelectedTable}
        />
      ) : (
        <ListView
          tables={filteredTables}
          now={now}
          onSelect={setSelectedTable}
        />
      )}

      {selectedTable && (
        <PaymentPanel
          table={selectedTable}
          staffPicker={selectedStaff?.name}
          currentVenue={currentVenue}
          onClose={() => setSelectedTable(null)}
          onPaid={() => { setSelectedTable(null); loadTables() }}
        />
      )}
    </div>
  )
}

// ─── Floor View ───────────────────────────────────────────────────────────
function FloorView({ floorTables, liveTables, now, onSelect }) {
  const liveMap = {}
  for (const t of liveTables) liveMap[t.tableNumber] = t

  if (floorTables.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-barlow text-zinc-500 text-base text-center px-6">No floor map configured.<br />Go to Admin → Tables to set one up.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 overflow-auto">
      <div className="relative w-full" style={{ paddingBottom: '65%', minHeight: 380 }}>
        <div className="absolute inset-0">
          {floorTables.map(ft => {
            const live = liveMap[ft.number]
            const total = live ? live.orders.reduce((s, o) => s + (o.total || 0) - (o.voided_amount || 0), 0) : 0
            const mins = live ? differenceInMinutes(now, new Date(live.openedAt)) : 0

            let bg = '#16a34a' // free
            let border = 'transparent'
            let glow = ''
            if (live?.ready) { bg = '#15803d'; border = '#22c55e'; glow = '0 0 0 2px #22c55e, 0 0 16px #22c55e60' }
            else if (live) { bg = '#b45309' }

            return (
              <button
                key={ft.id || ft.number}
                onClick={() => live && onSelect(live)}
                className={`absolute rounded-2xl flex flex-col items-center justify-center transition-all active:scale-95 ${live ? 'hover:brightness-110 cursor-pointer' : 'cursor-default opacity-70'}`}
                style={{
                  left: `${ft.x}%`, top: `${ft.y}%`,
                  width: `${ft.w || 14}%`, height: `${ft.h || 12}%`,
                  minWidth: 64, minHeight: 64,
                  backgroundColor: bg,
                  border: `2px solid ${border}`,
                  boxShadow: glow || undefined,
                }}
              >
                <span className="font-oswald text-white text-lg leading-none">{ft.number}</span>
                {live ? (
                  <>
                    <span className="font-barlow text-white/90 text-xs mt-0.5">£{total.toFixed(0)}</span>
                    <span className={`font-barlow text-xs mt-0.5 ${mins >= 90 ? 'text-red-200' : mins >= 45 ? 'text-amber-200' : 'text-white/60'}`}>{elapsed(live.openedAt, now)}</span>
                    {live.ready && <span className="font-barlow text-xs bg-green-400 text-green-900 px-1.5 rounded-full mt-0.5 font-bold">READY</span>}
                  </>
                ) : (
                  <span className="font-barlow text-white/50 text-xs">Free</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-5 px-2 mt-2">
        {[
          { bg: '#16a34a', label: 'Free' },
          { bg: '#b45309', label: 'Occupied' },
          { border: '#22c55e', bg: '#15803d', label: 'Food Ready' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.bg, border: l.border ? `2px solid ${l.border}` : undefined }} />
            <span className="font-barlow text-zinc-500 text-xs">{l.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-400/50" />
          <span className="font-barlow text-zinc-500 text-xs">45m+ open</span>
        </div>
      </div>
    </div>
  )
}

// ─── List View ────────────────────────────────────────────────────────────
function ListView({ tables, now, onSelect }) {
  if (tables.length === 0) {
    return <div className="flex-1 flex items-center justify-center"><p className="font-barlow text-zinc-500">No tables match this filter</p></div>
  }
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl mx-auto">
        {tables.map(t => <TableCard key={t.tableNumber} table={t} now={now} onClick={() => onSelect(t)} />)}
      </div>
    </div>
  )
}

function TableCard({ table, now, onClick }) {
  const total = table.orders.reduce((s, o) => s + (o.total || 0) - (o.voided_amount || 0), 0)
  const itemCount = table.orders.reduce((s, o) => s + (o.items?.length || 0), 0)
  const mins = differenceInMinutes(now, new Date(table.openedAt))
  const timeCol = mins >= 90 ? 'text-red-400' : mins >= 45 ? 'text-amber-400' : 'text-zinc-500'
  const hasAlert = table.ready || mins >= 90

  return (
    <button
      onClick={onClick}
      className={`relative bg-zinc-800 hover:bg-zinc-750 rounded-2xl p-4 text-left transition-all active:scale-98 w-full overflow-hidden border ${hasAlert ? 'border-zinc-600' : 'border-zinc-800'}`}
      style={{ borderLeftColor: table.staffColour || '#d97706', borderLeftWidth: 4 }}
    >
      {/* Ready glow */}
      {table.ready && <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ boxShadow: 'inset 0 0 0 2px #22c55e' }} />}

      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="font-oswald text-white text-2xl">Table {table.tableNumber}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: table.staffColour }} />
            <span className="font-barlow text-zinc-400 text-sm">{table.staffName}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="font-oswald text-amber-500 text-2xl">£{total.toFixed(2)}</span>
          <p className="font-barlow text-zinc-500 text-xs">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className={`font-barlow text-sm ${timeCol} flex items-center gap-1`}>
          {mins >= 90 && '⚠ '}{elapsed(table.openedAt, now)}
        </span>
        <div className="flex gap-1.5">
          {table.ready && <StatusPill color="green" label="READY" />}
          {table.barPending && <StatusPill color="amber" label="Bar" />}
          {table.kitchenPending && <StatusPill color="red" label="Kitchen" />}
        </div>
      </div>
    </button>
  )
}

function StatusPill({ color, label }) {
  const colours = {
    green: 'bg-green-900/60 border-green-600 text-green-400',
    amber: 'bg-amber-900/60 border-amber-600 text-amber-400',
    red: 'bg-red-900/60 border-red-600 text-red-400',
  }
  return (
    <span className={`border font-barlow text-xs px-2 py-0.5 rounded-full ${colours[color]}`}>{label}</span>
  )
}

// ─── Payment Panel (slide-up sheet) ──────────────────────────────────────
function PaymentPanel({ table, staffPicker, currentVenue, onClose, onPaid }) {
  const [tip, setTip] = useState('')
  const [customTip, setCustomTip] = useState('')
  const [staffName, setStaffName] = useState(staffPicker || table.staffName)
  const [processing, setProcessing] = useState(false)
  const [screen, setScreen] = useState('bill') // 'bill' | 'void' | 'split'

  const total = table.orders.reduce((s, o) => s + (o.total || 0) - (o.voided_amount || 0), 0)
  const tipAmount = parseFloat(tip || customTip || 0)
  const grandTotal = total + tipAmount

  const allItems = table.orders.flatMap(o =>
    (o.items || []).map(i => ({ ...i, qty: i.qty || 1 }))
  )
  const merged = allItems.reduce((acc, item) => {
    const ex = acc.find(x => x.name === item.name)
    if (ex) ex.qty += item.qty
    else acc.push({ ...item })
    return acc
  }, [])

  const handlePayment = async (method) => {
    setProcessing(true)
    try {
      const orderIds = table.orders.map(o => o.id)
      await supabase.from('orders').update({
        status: 'complete', tab_closed: true,
        completed_at: new Date().toISOString(), payment_method: method,
      }).in('id', orderIds)
      await supabase.from('order_items_routed').update({ status: 'complete' }).in('order_id', orderIds)
      if (tipAmount > 0) {
        await supabase.from('tips').insert({
          table_number: table.tableNumber, staff_name: staffName,
          amount: tipAmount, payment_method: method,
          ...(currentVenue?.id ? { venue_id: currentVenue.id } : {}),
        })
      }
      if (method === 'cash') await openCashDrawer()
      onPaid()
    } catch (e) {
      alert('Payment error: ' + e.message)
      setProcessing(false)
    }
  }

  return (
    // Overlay + bottom sheet
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-zinc-900 rounded-t-3xl shadow-2xl w-full max-w-2xl mx-auto overflow-hidden" style={{ maxHeight: '92vh' }}>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-zinc-700 rounded-full" />
        </div>

        {/* Tab header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-zinc-800">
          <div>
            <h2 className="font-oswald text-white text-2xl">Table {table.tableNumber}</h2>
            <p className="font-barlow text-zinc-400 text-sm flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: table.staffColour }} />
              {table.staffName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {table.ready && <span className="font-barlow text-xs bg-green-900/60 border border-green-600 text-green-400 px-2 py-1 rounded-full pulse-ready">READY</span>}
            <button onClick={onClose} className="w-8 h-8 bg-zinc-800 rounded-full text-zinc-400 hover:text-white flex items-center justify-center text-lg transition-colors">✕</button>
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 120px)' }}>
          {screen === 'bill' && (
            <BillScreen
              merged={merged}
              table={table}
              total={total}
              tip={tip} setTip={setTip}
              customTip={customTip} setCustomTip={setCustomTip}
              grandTotal={grandTotal}
              tipAmount={tipAmount}
              staffName={staffName} setStaffName={setStaffName}
              processing={processing}
              onPay={handlePayment}
              onVoid={() => setScreen('void')}
              onSplit={() => setScreen('split')}
            />
          )}
          {screen === 'void' && (
            <VoidScreen
              table={table}
              staffName={staffName}
              currentVenue={currentVenue}
              onBack={() => setScreen('bill')}
              onVoided={onPaid}
            />
          )}
          {screen === 'split' && (
            <SplitScreen
              table={table}
              total={total}
              currentVenue={currentVenue}
              onBack={() => setScreen('bill')}
              onPaid={onPaid}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function BillScreen({ merged, table, total, tip, setTip, customTip, setCustomTip, grandTotal, tipAmount, staffName, setStaffName, processing, onPay, onVoid, onSplit }) {
  const allergens = [...new Set(table.orders.flatMap(o => o.allergens || []))]
  const notes = table.orders.filter(o => o.note).map(o => o.note)

  return (
    <div className="p-5 space-y-4 pb-8">
      {/* Allergen / note banners */}
      {allergens.length > 0 && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3">
          <p className="font-barlow text-red-400 text-sm">⚠ Allergens: {allergens.join(', ')}</p>
        </div>
      )}
      {notes.length > 0 && (
        <div className="bg-zinc-800 rounded-xl px-4 py-3">
          <p className="font-barlow text-zinc-400 text-sm">📝 {notes.join(' · ')}</p>
        </div>
      )}

      {/* Receipt */}
      <div className="bg-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-700 flex justify-between items-center">
          <span className="font-oswald text-zinc-400 text-sm tracking-widest uppercase">Order</span>
          <span className="font-barlow text-zinc-500 text-xs">{merged.reduce((s,i)=>s+i.qty,0)} items</span>
        </div>
        <div className="divide-y divide-zinc-700/50">
          {merged.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="font-barlow text-zinc-500 text-sm w-6 text-center">{item.qty}×</span>
                <span className="font-barlow text-white text-sm">{item.name}</span>
              </div>
              <span className="font-barlow text-zinc-300 text-sm">£{((item.price || 0) * item.qty).toFixed(2)}</span>
            </div>
          ))}
        </div>
        {table.orders.some(o => (o.voided_amount || 0) > 0) && (
          <div className="flex justify-between px-4 py-2 border-t border-zinc-700 bg-red-900/10">
            <span className="font-barlow text-red-400 text-sm">Voids</span>
            <span className="font-barlow text-red-400 text-sm">−£{table.orders.reduce((s,o)=>s+(o.voided_amount||0),0).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between px-4 py-3 border-t border-zinc-700 bg-zinc-700/30">
          <span className="font-oswald text-white">Subtotal</span>
          <span className="font-oswald text-white">£{total.toFixed(2)}</span>
        </div>
      </div>

      {/* Tip */}
      <div>
        <label className="font-barlow text-zinc-400 text-sm block mb-2">Tip</label>
        <div className="grid grid-cols-5 gap-2 mb-2">
          {[0, 2, 5, 10, 20].map(amt => (
            <button
              key={amt}
              onClick={() => { setTip(amt > 0 ? String(amt) : ''); setCustomTip('') }}
              className={`py-2.5 rounded-xl font-barlow text-sm transition-colors ${(amt > 0 ? tip === String(amt) : !tip && !customTip) ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
            >
              {amt === 0 ? 'None' : `£${amt}`}
            </button>
          ))}
        </div>
        <input
          type="number" placeholder="Custom tip £" value={customTip}
          onChange={e => { setCustomTip(e.target.value); setTip('') }}
          min="0" step="0.50"
          className="w-full bg-zinc-800 text-white font-barlow text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-amber-600"
        />
      </div>

      {/* Grand total */}
      <div className="bg-zinc-800 rounded-2xl px-5 py-4 flex justify-between items-center">
        <div>
          <p className="font-barlow text-zinc-400 text-sm">Total to collect</p>
          {tipAmount > 0 && <p className="font-barlow text-zinc-500 text-xs">inc. £{tipAmount.toFixed(2)} tip</p>}
        </div>
        <span className="font-oswald text-amber-500 text-4xl">£{grandTotal.toFixed(2)}</span>
      </div>

      {/* Payment buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onPay('cash')} disabled={processing}
          className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-oswald text-2xl py-6 rounded-2xl transition-colors flex flex-col items-center justify-center gap-1"
        >
          <span>💵</span>
          <span>Cash</span>
        </button>
        <button
          onClick={() => onPay('card')} disabled={processing}
          className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-oswald text-2xl py-6 rounded-2xl transition-colors flex flex-col items-center justify-center gap-1"
        >
          <span>💳</span>
          <span>Card</span>
        </button>
      </div>
      {processing && <div className="flex justify-center"><Spinner /></div>}

      {/* Secondary actions */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={onVoid} className="py-3 bg-zinc-800 hover:bg-red-900/30 border border-zinc-700 hover:border-red-800 text-zinc-400 hover:text-red-400 font-barlow text-sm rounded-xl transition-colors">Void Item</button>
        <button onClick={onSplit} className="py-3 bg-zinc-800 hover:bg-blue-900/30 border border-zinc-700 hover:border-blue-800 text-zinc-400 hover:text-blue-400 font-barlow text-sm rounded-xl transition-colors">Split Bill</button>
      </div>
    </div>
  )
}

// ─── Void Screen ─────────────────────────────────────────────────────────
function VoidScreen({ table, staffName, currentVenue, onBack, onVoided }) {
  const allItems = table.orders.flatMap(o => (o.items || []).map(i => ({ ...i, orderId: o.id, qty: i.qty || 1 })))
  const [selected, setSelected] = useState(null)
  const [reason, setReason] = useState(VOID_REASONS[0])
  const [saving, setSaving] = useState(false)

  const handleVoid = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const amount = (selected.price || 0) * selected.qty
      await supabase.from('voids').insert({ order_id: selected.orderId, item_name: selected.name, quantity: selected.qty, amount, reason, voided_by: staffName || 'Manager', ...(currentVenue?.id ? { venue_id: currentVenue.id } : {}) })
      const order = table.orders.find(o => o.id === selected.orderId)
      if (order) await supabase.from('orders').update({ voided_amount: (order.voided_amount || 0) + amount }).eq('id', order.id)
      onVoided()
    } catch (e) { alert('Void failed: ' + e.message); setSaving(false) }
  }

  return (
    <div className="p-5 space-y-4 pb-8">
      <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white font-barlow text-sm transition-colors">← Back to bill</button>
      <h3 className="font-oswald text-white text-xl">Select item to void</h3>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {allItems.map((item, i) => (
          <button key={i} onClick={() => setSelected(item)}
            className={`w-full flex justify-between px-4 py-3 rounded-xl font-barlow text-sm transition-colors ${selected === item ? 'bg-red-700 text-white' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
          >
            <span>{item.qty}× {item.name}</span>
            <span className="opacity-70">£{((item.price||0)*item.qty).toFixed(2)}</span>
          </button>
        ))}
      </div>
      <div>
        <label className="font-barlow text-zinc-400 text-sm block mb-1">Reason</label>
        <select value={reason} onChange={e => setReason(e.target.value)} className="input-field w-full">
          {VOID_REASONS.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>
      {selected && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">
          <p className="font-barlow text-red-400 text-sm">Void {selected.qty}× {selected.name} · −£{((selected.price||0)*selected.qty).toFixed(2)}</p>
        </div>
      )}
      <button onClick={handleVoid} disabled={!selected || saving}
        className="w-full bg-red-700 hover:bg-red-800 disabled:opacity-40 text-white font-oswald text-lg py-4 rounded-2xl transition-colors flex items-center justify-center gap-2">
        {saving ? <Spinner size="sm" color="white" /> : 'Confirm Void'}
      </button>
    </div>
  )
}

// ─── Split Screen ─────────────────────────────────────────────────────────
function SplitScreen({ table, total, currentVenue, onBack, onPaid }) {
  const [splits, setSplits] = useState(2)
  const [paidCount, setPaidCount] = useState(0)
  const [method, setMethod] = useState('card')
  const [tip, setTip] = useState(0)
  const [paying, setPaying] = useState(false)

  const perPerson = (total + tip) / splits
  const remaining = splits - paidCount

  const payNext = async () => {
    setPaying(true)
    try {
      await supabase.from('payments').insert({ table_number: table.tableNumber, amount: total / splits, tip: tip / splits, method, split_index: paidCount + 1, split_total: splits, staff_name: table.staffName, order_ids: table.orders.map(o => o.id), ...(currentVenue?.id ? { venue_id: currentVenue.id } : {}) })
      const newPaid = paidCount + 1
      setPaidCount(newPaid)
      if (method === 'cash') await openCashDrawer()
      if (newPaid >= splits) {
        const orderIds = table.orders.map(o => o.id)
        await supabase.from('orders').update({ status: 'complete', tab_closed: true, completed_at: new Date().toISOString(), payment_method: 'split' }).in('id', orderIds)
        await supabase.from('order_items_routed').update({ status: 'complete' }).in('order_id', orderIds)
        if (tip > 0) await supabase.from('tips').insert({ table_number: table.tableNumber, staff_name: table.staffName, amount: tip, payment_method: 'split', ...(currentVenue?.id ? { venue_id: currentVenue.id } : {}) })
        onPaid()
      }
    } catch (e) { alert('Payment failed: ' + e.message) }
    finally { setPaying(false) }
  }

  return (
    <div className="p-5 space-y-4 pb-8">
      <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white font-barlow text-sm transition-colors">← Back to bill</button>
      <h3 className="font-oswald text-white text-xl">Split Bill — £{total.toFixed(2)}</h3>

      <div>
        <label className="font-barlow text-zinc-400 text-sm block mb-2">Split between</label>
        <div className="flex gap-2">
          {[2,3,4,5,6].map(n => (
            <button key={n} onClick={() => { setSplits(n); setPaidCount(0) }}
              className={`flex-1 py-3 rounded-xl font-oswald text-xl transition-colors ${splits===n ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>{n}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="font-barlow text-zinc-400 text-sm block mb-2">Tip (total)</label>
        <div className="flex gap-2">
          {[0,2,5,10].map(t => (
            <button key={t} onClick={() => setTip(t)}
              className={`flex-1 py-2.5 rounded-xl font-barlow text-sm transition-colors ${tip===t ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
              {t===0 ? 'None' : `£${t}`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="font-barlow text-zinc-400 text-sm block mb-2">Payment method</label>
        <div className="flex gap-2">
          {['card','cash'].map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={`flex-1 py-3 rounded-xl font-oswald text-lg transition-colors ${method===m ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
              {m === 'cash' ? '💵 Cash' : '💳 Card'}
            </button>
          ))}
        </div>
      </div>

      {paidCount > 0 && (
        <div className="space-y-2">
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 transition-all rounded-full" style={{ width: `${(paidCount/splits)*100}%` }} />
          </div>
          <p className="font-barlow text-green-400 text-sm">{paidCount} of {splits} paid · {remaining} remaining</p>
        </div>
      )}

      <div className="bg-zinc-800 rounded-2xl px-5 py-4 flex justify-between items-center">
        <div>
          <p className="font-barlow text-zinc-400 text-sm">Person {paidCount+1} of {splits}</p>
          <p className="font-barlow text-zinc-500 text-xs">{method}</p>
        </div>
        <span className="font-oswald text-amber-500 text-4xl">£{perPerson.toFixed(2)}</span>
      </div>

      <button onClick={payNext} disabled={paying}
        className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-oswald text-xl py-5 rounded-2xl transition-colors flex items-center justify-center gap-2">
        {paying ? <Spinner size="sm" color="white" /> : `Collect £${perPerson.toFixed(2)}`}
      </button>
    </div>
  )
}
