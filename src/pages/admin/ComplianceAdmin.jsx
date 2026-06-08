import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format, subDays } from 'date-fns'
import { SkeletonTable } from '../../components/ui/Skeleton'

const ALLERGEN_COLOURS = {
  gluten: 'bg-yellow-900/40 text-yellow-300',
  crustaceans: 'bg-red-900/40 text-red-300',
  eggs: 'bg-orange-900/40 text-orange-300',
  fish: 'bg-blue-900/40 text-blue-300',
  peanuts: 'bg-amber-900/40 text-amber-300',
  soybeans: 'bg-green-900/40 text-green-300',
  milk: 'bg-indigo-900/40 text-indigo-300',
  nuts: 'bg-purple-900/40 text-purple-300',
  celery: 'bg-lime-900/40 text-lime-300',
  mustard: 'bg-yellow-900/40 text-yellow-200',
  sesame: 'bg-orange-900/40 text-orange-200',
  sulphites: 'bg-pink-900/40 text-pink-300',
  lupin: 'bg-violet-900/40 text-violet-300',
  molluscs: 'bg-cyan-900/40 text-cyan-300',
}

export default function ComplianceAdmin() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [allergenFilter, setAllergenFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('compliance_log')
      .select('*')
      .gte('created_at', dateFrom + 'T00:00:00')
      .lte('created_at', dateTo + 'T23:59:59')
      .order('created_at', { ascending: false })
      .limit(500)
    setLogs(data || [])
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const filtered = allergenFilter
    ? logs.filter(l => l.allergens?.some(a => a.toLowerCase().includes(allergenFilter.toLowerCase())))
    : logs

  const exportCSV = () => {
    const rows = [
      ['Timestamp', 'Table', 'Staff', 'Allergens', 'Items', 'ID Checked'],
      ...filtered.map(l => [
        format(new Date(l.created_at), 'dd/MM/yyyy HH:mm'),
        l.table_number,
        l.staff_name || '—',
        (l.allergens || []).join('; '),
        (l.items || []).map(i => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}`).join('; '),
        l.id_checked ? 'Yes' : 'No',
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `allergen-compliance-${dateFrom}-to-${dateTo}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5">
      <div className="bg-zinc-800 rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-oswald text-white text-xl">Allergen Compliance Log</h2>
            <p className="font-barlow text-zinc-400 text-sm mt-1">Natasha's Law audit trail — EHO ready</p>
          </div>
          <span className="bg-green-900/30 border border-green-700/40 text-green-400 text-xs font-barlow px-3 py-1 rounded-full">Legal Protection</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="label">Allergen filter</label>
            <input value={allergenFilter} onChange={e => setAllergenFilter(e.target.value)} className="input-field w-full" placeholder="e.g. nuts" />
          </div>
          <div className="flex flex-col justify-end">
            <button onClick={exportCSV} disabled={filtered.length === 0} className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white font-barlow text-sm px-4 py-2.5 rounded-xl transition-colors">
              📥 Export CSV
            </button>
          </div>
        </div>
        <p className="font-barlow text-zinc-500 text-xs">{filtered.length} records in selected range</p>
      </div>

      {/* Log table */}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-800 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="font-oswald text-zinc-400 text-lg">No allergen orders in this period</p>
          <p className="font-barlow text-zinc-600 text-sm mt-1">Allergen orders are logged automatically when staff declare them at order time</p>
        </div>
      ) : (
        <div className="bg-zinc-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-900/50 border-b border-zinc-700">
                <tr>
                  {['Time', 'Table', 'Staff', 'Allergens', 'Items', 'ID?'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-barlow text-zinc-500 text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/50">
                {filtered.map(l => (
                  <tr key={l.id} className="hover:bg-zinc-700/20 transition-colors">
                    <td className="px-4 py-3 font-barlow text-zinc-400 text-xs whitespace-nowrap">
                      {format(new Date(l.created_at), 'dd/MM HH:mm')}
                    </td>
                    <td className="px-4 py-3 font-oswald text-white text-sm">T{l.table_number}</td>
                    <td className="px-4 py-3 font-barlow text-zinc-300 text-sm whitespace-nowrap">{l.staff_name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(l.allergens || []).map(a => (
                          <span key={a} className={`text-xs px-2 py-0.5 rounded-full font-barlow capitalize ${ALLERGEN_COLOURS[a] || 'bg-zinc-700 text-zinc-300'}`}>{a}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-barlow text-zinc-400 text-xs max-w-xs">
                      {(l.items || []).slice(0, 3).map(i => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ')}
                      {(l.items || []).length > 3 && ` +${l.items.length - 3} more`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-barlow text-xs px-2 py-1 rounded-full ${l.id_checked ? 'bg-green-900/40 text-green-400' : 'bg-zinc-700 text-zinc-500'}`}>
                        {l.id_checked ? '✓' : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-4">
        <p className="font-barlow text-zinc-500 text-xs leading-relaxed">
          <strong className="text-zinc-400">Natasha's Law (2021)</strong> — All pre-packed food must carry full allergen labelling.
          This log provides evidence that allergen information was communicated to customers at point of order.
          Export and retain records for EHO inspections. TabFlow logs all 14 EU-regulated allergens automatically.
        </p>
      </div>
    </div>
  )
}
