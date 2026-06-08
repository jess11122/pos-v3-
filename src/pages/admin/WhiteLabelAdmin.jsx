import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import Spinner from '../../components/ui/Spinner'

const PRESET_COLOURS = [
  { name: 'Amber', value: '#d97706' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Slate', value: '#475569' },
]

export default function WhiteLabelAdmin() {
  const { settings, updateSettings } = useApp()
  const wl = settings?.white_label || {}
  const [appName, setAppName] = useState(wl.app_name || '')
  const [primaryColour, setPrimaryColour] = useState(wl.primary_colour || '#d97706')
  const [logoUrl, setLogoUrl] = useState(wl.logo_url || '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const save = async () => {
    setSaving(true)
    await updateSettings({ white_label: { app_name: appName, primary_colour: primaryColour, logo_url: logoUrl, enabled: true } })
    // Update CSS variable live
    document.documentElement.style.setProperty('--colour-primary', primaryColour)
    setMsg('✓ White label settings saved')
    setTimeout(() => setMsg(''), 2500)
    setSaving(false)
  }

  const reset = async () => {
    setSaving(true)
    await updateSettings({ white_label: { enabled: false } })
    document.documentElement.style.removeProperty('--colour-primary')
    setAppName(''); setPrimaryColour('#d97706'); setLogoUrl('')
    setMsg('✓ Reset to TabFlow defaults')
    setTimeout(() => setMsg(''), 2500)
    setSaving(false)
  }

  return (
    <div className="p-5 max-w-xl mx-auto space-y-5">
      <div className="bg-zinc-800 rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-oswald text-white text-xl">White Label</h2>
            <p className="font-barlow text-zinc-400 text-sm mt-1">Replace TabFlow branding with your own — Enterprise tier</p>
          </div>
          <span className="bg-purple-900/30 border border-purple-700/40 text-purple-400 text-xs font-barlow px-3 py-1 rounded-full">Enterprise</span>
        </div>
      </div>

      <div className="bg-zinc-800 rounded-2xl p-5 space-y-5">
        <div>
          <label className="label">App Name</label>
          <input
            value={appName}
            onChange={e => setAppName(e.target.value)}
            className="input-field w-full"
            placeholder="The Crown POS"
            maxLength={40}
          />
          <p className="font-barlow text-zinc-600 text-xs mt-1">Shown on the role select screen instead of "TabFlow"</p>
        </div>

        <div>
          <label className="label">Logo URL</label>
          <input
            value={logoUrl}
            onChange={e => setLogoUrl(e.target.value)}
            className="input-field w-full"
            placeholder="https://your-venue.com/logo.png"
            maxLength={500}
          />
          <p className="font-barlow text-zinc-600 text-xs mt-1">Square PNG recommended, min 200×200px. Host on your own server.</p>
        </div>

        <div>
          <label className="label">Primary Colour</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {PRESET_COLOURS.map(c => (
              <button
                key={c.value}
                onClick={() => setPrimaryColour(c.value)}
                title={c.name}
                className={`w-9 h-9 rounded-xl border-2 transition-all ${primaryColour === c.value ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ background: c.value }}
              />
            ))}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColour}
                onChange={e => setPrimaryColour(e.target.value)}
                className="w-9 h-9 rounded-xl cursor-pointer border-0 p-0.5 bg-zinc-700"
              />
              <span className="font-mono text-zinc-400 text-xs">{primaryColour}</span>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-zinc-900 rounded-xl p-4">
          <p className="font-barlow text-zinc-500 text-xs mb-3 uppercase tracking-wider">Preview</p>
          <div className="flex items-center gap-3 mb-3">
            {logoUrl && <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-cover" onError={e => { e.target.style.display = 'none' }} />}
            <div className="font-oswald text-2xl text-white">{appName || 'Your App Name'}</div>
          </div>
          <button className="px-5 py-2 rounded-xl text-white font-oswald text-sm" style={{ background: primaryColour }}>
            Sample Button
          </button>
        </div>

        {msg && <p className={`font-barlow text-sm ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}

        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            {saving ? <Spinner size="sm" color="white" /> : 'Apply White Label'}
          </button>
          <button onClick={reset} disabled={saving} className="px-4 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-barlow rounded-xl transition-colors">
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
