import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Spinner from './Spinner'

export default function StaffPicker({ onSelect, role }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      let q = supabase.from('staff').select('*').eq('active', true).order('name')
      if (role) q = q.eq('role', role)
      const { data } = await q
      setStaff(data || [])
      setLoading(false)
    }
    load()
  }, [role])

  if (loading) return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-8">
      <h1 className="font-oswald text-4xl text-white mb-2 tracking-wide">Who are you?</h1>
      <p className="font-barlow text-zinc-400 text-lg mb-10">Select your name to continue</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-xl">
        {staff.map(s => (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className="touch-btn rounded-2xl p-6 text-center font-oswald text-xl text-white shadow-lg active:scale-95 transition-transform flex flex-col items-center gap-2"
            style={{ backgroundColor: s.colour || '#d97706' }}
          >
            <span className="text-3xl">{s.name.charAt(0).toUpperCase()}</span>
            <span>{s.name}</span>
            <span className="font-barlow text-sm opacity-80">{s.role}</span>
          </button>
        ))}
        {staff.length === 0 && (
          <div className="col-span-2 md:col-span-3 text-center text-zinc-500 font-barlow text-lg py-12">
            No staff found. Add staff in the Admin panel.
          </div>
        )}
      </div>
    </div>
  )
}
