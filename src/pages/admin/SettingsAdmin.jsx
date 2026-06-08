import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { DRINK_SUBCATEGORIES } from '../../lib/constants'
import { verifyPin, hashPin } from '../../lib/pin'
import Spinner from '../../components/ui/Spinner'

export default function SettingsAdmin() {
  const { settings, refreshSettings } = useApp()
  const [venueName, setVenueName] = useState(settings?.venue_name || '')
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [pinSaving, setPinSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [pinMsg, setPinMsg] = useState('')

  const defaultHH = { enabled: false, start: '17:00', end: '19:00', discount_percent: 20, categories: [] }
  const [hh, setHH] = useState(settings?.happy_hour || defaultHH)
  const [hhSaving, setHHSaving] = useState(false)
  const [hhMsg, setHHMsg] = useState('')

  const [twilio, setTwilio] = useState(settings?.twilio || { account_sid: '', auth_token: '', from_number: '' })
  const [twilioSaving, setTwilioSaving] = useState(false)
  const [twilioMsg, setTwilioMsg] = useState('')

  const flash = (setter, msg) => { setter(msg); setTimeout(() => setter(''), 2500) }

  const saveVenueName = async () => {
    if (!venueName.trim()) return flash(setMsg, 'Venue name cannot be empty')
    setSaving(true)
    await supabase.from('settings').update({ venue_name: venueName.trim() }).eq('id', settings.id)
    await refreshSettings()
    flash(setMsg, '✓ Saved')
    setSaving(false)
  }

  const savePin = async () => {
    if (newPin.length < 4) return flash(setPinMsg, 'New PIN must be at least 4 digits')
    if (newPin !== confirmPin) return flash(setPinMsg, 'PINs do not match')
    // Verify current PIN against stored hash or plaintext
    const storedHash = settings?.admin_pin_hash
    const storedPlain = settings?.admin_pin || '1234'
    const ok = await verifyPin(currentPin, storedHash || storedPlain)
    if (!ok) return flash(setPinMsg, 'Current PIN is incorrect')
    setPinSaving(true)
    const newHash = await hashPin(newPin)
    // Store hash; keep plain for legacy compat during transition
    await supabase.from('settings').update({ admin_pin_hash: newHash, admin_pin: newPin }).eq('id', settings.id)
    await refreshSettings()
    setCurrentPin(''); setNewPin(''); setConfirmPin('')
    flash(setPinMsg, '✓ PIN updated and secured')
    setPinSaving(false)
  }

  const saveHappyHour = async () => {
    setHHSaving(true)
    await supabase.from('settings').update({ happy_hour: hh }).eq('id', settings.id)
    await refreshSettings()
    flash(setHHMsg, '✓ Happy hour saved')
    setHHSaving(false)
  }

  const saveTwilio = async () => {
    setTwilioSaving(true)
    await supabase.from('settings').update({ twilio }).eq('id', settings.id)
    await refreshSettings()
    flash(setTwilioMsg, '✓ Twilio credentials saved')
    setTwilioSaving(false)
  }

  const toggleHHCategory = (cat) => {
    setHH(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat]
    }))
  }

  return (
    <div className="p-5 max-w-xl mx-auto space-y-5">
      {/* Venue name */}
      <div className="bg-zinc-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-oswald text-white text-lg">Venue Settings</h3>
        <div>
          <label className="label">Venue Name</label>
          <input value={venueName} onChange={e => setVenueName(e.target.value)} className="input-field w-full" placeholder="The Crown & Anchor" />
        </div>
        {msg && <p className={`font-barlow text-sm ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}
        <button onClick={saveVenueName} disabled={saving} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald px-5 py-3 rounded-xl transition-colors flex items-center gap-2">
          {saving ? <Spinner size="sm" color="white" /> : 'Save Venue Name'}
        </button>
      </div>

      {/* Happy Hour */}
      <div className="bg-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-oswald text-white text-lg">Happy Hour</h3>
          <button
            onClick={() => setHH(p => ({ ...p, enabled: !p.enabled }))}
            className={`px-4 py-2 rounded-xl font-barlow text-sm transition-colors ${hh.enabled ? 'bg-amber-600 text-white' : 'bg-zinc-700 text-zinc-400'}`}
          >
            {hh.enabled ? '✓ Enabled' : 'Disabled'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start Time</label>
            <input type="time" value={hh.start} onChange={e => setHH(p => ({ ...p, start: e.target.value }))} className="input-field w-full" />
          </div>
          <div>
            <label className="label">End Time</label>
            <input type="time" value={hh.end} onChange={e => setHH(p => ({ ...p, end: e.target.value }))} className="input-field w-full" />
          </div>
        </div>
        <div>
          <label className="label">Discount %</label>
          <input type="number" min={1} max={100} value={hh.discount_percent} onChange={e => setHH(p => ({ ...p, discount_percent: parseInt(e.target.value) || 0 }))} className="input-field w-full" />
        </div>
        <div>
          <label className="label">Apply to categories (leave empty for all drinks)</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {DRINK_SUBCATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => toggleHHCategory(cat)}
                className={`px-3 py-1.5 rounded-lg font-barlow text-xs transition-colors ${hh.categories.includes(cat) ? 'bg-amber-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          {hh.categories.length === 0 && <p className="font-barlow text-zinc-500 text-xs mt-1">All drink categories will be discounted</p>}
        </div>
        {hhMsg && <p className={`font-barlow text-sm ${hhMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{hhMsg}</p>}
        <button onClick={saveHappyHour} disabled={hhSaving} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald px-5 py-3 rounded-xl transition-colors flex items-center gap-2">
          {hhSaving ? <Spinner size="sm" color="white" /> : 'Save Happy Hour'}
        </button>
      </div>

      {/* Change PIN */}
      <div className="bg-zinc-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-oswald text-white text-lg">Change Admin PIN</h3>
        <div>
          <label className="label">Current PIN</label>
          <input type="password" inputMode="numeric" maxLength={8} value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))} className="input-field w-full tracking-widest text-center text-xl" />
        </div>
        <div>
          <label className="label">New PIN</label>
          <input type="password" inputMode="numeric" maxLength={8} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} className="input-field w-full tracking-widest text-center text-xl" />
        </div>
        <div>
          <label className="label">Confirm New PIN</label>
          <input type="password" inputMode="numeric" maxLength={8} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} className="input-field w-full tracking-widest text-center text-xl" />
        </div>
        {pinMsg && <p className={`font-barlow text-sm ${pinMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{pinMsg}</p>}
        <button onClick={savePin} disabled={pinSaving} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald px-5 py-3 rounded-xl transition-colors flex items-center gap-2">
          {pinSaving ? <Spinner size="sm" color="white" /> : 'Update PIN'}
        </button>
      </div>

      {/* SMS / Twilio */}
      <div className="bg-zinc-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-oswald text-white text-lg">SMS / Twilio</h3>
        <p className="font-barlow text-zinc-400 text-sm">Used for booking reminder SMS. Get credentials at twilio.com.</p>
        <div>
          <label className="label">Account SID</label>
          <input value={twilio.account_sid} onChange={e => setTwilio(p => ({ ...p, account_sid: e.target.value }))} className="input-field w-full font-mono text-sm" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
        </div>
        <div>
          <label className="label">Auth Token</label>
          <input type="password" value={twilio.auth_token} onChange={e => setTwilio(p => ({ ...p, auth_token: e.target.value }))} className="input-field w-full font-mono text-sm" placeholder="●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●" />
        </div>
        <div>
          <label className="label">From Number</label>
          <input value={twilio.from_number} onChange={e => setTwilio(p => ({ ...p, from_number: e.target.value }))} className="input-field w-full font-mono text-sm" placeholder="+441234567890" />
        </div>
        {twilioMsg && <p className={`font-barlow text-sm ${twilioMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{twilioMsg}</p>}
        <button onClick={saveTwilio} disabled={twilioSaving} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald px-5 py-3 rounded-xl transition-colors flex items-center gap-2">
          {twilioSaving ? <Spinner size="sm" color="white" /> : 'Save Twilio Credentials'}
        </button>
      </div>

      {/* Closing time */}
      <div className="bg-zinc-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-oswald text-white text-lg">Closing Time</h3>
        <p className="font-barlow text-zinc-400 text-sm">Shown as countdown on the TV display dashboard.</p>
        <div>
          <label className="label">Closing Time</label>
          <input type="time" defaultValue={settings?.closing_time || '23:00'} id="closingTime" className="input-field w-full" />
        </div>
        <button
          onClick={async () => {
            const t = document.getElementById('closingTime').value
            await supabase.from('settings').update({ closing_time: t }).eq('id', settings.id)
            await refreshSettings()
          }}
          className="bg-amber-600 hover:bg-amber-700 text-white font-oswald px-5 py-3 rounded-xl transition-colors"
        >
          Save Closing Time
        </button>
      </div>

      {/* System Info */}
      <div className="bg-zinc-800 rounded-2xl p-5">
        <h3 className="font-oswald text-white text-lg mb-2">System Info</h3>
        <div className="space-y-1">
          <div className="flex justify-between font-barlow text-sm"><span className="text-zinc-400">Version</span><span className="text-zinc-300">3.0.0</span></div>
          <div className="flex justify-between font-barlow text-sm"><span className="text-zinc-400">Settings ID</span><span className="text-zinc-500 text-xs">{settings?.id?.slice(0, 8)}…</span></div>
          <div className="flex justify-between font-barlow text-sm"><span className="text-zinc-400">Display (TV) URL</span><span className="text-zinc-500 text-xs">/display</span></div>
          <div className="flex justify-between font-barlow text-sm"><span className="text-zinc-400">Group Dashboard</span><span className="text-zinc-500 text-xs">/group</span></div>
        </div>
        <div className="mt-4 pt-4 border-t border-zinc-700 text-center">
          <p className="font-barlow text-zinc-700 text-xs">Powered by TabFlow POS · v3.0.0</p>
        </div>
      </div>
    </div>
  )
}
