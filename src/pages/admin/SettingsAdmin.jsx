import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
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

  const saveVenueName = async () => {
    if (!venueName.trim()) return setMsg('Venue name cannot be empty')
    setSaving(true)
    await supabase.from('settings').update({ venue_name: venueName.trim() }).eq('id', settings.id)
    await refreshSettings()
    setMsg('✓ Saved')
    setSaving(false)
    setTimeout(() => setMsg(''), 2000)
  }

  const savePin = async () => {
    if (currentPin !== settings?.admin_pin) return setPinMsg('Current PIN is incorrect')
    if (newPin.length < 4) return setPinMsg('New PIN must be at least 4 digits')
    if (newPin !== confirmPin) return setPinMsg('PINs do not match')
    setPinSaving(true)
    await supabase.from('settings').update({ admin_pin: newPin }).eq('id', settings.id)
    await refreshSettings()
    setCurrentPin(''); setNewPin(''); setConfirmPin('')
    setPinMsg('✓ PIN updated')
    setPinSaving(false)
    setTimeout(() => setPinMsg(''), 2000)
  }

  return (
    <div className="p-5 max-w-xl mx-auto space-y-5">
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

      <div className="bg-zinc-800 rounded-2xl p-5">
        <h3 className="font-oswald text-white text-lg mb-2">System Info</h3>
        <div className="space-y-1">
          <div className="flex justify-between font-barlow text-sm"><span className="text-zinc-400">Version</span><span className="text-zinc-300">1.0.0</span></div>
          <div className="flex justify-between font-barlow text-sm"><span className="text-zinc-400">Settings ID</span><span className="text-zinc-500 text-xs">{settings?.id?.slice(0, 8)}…</span></div>
        </div>
      </div>
    </div>
  )
}
