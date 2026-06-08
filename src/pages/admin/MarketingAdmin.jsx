import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Spinner from '../../components/ui/Spinner'

export default function MarketingAdmin() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('email')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    let q = supabase.from('bookings').select('id,name,email,phone,marketing_email,marketing_sms,marketing_phone,created_at').order('created_at', { ascending: false })
    const { data } = await q
    setContacts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filterMap = {
    email: contacts.filter(c => c.marketing_email && c.email),
    sms: contacts.filter(c => c.marketing_sms && c.phone),
    phone: contacts.filter(c => c.marketing_phone && c.phone),
  }

  const visible = filterMap[filter] || []

  const copyAll = () => {
    const text = visible.map(c => filter === 'email' ? c.email : c.phone).filter(Boolean).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-5">
      <div className="bg-zinc-800 rounded-2xl p-5">
        <h2 className="font-oswald text-xl text-white mb-1">Marketing Contacts</h2>
        <p className="font-barlow text-zinc-400 text-sm">Guests who gave consent at booking</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          ['email', `Email (${filterMap.email.length})`],
          ['sms', `SMS (${filterMap.sms.length})`],
          ['phone', `Phone (${filterMap.phone.length})`],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={`px-4 py-2 rounded-xl font-barlow text-sm transition-colors ${filter === key ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
            {label}
          </button>
        ))}
        <button
          onClick={copyAll}
          disabled={visible.length === 0}
          className="ml-auto px-4 py-2 rounded-xl font-barlow text-sm bg-zinc-700 text-zinc-300 hover:bg-zinc-600 disabled:opacity-40 transition-colors"
        >
          {copied ? '✓ Copied!' : '📋 Copy All'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 font-barlow">No contacts with {filter} consent</div>
      ) : (
        <div className="bg-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left font-barlow text-zinc-400 text-sm px-4 py-3">Name</th>
                <th className="text-left font-barlow text-zinc-400 text-sm px-4 py-3">{filter === 'email' ? 'Email' : 'Phone'}</th>
                <th className="text-left font-barlow text-zinc-400 text-sm px-4 py-3">Consents</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(c => (
                <tr key={c.id} className="border-b border-zinc-700/50 hover:bg-zinc-700/30">
                  <td className="font-barlow text-white text-sm px-4 py-3">{c.name}</td>
                  <td className="font-barlow text-zinc-300 text-sm px-4 py-3">{filter === 'email' ? c.email : c.phone}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {c.marketing_email && <span className="bg-blue-900 text-blue-300 font-barlow text-xs px-1.5 py-0.5 rounded">Email</span>}
                      {c.marketing_sms && <span className="bg-green-900 text-green-300 font-barlow text-xs px-1.5 py-0.5 rounded">SMS</span>}
                      {c.marketing_phone && <span className="bg-purple-900 text-purple-300 font-barlow text-xs px-1.5 py-0.5 rounded">Phone</span>}
                    </div>
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
