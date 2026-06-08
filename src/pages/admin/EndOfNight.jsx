import { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { format } from 'date-fns'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'

export default function EndOfNight() {
  const { settings } = useApp()
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(null)
  const [copied, setCopied] = useState(false)

  const generateReport = useCallback(async () => {
    setLoading(true)
    const today = format(new Date(), 'yyyy-MM-dd')

    const [ordersRes, tipsRes] = await Promise.all([
      supabase.from('orders').select('*').gte('created_at', today + 'T00:00:00').eq('status', 'complete'),
      supabase.from('tips').select('*').gte('created_at', today + 'T00:00:00'),
    ])

    const orders = ordersRes.data || []
    const tips = tipsRes.data || []

    const revenue = orders.reduce((s, o) => s + (o.total || 0), 0)
    const tipsTotal = tips.reduce((s, t) => s + (t.amount || 0), 0)

    // Covers (party sizes aren't tracked in orders; estimate from unique tables)
    const uniqueTables = new Set(orders.map(o => o.table_number)).size
    const avgSpend = orders.length > 0 ? revenue / orders.length : 0

    // Busiest table
    const byTable = orders.reduce((acc, o) => {
      acc[o.table_number] = (acc[o.table_number] || 0) + (o.total || 0)
      return acc
    }, {})
    const busiestTable = Object.entries(byTable).sort(([,a],[,b]) => b - a)[0]

    // Most ordered item
    const itemCounts = {}
    for (const o of orders) {
      for (const item of (o.items || [])) {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.qty || 1)
      }
    }
    const topItem = Object.entries(itemCounts).sort(([,a],[,b]) => b - a)[0]

    // Staff tips breakdown
    const staffTips = tips.reduce((acc, t) => {
      if (!acc[t.staff_name]) acc[t.staff_name] = 0
      acc[t.staff_name] += t.amount || 0
      return acc
    }, {})

    setReport({
      date: format(new Date(), 'EEEE d MMMM yyyy'),
      revenue, tipsTotal, combined: revenue + tipsTotal,
      orderCount: orders.length,
      uniqueTables,
      avgSpend,
      busiestTable: busiestTable ? `Table ${busiestTable[0]} (£${parseFloat(busiestTable[1]).toFixed(2)})` : 'N/A',
      topItem: topItem ? `${topItem[0]} (×${topItem[1]})` : 'N/A',
      staffTips,
      venueName: settings?.venue_name || 'Venue',
    })
    setLoading(false)
  }, [settings])

  const reportText = report ? `
END OF NIGHT SUMMARY — ${report.venueName}
${report.date}
${'='.repeat(40)}

Revenue:    £${report.revenue.toFixed(2)}
Tips:       £${report.tipsTotal.toFixed(2)}
Combined:   £${report.combined.toFixed(2)}

Orders:     ${report.orderCount}
Tables:     ${report.uniqueTables}
Avg Spend:  £${report.avgSpend.toFixed(2)}

Busiest Table: ${report.busiestTable}
Top Item:      ${report.topItem}

STAFF TIPS
${Object.entries(report.staffTips).sort(([,a],[,b]) => b - a).map(([n, a]) => `  ${n}: £${a.toFixed(2)}`).join('\n') || '  No tips recorded'}
`.trim() : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-5 max-w-2xl mx-auto space-y-5">
      <div className="bg-zinc-800 rounded-2xl p-5">
        <h2 className="font-oswald text-2xl text-white mb-1">🌙 End of Night</h2>
        <p className="font-barlow text-zinc-400">Generate today's summary report</p>
      </div>

      <button
        onClick={generateReport}
        disabled={loading}
        className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald text-xl py-5 rounded-2xl transition-colors flex items-center justify-center gap-3"
      >
        {loading ? <Spinner size="sm" color="white" /> : '📊'} Generate Report
      </button>

      {report && (
        <div className="bg-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-oswald text-white text-xl">{report.date}</h3>
            <button onClick={handleCopy} className="font-barlow text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-4 py-2 rounded-xl transition-colors">
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatBox label="Revenue" value={`£${report.revenue.toFixed(2)}`} colour="text-amber-500" />
            <StatBox label="Tips" value={`£${report.tipsTotal.toFixed(2)}`} colour="text-green-400" />
            <StatBox label="Combined" value={`£${report.combined.toFixed(2)}`} colour="text-white" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Orders" value={report.orderCount} colour="text-white" />
            <StatBox label="Tables Served" value={report.uniqueTables} colour="text-white" />
            <StatBox label="Avg per Order" value={`£${report.avgSpend.toFixed(2)}`} colour="text-zinc-300" />
            <StatBox label="Top Item" value={report.topItem} colour="text-zinc-300" small />
          </div>

          <div>
            <h4 className="font-oswald text-zinc-300 text-base mb-2">Busiest Table</h4>
            <p className="font-barlow text-white">{report.busiestTable}</p>
          </div>

          <div>
            <h4 className="font-oswald text-zinc-300 text-base mb-2">Staff Tips Breakdown</h4>
            {Object.keys(report.staffTips).length === 0 ? (
              <p className="font-barlow text-zinc-500 text-sm">No tips recorded today</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(report.staffTips).sort(([,a],[,b]) => b - a).map(([name, amount]) => (
                  <div key={name} className="flex justify-between bg-zinc-700 rounded-xl px-3 py-2">
                    <span className="font-barlow text-white">{name}</span>
                    <span className="font-oswald text-amber-500">£{amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Export as text (PDF generation requires external lib) */}
          <div className="bg-zinc-900 rounded-xl p-4">
            <pre className="font-mono text-zinc-400 text-xs whitespace-pre-wrap">{reportText}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, colour, small }) {
  return (
    <div className="bg-zinc-700 rounded-xl p-3 text-center">
      <p className="font-barlow text-zinc-400 text-xs mb-1">{label}</p>
      <p className={`font-oswald ${small ? 'text-base' : 'text-xl'} ${colour}`}>{value}</p>
    </div>
  )
}
