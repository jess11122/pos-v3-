import { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import Spinner from '../../components/ui/Spinner'
import { openCashDrawer } from '../../lib/printer'

export default function TablesAdmin() {
  const { settings, refreshSettings } = useApp()
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [openingDrawer, setOpeningDrawer] = useState(false)
  const [tableCount, setTableCount] = useState(settings?.table_count || 10)
  const [drawerMsg, setDrawerMsg] = useState('')

  const floorMap = settings?.floor_map || { tables: [] }
  const tables = floorMap.tables || []

  const handleSaveCount = async () => {
    setSaving(true)
    const count = parseInt(tableCount)
    const existingTables = tables.filter(t => t.number <= count)
    const newTables = Array.from({ length: count }, (_, i) => {
      const existing = tables.find(t => t.number === i + 1)
      return existing || {
        id: i + 1, number: i + 1,
        x: (i % 5) * 18 + 2, y: Math.floor(i / 5) * 35 + 10,
        w: 14, h: 12, seats: 4,
      }
    })
    await supabase.from('settings').update({ table_count: count, floor_map: { tables: newTables } }).eq('id', settings.id)
    await refreshSettings()
    setSaving(false)
  }

  const handleClearOrders = async () => {
    if (!confirm('⚠ This will permanently delete ALL pending orders. This cannot be undone. Continue?')) return
    if (!confirm('Are you absolutely sure? All open tabs will be deleted.')) return
    setClearing(true)
    await supabase.from('order_items_routed').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setClearing(false)
    alert('All orders cleared.')
  }

  const handleOpenDrawer = async () => {
    setOpeningDrawer(true)
    const ok = await openCashDrawer()
    setDrawerMsg(ok ? '✓ Drawer opened' : 'No printer connected')
    setOpeningDrawer(false)
    setTimeout(() => setDrawerMsg(''), 2000)
  }

  const updateTablePosition = async (tableId, updates) => {
    const newTables = tables.map(t => t.id === tableId ? { ...t, ...updates } : t)
    await supabase.from('settings').update({ floor_map: { tables: newTables } }).eq('id', settings.id)
    await refreshSettings()
  }

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-6">
      {/* Table count */}
      <div className="bg-zinc-800 rounded-2xl p-5">
        <h3 className="font-oswald text-white text-lg mb-3">Table Count</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="label">Number of Tables</label>
            <input type="number" min={1} max={100} value={tableCount} onChange={e => setTableCount(e.target.value)} className="input-field w-full" />
          </div>
          <button onClick={handleSaveCount} disabled={saving} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald px-5 py-3 rounded-xl transition-colors flex items-center gap-2">
            {saving ? <Spinner size="sm" color="white" /> : 'Save'}
          </button>
        </div>
      </div>

      {/* Floor map editor */}
      <div className="bg-zinc-800 rounded-2xl p-5">
        <h3 className="font-oswald text-white text-lg mb-3">Floor Map ({tables.length} tables)</h3>
        <p className="font-barlow text-zinc-400 text-sm mb-4">Adjust table positions using the X/Y fields below (percentage of map area).</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {tables.map(t => (
            <div key={t.id} className="flex items-center gap-3 bg-zinc-700 rounded-xl px-3 py-2">
              <span className="font-oswald text-white w-16">T{t.number}</span>
              <div className="flex gap-2 flex-1">
                <div className="flex-1">
                  <label className="font-barlow text-zinc-500 text-xs">X%</label>
                  <input type="number" min={0} max={85} value={Math.round(t.x)} onChange={e => updateTablePosition(t.id, { x: parseFloat(e.target.value) })} className="input-field w-full text-sm py-1" />
                </div>
                <div className="flex-1">
                  <label className="font-barlow text-zinc-500 text-xs">Y%</label>
                  <input type="number" min={0} max={85} value={Math.round(t.y)} onChange={e => updateTablePosition(t.id, { y: parseFloat(e.target.value) })} className="input-field w-full text-sm py-1" />
                </div>
                <div className="flex-1">
                  <label className="font-barlow text-zinc-500 text-xs">Seats</label>
                  <input type="number" min={1} max={20} value={t.seats || 4} onChange={e => updateTablePosition(t.id, { seats: parseInt(e.target.value) })} className="input-field w-full text-sm py-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hardware */}
      <div className="bg-zinc-800 rounded-2xl p-5">
        <h3 className="font-oswald text-white text-lg mb-3">Hardware</h3>
        <button
          onClick={handleOpenDrawer}
          disabled={openingDrawer}
          className="bg-zinc-700 hover:bg-zinc-600 text-white font-oswald px-5 py-3 rounded-xl transition-colors flex items-center gap-2"
        >
          {openingDrawer ? <Spinner size="sm" /> : '🔓'} Open Cash Drawer
        </button>
        {drawerMsg && <p className="font-barlow text-zinc-400 text-sm mt-2">{drawerMsg}</p>}
      </div>

      {/* Danger zone */}
      <div className="bg-red-900/20 border border-red-800 rounded-2xl p-5">
        <h3 className="font-oswald text-red-400 text-lg mb-3">⚠ Danger Zone</h3>
        <p className="font-barlow text-zinc-400 text-sm mb-4">Permanently delete all orders and open tabs. Use at start of day or for testing only.</p>
        <button
          onClick={handleClearOrders}
          disabled={clearing}
          className="bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-oswald px-5 py-3 rounded-xl transition-colors flex items-center gap-2"
        >
          {clearing ? <Spinner size="sm" color="white" /> : '🗑 Clear All Orders'}
        </button>
      </div>
    </div>
  )
}
