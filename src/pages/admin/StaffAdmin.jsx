import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'

const ROLES = ['Waiter', 'Bartender', 'Kitchen', 'Manager']
const COLOURS = ['#d97706', '#16a34a', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#ea580c', '#65a30d']

export default function StaffAdmin() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [editMember, setEditMember] = useState(null)
  const [showNew, setShowNew] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('staff').select('*').order('name')
    setStaff(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (form) => {
    if (editMember) {
      await supabase.from('staff').update(form).eq('id', editMember.id)
    } else {
      await supabase.from('staff').insert(form)
    }
    setEditMember(null)
    setShowNew(false)
    load()
  }

  const toggleActive = async (id, active) => {
    await supabase.from('staff').update({ active: !active }).eq('id', id)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this staff member?')) return
    await supabase.from('staff').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-oswald text-xl text-white">Staff ({staff.length})</h2>
        <button onClick={() => setShowNew(true)} className="bg-amber-600 hover:bg-amber-700 text-white font-oswald px-4 py-2 rounded-xl transition-colors">+ Add Staff</button>
      </div>

      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="space-y-2">
          {staff.map(s => (
            <div key={s.id} className={`bg-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3 ${!s.active ? 'opacity-50' : ''}`}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-oswald text-white text-lg flex-shrink-0" style={{ backgroundColor: s.colour }}>
                {s.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-barlow text-white font-semibold text-base">{s.name}</p>
                <p className="font-barlow text-zinc-400 text-sm">{s.role}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleActive(s.id, s.active)} className={`font-barlow text-xs px-2 py-1 rounded transition-colors ${s.active ? 'bg-green-800 text-green-300' : 'bg-zinc-700 text-zinc-400'}`}>
                  {s.active ? 'Active' : 'Off'}
                </button>
                <button onClick={() => setEditMember(s)} className="font-barlow text-xs px-2 py-1 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors">Edit</button>
                <button onClick={() => handleDelete(s.id)} className="font-barlow text-xs px-2 py-1 rounded bg-red-900/50 text-red-400 hover:bg-red-900 transition-colors">Del</button>
              </div>
            </div>
          ))}
          {staff.length === 0 && <p className="text-zinc-500 font-barlow text-center py-8">No staff yet. Add your first team member.</p>}
        </div>
      )}

      {(showNew || editMember) && (
        <StaffForm member={editMember} onSave={handleSave} onClose={() => { setEditMember(null); setShowNew(false) }} />
      )}
    </div>
  )
}

function StaffForm({ member, onSave, onClose }) {
  const [form, setForm] = useState({ name: '', role: 'Waiter', colour: '#d97706', active: true, ...(member || {}) })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) return alert('Name is required')
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <Modal title={member ? 'Edit Staff Member' : 'New Staff Member'} onClose={onClose} size="sm">
      <div className="space-y-4">
        <div>
          <label className="label">Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} className="input-field w-full" placeholder="Sarah" />
        </div>
        <div>
          <label className="label">Role</label>
          <select value={form.role} onChange={e => set('role', e.target.value)} className="input-field w-full">
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Colour</label>
          <div className="flex gap-2 flex-wrap">
            {COLOURS.map(c => (
              <button key={c} onClick={() => set('colour', c)} className={`w-10 h-10 rounded-full transition-all ${form.colour === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-800 scale-110' : ''}`} style={{ backgroundColor: c }} />
            ))}
            <input type="color" value={form.colour} onChange={e => set('colour', e.target.value)} className="w-10 h-10 rounded-full cursor-pointer bg-transparent border-0 p-0" title="Custom colour" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div onClick={() => set('active', !form.active)} className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer ${form.active ? 'bg-amber-600 border-amber-600' : 'border-zinc-500'}`}>
            {form.active && <span className="text-white text-xs">✓</span>}
          </div>
          <span className="font-barlow text-zinc-300 text-sm">Active (shows on staff picker)</span>
        </div>
        <button onClick={handleSave} disabled={saving} className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
          {saving ? <Spinner size="sm" color="white" /> : (member ? 'Save Changes' : 'Add Staff')}
        </button>
      </div>
    </Modal>
  )
}
