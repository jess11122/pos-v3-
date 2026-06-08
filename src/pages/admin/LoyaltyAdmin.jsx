import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { format } from 'date-fns'
import Spinner from '../../components/ui/Spinner'
import { SkeletonCard } from '../../components/ui/Skeleton'

export default function LoyaltyAdmin() {
  const { settings, updateSettings } = useApp()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, active: 0, redemptions: 0 })

  const defaultConfig = { enabled: false, stamps_required: 10, reward: '1 free coffee', reward_category: '' }
  const [config, setConfig] = useState(settings?.loyalty || defaultConfig)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('loyalty_stamps')
      .select('*')
      .order('last_stamp', { ascending: false })
      .limit(200)
    const rows = data || []
    setMembers(rows)
    setStats({
      total: rows.length,
      active: rows.filter(r => r.stamp_count > 0).length,
      redemptions: rows.reduce((s, r) => s + (r.reward_redeemed || 0), 0),
    })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveConfig = async () => {
    setSaving(true)
    await updateSettings({ loyalty: config })
    setMsg('✓ Saved')
    setTimeout(() => setMsg(''), 2000)
    setSaving(false)
  }

  const stampPercent = (count) => Math.min(100, Math.round((count / (config.stamps_required || 10)) * 100))

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-5">
      <div className="bg-zinc-800 rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-oswald text-white text-xl">TabFlow Loyalty</h2>
            <p className="font-barlow text-zinc-400 text-sm mt-1">Digital stamp card — builds your customer base automatically</p>
          </div>
          <button
            onClick={() => setConfig(p => ({ ...p, enabled: !p.enabled }))}
            className={`px-4 py-2 rounded-xl font-barlow text-sm transition-colors ${config.enabled ? 'bg-amber-600 text-white' : 'bg-zinc-700 text-zinc-400'}`}
          >
            {config.enabled ? '✓ Active' : 'Disabled'}
          </button>
        </div>
      </div>

      {/* Config */}
      <div className="bg-zinc-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-oswald text-white text-lg">Programme Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Stamps to earn reward</label>
            <input
              type="number" min={2} max={50}
              value={config.stamps_required}
              onChange={e => setConfig(p => ({ ...p, stamps_required: parseInt(e.target.value) || 10 }))}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="label">Reward description</label>
            <input
              value={config.reward}
              onChange={e => setConfig(p => ({ ...p, reward: e.target.value }))}
              className="input-field w-full"
              placeholder="1 free coffee"
              maxLength={80}
            />
          </div>
        </div>

        <div className="bg-zinc-700/30 rounded-xl p-4">
          <p className="font-barlow text-zinc-300 text-sm">
            <strong>How it works:</strong> When closing a tab, staff capture the customer's email.
            They receive a digital stamp by email and can track their progress.
            After {config.stamps_required} stamps they receive their <strong>{config.reward}</strong>.
          </p>
        </div>

        {msg && <p className="font-barlow text-green-400 text-sm">{msg}</p>}
        <button onClick={saveConfig} disabled={saving} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald px-5 py-3 rounded-xl transition-colors flex items-center gap-2">
          {saving ? <Spinner size="sm" color="white" /> : 'Save Settings'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Members', value: stats.total, colour: 'text-white' },
          { label: 'Active (stamps > 0)', value: stats.active, colour: 'text-amber-400' },
          { label: 'Rewards Redeemed', value: stats.redemptions, colour: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-800 rounded-2xl p-4 text-center">
            <div className={`font-oswald text-3xl ${s.colour}`}>{s.value}</div>
            <div className="font-barlow text-zinc-500 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Members list */}
      <div className="bg-zinc-800 rounded-2xl p-5">
        <h3 className="font-oswald text-white text-lg mb-4">Members ({members.length})</h3>
        {loading ? (
          <SkeletonCard rows={4} />
        ) : members.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🎟</div>
            <p className="font-barlow text-zinc-500">No loyalty members yet</p>
            <p className="font-barlow text-zinc-600 text-sm mt-1">Members are added when customers provide their email at payment</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map(m => (
              <div key={m.id} className="bg-zinc-700/40 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-barlow text-white text-sm font-semibold">{m.email}</p>
                    <p className="font-barlow text-zinc-500 text-xs">Last visit: {m.last_stamp ? format(new Date(m.last_stamp), 'dd MMM yyyy') : '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-oswald text-amber-400">{m.stamp_count}/{config.stamps_required}</p>
                    <p className="font-barlow text-zinc-600 text-xs">{m.reward_redeemed || 0} redeemed</p>
                  </div>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-1.5">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${stampPercent(m.stamp_count)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
