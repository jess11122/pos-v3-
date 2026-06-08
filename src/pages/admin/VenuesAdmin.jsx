import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'

export default function VenuesAdmin() {
  const { venues, currentVenue, selectVenue } = useApp()
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '' })
  const [error, setError] = useState('')
  const [localVenues, setLocalVenues] = useState(venues)

  useEffect(() => { setLocalVenues(venues) }, [venues])

  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const handleNameChange = (name) => {
    setForm({ name, slug: slugify(name) })
  }

  const handleCreate = async () => {
    if (!form.name.trim() || !form.slug.trim()) return setError('Name and slug are required')
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase.from('venues').insert({ name: form.name.trim(), slug: form.slug.trim() }).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    // Create default settings row for new venue
    await supabase.from('settings').insert({
      venue_id: data.id,
      venue_name: form.name.trim(),
      admin_pin: '1234',
      menu_items: [],
      floor_map: { tables: [] },
      happy_hour: { enabled: false, start: '17:00', end: '19:00', discount_percent: 20, categories: [] },
    })
    const updated = [...localVenues, data]
    setLocalVenues(updated)
    setSaving(false)
    setShowNew(false)
    setForm({ name: '', slug: '' })
  }

  return (
    <div className="p-5 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-oswald text-xl text-white">Venues ({localVenues.length})</h2>
          <p className="font-barlow text-zinc-400 text-sm">Manage multiple locations</p>
        </div>
        <button onClick={() => setShowNew(true)} className="bg-amber-600 hover:bg-amber-700 text-white font-oswald px-4 py-2 rounded-xl transition-colors">+ Add Venue</button>
      </div>

      {localVenues.length === 0 && (
        <div className="bg-zinc-800 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">🏢</div>
          <p className="font-barlow text-zinc-400">No venues yet. The system runs in single-venue mode until you add a venue.</p>
        </div>
      )}

      <div className="space-y-3">
        {localVenues.map(v => (
          <div key={v.id} className="bg-zinc-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-oswald text-white text-lg">{v.name}</h3>
              <p className="font-barlow text-zinc-500 text-sm">/{v.slug}</p>
            </div>
            <div className="flex gap-2 items-center">
              {currentVenue?.id === v.id && (
                <span className="font-barlow text-xs bg-amber-600/20 border border-amber-600 text-amber-400 px-2 py-0.5 rounded-full">Current</span>
              )}
              <button
                onClick={() => selectVenue(v)}
                className="font-barlow text-sm px-3 py-2 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
              >
                Switch To
              </button>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <Modal title="Add Venue" onClose={() => setShowNew(false)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="label">Venue Name *</label>
              <input value={form.name} onChange={e => handleNameChange(e.target.value)} className="input-field w-full" placeholder="The Crown & Anchor" />
            </div>
            <div>
              <label className="label">URL Slug *</label>
              <input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: slugify(e.target.value) }))} className="input-field w-full font-mono" placeholder="the-crown-and-anchor" />
              <p className="font-barlow text-zinc-500 text-xs mt-1">Auto-generated from name. Letters, numbers and hyphens only.</p>
            </div>
            {error && <p className="text-red-400 font-barlow text-sm">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowNew(false)} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-oswald py-3 rounded-xl">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald py-3 rounded-xl flex items-center justify-center gap-2">
                {saving ? <Spinner size="sm" color="white" /> : 'Create Venue'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
