import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format, subDays } from 'date-fns'
import { SkeletonTable } from '../../components/ui/Skeleton'

function fmt(n) { return `£${(n || 0).toFixed(2)}` }

export default function ReceiptsAdmin() {
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('receipts')
      .select('*')
      .gte('sent_at', dateFrom + 'T00:00:00')
      .lte('sent_at', dateTo + 'T23:59:59')
      .order('sent_at', { ascending: false })
      .limit(300)
    setReceipts(data || [])
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const filtered = search
    ? receipts.filter(r => r.email?.toLowerCase().includes(search.toLowerCase()) || String(r.table_number).includes(search))
    : receipts

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5">
      <div className="bg-zinc-800 rounded-2xl p-5">
        <h2 className="font-oswald text-white text-xl">Digital Receipts</h2>
        <p className="font-barlow text-zinc-400 text-sm mt-1">All receipts sent to customers — searchable and resendable</p>
      </div>

      <div className="bg-zinc-800 rounded-2xl p-5 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field w-full" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Search email / table</label>
            <input value={search} onChange={e => setSearch(e.target.value)} className="input-field w-full" placeholder="jane@example.com or 5" />
          </div>
        </div>
        <p className="font-barlow text-zinc-500 text-xs">{filtered.length} receipts found</p>
      </div>

      {selected && (
        <div className="bg-zinc-800 rounded-2xl p-5 space-y-4 border border-amber-700/30">
          <div className="flex items-center justify-between">
            <h3 className="font-oswald text-white text-lg">Receipt #{selected.id?.slice(0, 8)}</h3>
            <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white font-barlow text-sm">✕ Close</button>
          </div>
          <div className="bg-zinc-900 rounded-xl p-5 font-mono text-sm space-y-2">
            <p className="font-oswald text-amber-400 text-center text-xl tracking-wider">{selected.venue_name || 'TabFlow POS'}</p>
            <p className="text-zinc-500 text-center text-xs">{selected.sent_at ? format(new Date(selected.sent_at), 'dd MMMM yyyy, HH:mm') : ''}</p>
            <p className="text-zinc-500 text-center text-xs">Table {selected.table_number}</p>
            <div className="border-t border-zinc-700 my-2" />
            {(selected.items || []).map((item, i) => (
              <div key={i} className="flex justify-between text-zinc-300">
                <span>{item.qty > 1 ? `${item.name} ×${item.qty}` : item.name}</span>
                <span>{fmt((item.price || 0) * (item.qty || 1))}</span>
              </div>
            ))}
            <div className="border-t border-zinc-700 my-2" />
            <div className="flex justify-between text-white font-bold"><span>Total</span><span>{fmt(selected.total)}</span></div>
            {selected.tip > 0 && <div className="flex justify-between text-green-400"><span>Tip</span><span>{fmt(selected.tip)}</span></div>}
            <div className="flex justify-between text-zinc-500 text-xs"><span>Payment</span><span>{selected.payment_method || '—'}</span></div>
            <div className="border-t border-zinc-700 my-2" />
            <p className="text-zinc-600 text-xs text-center">Powered by TabFlow POS</p>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={6} />
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-800 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">🧾</div>
          <p className="font-oswald text-zinc-400 text-lg">No receipts in this period</p>
          <p className="font-barlow text-zinc-600 text-sm mt-1">Receipts are sent when staff opt customers in at payment</p>
        </div>
      ) : (
        <div className="bg-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-900/50 border-b border-zinc-700">
              <tr>
                {['Sent', 'Table', 'Email', 'Total', 'Payment', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-barlow text-zinc-500 text-xs uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700/50">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-zinc-700/20 transition-colors">
                  <td className="px-4 py-3 font-barlow text-zinc-400 text-xs whitespace-nowrap">
                    {r.sent_at ? format(new Date(r.sent_at), 'dd/MM HH:mm') : '—'}
                  </td>
                  <td className="px-4 py-3 font-oswald text-white">T{r.table_number}</td>
                  <td className="px-4 py-3 font-barlow text-zinc-300 text-sm">{r.email || '—'}</td>
                  <td className="px-4 py-3 font-oswald text-amber-400">{fmt(r.total)}</td>
                  <td className="px-4 py-3 font-barlow text-zinc-400 text-sm capitalize">{r.payment_method || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(r)}
                      className="font-barlow text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
