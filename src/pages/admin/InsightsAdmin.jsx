import { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns'
import Spinner from '../../components/ui/Spinner'
import { SkeletonCard } from '../../components/ui/Skeleton'

const ANTHROPIC_MODEL = 'claude-opus-4-8'

function fmt(n) { return `£${(n || 0).toFixed(2)}` }
function pct(a, b) {
  if (!b) return '+100%'
  const change = ((a - b) / b) * 100
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
}

export default function InsightsAdmin() {
  const { settings } = useApp()
  const [report, setReport] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [apiKey, setApiKey] = useState(settings?.anthropic_api_key || '')
  const [savingKey, setSavingKey] = useState(false)

  const saveApiKey = async () => {
    setSavingKey(true)
    await supabase.from('settings').update({ anthropic_api_key: apiKey }).eq('id', settings.id)
    setSavingKey(false)
  }

  const generateReport = useCallback(async () => {
    const key = settings?.anthropic_api_key || apiKey
    if (!key) return setError('Add your Anthropic API key below to generate AI reports')
    setGenerating(true)
    setError('')

    try {
      // Gather last 2 weeks of data
      const thisWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const lastWeekStart = format(startOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const lastWeekEnd = format(endOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd')

      const [thisWeekRes, lastWeekRes, tipsRes] = await Promise.all([
        supabase.from('orders').select('total,status,items,staff_name,table_number,created_at').gte('created_at', thisWeekStart + 'T00:00:00').eq('status', 'complete'),
        supabase.from('orders').select('total,status,items,staff_name,table_number,created_at').gte('created_at', lastWeekStart + 'T00:00:00').lte('created_at', lastWeekEnd + 'T23:59:59').eq('status', 'complete'),
        supabase.from('tips').select('amount,staff_name,created_at').gte('created_at', thisWeekStart + 'T00:00:00'),
      ])

      const thisWeek = thisWeekRes.data || []
      const lastWeek = lastWeekRes.data || []
      const tips = tipsRes.data || []

      // Compute stats
      const thisRevenue = thisWeek.reduce((s, o) => s + (o.total || 0), 0)
      const lastRevenue = lastWeek.reduce((s, o) => s + (o.total || 0), 0)

      // By day
      const byDay = {}
      for (const o of thisWeek) {
        const day = format(new Date(o.created_at), 'EEEE')
        byDay[day] = (byDay[day] || 0) + (o.total || 0)
      }
      const bestDay = Object.entries(byDay).sort(([,a],[,b]) => b-a)[0]
      const worstDay = Object.entries(byDay).sort(([,a],[,b]) => a-b)[0]

      // By hour
      const byHour = {}
      for (const o of thisWeek) {
        const h = new Date(o.created_at).getHours()
        byHour[h] = (byHour[h] || 0) + 1
      }
      const busiestHour = Object.entries(byHour).sort(([,a],[,b]) => b-a)[0]

      // Items
      const itemCounts = {}
      for (const o of [...thisWeek]) {
        for (const item of (o.items || [])) {
          itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.qty || 1)
        }
      }
      const sortedItems = Object.entries(itemCounts).sort(([,a],[,b]) => b-a)
      const topItem = sortedItems[0]
      const bottomItem = sortedItems[sortedItems.length - 1]

      // Staff
      const staffOrders = {}
      for (const o of thisWeek) {
        if (o.staff_name) staffOrders[o.staff_name] = (staffOrders[o.staff_name] || 0) + 1
      }
      const staffTips = {}
      for (const t of tips) {
        if (t.staff_name) staffTips[t.staff_name] = (staffTips[t.staff_name] || 0) + (t.amount || 0)
      }

      const avgSpendThis = thisWeek.length > 0 ? thisRevenue / thisWeek.length : 0
      const avgSpendLast = lastWeek.length > 0 ? lastRevenue / lastWeek.length : 0
      const tipsTotal = tips.reduce((s, t) => s + (t.amount || 0), 0)
      const topTipper = Object.entries(staffTips).sort(([,a],[,b]) => b-a)[0]

      const statsForAI = {
        venueName: settings?.venue_name,
        period: `w/c ${thisWeekStart}`,
        thisWeekRevenue: fmt(thisRevenue),
        lastWeekRevenue: fmt(lastRevenue),
        revenueChange: pct(thisRevenue, lastRevenue),
        ordersThisWeek: thisWeek.length,
        bestDay: bestDay ? `${bestDay[0]} (${fmt(bestDay[1])})` : 'N/A',
        worstDay: worstDay ? `${worstDay[0]} (${fmt(worstDay[1])})` : 'N/A',
        busiestHour: busiestHour ? `${busiestHour[0]}:00–${parseInt(busiestHour[0])+1}:00` : 'N/A',
        topItem: topItem ? `${topItem[0]} (${topItem[1]} sold)` : 'N/A',
        slowItem: bottomItem ? `${bottomItem[0]} (${bottomItem[1]} sold)` : 'N/A',
        avgSpendThis: fmt(avgSpendThis),
        avgSpendLast: fmt(avgSpendLast),
        avgSpendTrend: avgSpendThis >= avgSpendLast ? 'up' : 'down',
        tipsTotal: fmt(tipsTotal),
        topTipper: topTipper ? `${topTipper[0]} (${fmt(topTipper[1])})` : 'N/A',
        topStaff: Object.entries(staffOrders).sort(([,a],[,b]) => b-a).slice(0,3).map(([n,c]) => `${n}: ${c} orders`).join(', '),
        byDay: Object.entries(byDay).map(([d,r]) => `${d}: ${fmt(r)}`).join(', '),
      }

      // Call Claude
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `You are a friendly hospitality business consultant writing a weekly performance review for ${statsForAI.venueName}.

Here is this week's data:
${JSON.stringify(statsForAI, null, 2)}

Write a concise, upbeat weekly report with these sections:
1. **Weekly Summary** (2-3 sentences overview)
2. **Revenue** (revenue vs last week, what the change means)
3. **Best & Worst Days** (brief insight)
4. **Menu Performance** (top seller celebration, slow mover suggestion)
5. **Team Performance** (who is leading, encouragement)
6. **Average Spend** (trend and what it means)
7. **💡 Recommendations** (3 specific, actionable suggestions based on the data)

Tone: warm, professional, encouraging. Use British English. Format with markdown headers.`,
          }],
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error?.message || `API error ${res.status}`)
      }
      const aiData = await res.json()
      const aiText = aiData.content?.[0]?.text || ''

      setReport({ stats: statsForAI, aiText, generatedAt: new Date().toLocaleString('en-GB') })
    } catch (e) {
      setError(`Failed to generate report: ${e.message}`)
    } finally {
      setGenerating(false)
    }
  }, [settings, apiKey])

  const copyReport = () => {
    if (!report) return
    navigator.clipboard.writeText(`TabFlow Weekly Insights — ${report.stats.venueName}\nGenerated: ${report.generatedAt}\n\n${report.aiText}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-5">
      <div className="bg-zinc-800 rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-oswald text-white text-xl">TabFlow Insights</h2>
            <p className="font-barlow text-zinc-400 text-sm mt-1">AI-powered weekly performance report — powered by Claude</p>
          </div>
          <span className="bg-amber-600/20 border border-amber-600/40 text-amber-400 text-xs font-barlow px-3 py-1 rounded-full">AI</span>
        </div>
      </div>

      {/* API Key setup */}
      {!settings?.anthropic_api_key && (
        <div className="bg-zinc-800 rounded-2xl p-5 space-y-3 border border-amber-700/30">
          <h3 className="font-oswald text-white text-lg">Setup — Anthropic API Key</h3>
          <p className="font-barlow text-zinc-400 text-sm">Get a key at console.anthropic.com. Reports are generated using Claude Opus.</p>
          <div className="flex gap-3">
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="input-field flex-1 font-mono text-sm"
              placeholder="sk-ant-..."
            />
            <button onClick={saveApiKey} disabled={savingKey || !apiKey} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald px-4 py-2 rounded-xl transition-colors">
              {savingKey ? <Spinner size="sm" color="white" /> : 'Save'}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={generateReport}
        disabled={generating}
        className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald text-lg py-4 rounded-2xl transition-colors flex items-center justify-center gap-3"
      >
        {generating ? <><Spinner size="sm" color="white" /> Generating report…</> : '✨ Generate Weekly Report'}
      </button>

      {error && <div className="bg-red-900/30 border border-red-800 rounded-2xl p-4 font-barlow text-red-400 text-sm">{error}</div>}

      {generating && (
        <div className="space-y-4">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={3} />
        </div>
      )}

      {report && !generating && (
        <div className="bg-zinc-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-oswald text-white text-xl">{report.stats.venueName} — Weekly Report</h3>
              <p className="font-barlow text-zinc-500 text-xs mt-0.5">Generated {report.generatedAt}</p>
            </div>
            <button onClick={copyReport} className="font-barlow text-xs px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-xl transition-colors">
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'This Week', value: report.stats.thisWeekRevenue, sub: report.stats.revenueChange },
              { label: 'vs Last Week', value: report.stats.lastWeekRevenue, sub: '' },
              { label: 'Best Day', value: report.stats.bestDay?.split(' (')[0] || '—', sub: '' },
              { label: 'Tips Total', value: report.stats.tipsTotal, sub: '' },
            ].map(s => (
              <div key={s.label} className="bg-zinc-700/50 rounded-xl p-3 text-center">
                <div className="font-barlow text-zinc-500 text-xs mb-1">{s.label}</div>
                <div className="font-oswald text-white text-lg">{s.value}</div>
                {s.sub && <div className={`font-barlow text-xs ${s.sub.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>{s.sub}</div>}
              </div>
            ))}
          </div>

          {/* AI narrative */}
          <div className="prose prose-invert max-w-none font-barlow text-zinc-300 text-sm leading-relaxed space-y-3">
            {report.aiText.split('\n').map((line, i) => {
              if (line.startsWith('## ') || line.startsWith('**') && line.endsWith('**')) {
                return <h4 key={i} className="font-oswald text-white text-base mt-4 mb-1">{line.replace(/^##?\s*/, '').replace(/\*\*/g, '')}</h4>
              }
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return <li key={i} className="ml-4 text-zinc-300">{line.slice(2)}</li>
              }
              if (!line.trim()) return null
              return <p key={i} className="text-zinc-300">{line.replace(/\*\*/g, '')}</p>
            })}
          </div>

          <div className="border-t border-zinc-700 pt-4 flex items-center gap-2">
            <span className="text-zinc-600 text-xs font-barlow">Powered by</span>
            <span className="text-amber-500 text-xs font-oswald tracking-wider">TABFLOW INSIGHTS × CLAUDE</span>
          </div>
        </div>
      )}
    </div>
  )
}
