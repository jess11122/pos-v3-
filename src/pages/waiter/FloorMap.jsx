import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { useRealtime } from '../../hooks/useRealtime'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import { format, addHours } from 'date-fns'

export default function FloorMap({ staff, onTableSelect, onLogout }) {
  const { settings } = useApp()
  const [openTabs, setOpenTabs] = useState({}) // tableNumber -> order[]
  const [readyTables, setReadyTables] = useState(new Set())
  const [bookingSoon, setBookingSoon] = useState(new Set()) // tables with booking in 2h
  const [loading, setLoading] = useState(true)
  const [occupied, setOccupied] = useState({}) // tableNumber -> true
  const [confirmModal, setConfirmModal] = useState(null) // { table, action }

  const floorMap = settings?.floor_map || { tables: [] }
  const tables = floorMap.tables || []

  const loadData = useCallback(async () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const todayStart = today + 'T00:00:00'
    const [ordersRes, bookingsRes, routedRes] = await Promise.all([
      supabase.from('orders').select('id,table_number,total,status,tab_closed,staff_name,created_at').eq('tab_closed', false).eq('status', 'pending').gte('created_at', todayStart),
      supabase.from('bookings').select('table_preference,date,time').eq('date', today).in('status', ['confirmed']),
      // FIX: filter to today only so stale ready items from previous days don't appear
      supabase.from('order_items_routed').select('order_id,status,routed_to').eq('status', 'ready').gte('created_at', todayStart),
    ])

    const tabs = {}
    for (const o of (ordersRes.data || [])) {
      if (!tabs[o.table_number]) tabs[o.table_number] = []
      tabs[o.table_number].push(o)
    }
    setOpenTabs(tabs)

    const occ = {}
    for (const tn of Object.keys(tabs)) occ[tn] = true
    setOccupied(occ)

    // Tables with food ready
    const readyOrderIds = new Set((routedRes.data || []).filter(r => r.status === 'ready').map(r => r.order_id))
    const readyTbs = new Set()
    for (const [tn, orders] of Object.entries(tabs)) {
      if (orders.some(o => readyOrderIds.has(o.id))) readyTbs.add(Number(tn))
    }
    setReadyTables(readyTbs)

    // Bookings in next 2 hours
    const now = new Date()
    const soonSet = new Set()
    for (const b of (bookingsRes.data || [])) {
      if (!b.table_preference) continue
      const [h, m] = b.time.split(':').map(Number)
      const bookingTime = new Date(today)
      bookingTime.setHours(h, m, 0, 0)
      const diff = (bookingTime - now) / 60000 // minutes
      if (diff > 0 && diff <= 120) soonSet.add(Number(b.table_preference))
    }
    setBookingSoon(soonSet)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useRealtime('orders', loadData)
  useRealtime('order_items_routed', loadData)

  const getTableColour = (table) => {
    const tn = table.number
    if (occupied[tn]) return { bg: '#dc2626', label: 'Occupied', text: 'text-white' }
    if (bookingSoon.has(tn)) return { bg: '#7c3aed', label: 'Booking soon', text: 'text-white' }
    return { bg: '#16a34a', label: 'Free', text: 'text-white' }
  }

  const handleTableTap = (table) => {
    const tn = table.number
    if (occupied[tn]) {
      setConfirmModal({ table })
    } else {
      onTableSelect(table, 'new')
    }
  }

  const handleCloseTab = async (table) => {
    setConfirmModal(null)
    // Navigate to tables page logic — just go to live tables in context
    onTableSelect(table, 'close')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>
  )

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      <header className="bg-zinc-900 px-5 py-4 flex items-center justify-between border-b border-zinc-800">
        <div>
          <h1 className="font-oswald text-2xl text-white">Floor Map</h1>
          <p className="font-barlow text-zinc-400 text-base">
            Tap a table to start an order
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="font-barlow text-sm px-3 py-1 rounded-full text-white"
            style={{ backgroundColor: staff.colour || '#d97706' }}
          >
            {staff.name}
          </div>
          <button onClick={onLogout} className="font-barlow text-zinc-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
            Switch
          </button>
        </div>
      </header>

      {/* Legend */}
      <div className="flex gap-4 px-5 py-3 border-b border-zinc-800">
        {[
          { colour: '#16a34a', label: 'Free' },
          { colour: '#dc2626', label: 'Occupied' },
          { colour: '#7c3aed', label: 'Booking soon' },
          { colour: '#d97706', label: 'Selected' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: l.colour }} />
            <span className="font-barlow text-zinc-400 text-sm">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Floor grid */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="relative w-full" style={{ paddingBottom: '70%', minHeight: 400 }}>
          <div className="absolute inset-0">
            {tables.map(table => {
              const colour = getTableColour(table)
              const isReady = readyTables.has(table.number)
              const tabOrders = openTabs[table.number] || []
              const total = tabOrders.reduce((s, o) => s + (o.total || 0), 0)
              return (
                <button
                  key={table.id}
                  onClick={() => handleTableTap(table)}
                  className="absolute rounded-2xl flex flex-col items-center justify-center touch-btn shadow-lg active:scale-95 transition-all hover:brightness-110"
                  style={{
                    left: `${table.x}%`,
                    top: `${table.y}%`,
                    width: `${table.w || 14}%`,
                    height: `${table.h || 12}%`,
                    minWidth: 70,
                    minHeight: 70,
                    backgroundColor: colour.bg,
                    boxShadow: isReady ? '0 0 0 3px #22c55e, 0 0 12px #22c55e80' : undefined,
                  }}
                >
                  <span className="font-oswald text-white text-lg leading-none">{table.number}</span>
                  {tabOrders.length > 0 && (
                    <span className="font-barlow text-white/80 text-xs">£{total.toFixed(2)}</span>
                  )}
                  {isReady && (
                    <span className="font-barlow text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full mt-0.5">READY</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {tables.length === 0 && (
          <div className="flex items-center justify-center h-64 text-zinc-500 font-barlow text-lg">
            No tables configured. Go to Admin → Tables to set up your floor map.
          </div>
        )}
      </div>

      {/* Summary bar */}
      <div className="bg-zinc-900 px-5 py-3 border-t border-zinc-800 flex gap-6">
        <div className="font-barlow text-zinc-400 text-sm">
          <span className="text-white font-semibold">{Object.keys(occupied).length}</span> tables open
        </div>
        <div className="font-barlow text-zinc-400 text-sm">
          <span className="text-green-400 font-semibold">{tables.length - Object.keys(occupied).length}</span> free
        </div>
        {readyTables.size > 0 && (
          <div className="font-barlow text-green-400 text-sm font-semibold animate-pulse">
            🍽 {readyTables.size} table{readyTables.size > 1 ? 's' : ''} READY
          </div>
        )}
      </div>

      {/* Occupied table modal */}
      {confirmModal && (
        <Modal title={`Table ${confirmModal.table.number}`} onClose={() => setConfirmModal(null)} size="sm">
          <div className="space-y-3">
            <p className="font-barlow text-zinc-300 text-base">This table has an open tab. What would you like to do?</p>
            {(openTabs[confirmModal.table.number] || []).length > 0 && (
              <div className="bg-zinc-700 rounded-xl p-3">
                <p className="font-barlow text-zinc-400 text-sm">
                  {(openTabs[confirmModal.table.number] || []).length} order(s) · Total: £{(openTabs[confirmModal.table.number] || []).reduce((s, o) => s + (o.total || 0), 0).toFixed(2)}
                </p>
                <p className="font-barlow text-zinc-500 text-xs mt-1">
                  Staff: {openTabs[confirmModal.table.number]?.[0]?.staff_name}
                </p>
              </div>
            )}
            <button
              onClick={() => { setConfirmModal(null); onTableSelect(confirmModal.table, 'add') }}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-oswald text-lg py-4 rounded-xl transition-colors"
            >
              Add to Tab
            </button>
            <button
              onClick={() => handleCloseTab(confirmModal.table)}
              className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-oswald text-lg py-4 rounded-xl transition-colors"
            >
              Close Tab
            </button>
            <button onClick={() => setConfirmModal(null)} className="w-full text-zinc-400 font-barlow py-2 hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
