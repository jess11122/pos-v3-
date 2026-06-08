import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { sanitizeName } from '../../lib/sanitize'
import Spinner from '../../components/ui/Spinner'

export default function GdprAdmin() {
  const [searchName, setSearchName] = useState('')
  const [searchEmail, setSearchEmail] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [done, setDone] = useState('')
  const [error, setError] = useState('')

  const handleSearch = async () => {
    const name = sanitizeName(searchName)
    const email = searchEmail.trim().toLowerCase().slice(0, 254)
    if (!name && !email) return setError('Enter a name or email to search')
    setSearching(true)
    setError('')
    setDone('')
    let q = supabase.from('bookings').select('id,name,email,phone,date,created_at')
    if (email) q = q.ilike('email', email)
    else q = q.ilike('name', `%${name}%`)
    const { data, error: err } = await q.limit(50)
    if (err) setError('Search failed')
    else setResults(data || [])
    setSearching(false)
  }

  const handleErase = async (booking) => {
    if (!confirm(`Permanently erase all personal data for "${booking.name}"?\n\nThis cannot be undone.`)) return
    setDeleting(true)
    setError('')
    try {
      // Anonymise — don't hard delete so order history integrity is preserved
      await supabase.from('bookings').update({
        name: '[Deleted]',
        email: null,
        phone: null,
        notes: null,
        dietary_notes: null,
        special_requests: null,
        marketing_email: false,
        marketing_sms: false,
        marketing_phone: false,
      }).eq('id', booking.id)
      setResults(prev => prev.filter(r => r.id !== booking.id))
      setDone(`✓ Personal data for "${booking.name}" has been erased (booking record anonymised)`)
    } catch {
      setError('Erasure failed — try again')
    } finally {
      setDeleting(false)
    }
  }

  const handleEraseAll = async () => {
    if (!results?.length) return
    if (!confirm(`Permanently erase personal data for ALL ${results.length} matching records?\n\nThis cannot be undone.`)) return
    setDeleting(true)
    setError('')
    try {
      const ids = results.map(r => r.id)
      await supabase.from('bookings').update({
        name: '[Deleted]',
        email: null,
        phone: null,
        notes: null,
        dietary_notes: null,
        special_requests: null,
        marketing_email: false,
        marketing_sms: false,
        marketing_phone: false,
      }).in('id', ids)
      setDone(`✓ ${results.length} records anonymised`)
      setResults([])
    } catch {
      setError('Bulk erasure failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-5 max-w-2xl mx-auto space-y-5">
      <div className="bg-zinc-800 rounded-2xl p-5">
        <h2 className="font-oswald text-white text-xl mb-1">GDPR — Right to Erasure</h2>
        <p className="font-barlow text-zinc-400 text-sm">
          Search for a guest by name or email to find their data. Use "Erase" to anonymise their personal details from booking records. Order and payment records are retained for legal/accounting purposes but personal identifiers are removed.
        </p>
      </div>

      <div className="bg-zinc-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-oswald text-white text-lg">Search Guest Data</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-barlow text-zinc-400 text-sm block mb-1">Guest Name</label>
            <input
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="input-field w-full"
              placeholder="Jane Smith"
              maxLength={100}
            />
          </div>
          <div>
            <label className="font-barlow text-zinc-400 text-sm block mb-1">Email Address</label>
            <input
              type="email"
              value={searchEmail}
              onChange={e => setSearchEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="input-field w-full"
              placeholder="jane@example.com"
              maxLength={254}
            />
          </div>
        </div>
        {error && <p className="font-barlow text-red-400 text-sm">{error}</p>}
        {done && <p className="font-barlow text-green-400 text-sm">{done}</p>}
        <button
          onClick={handleSearch}
          disabled={searching}
          className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald px-5 py-3 rounded-xl transition-colors flex items-center gap-2"
        >
          {searching ? <Spinner size="sm" color="white" /> : 'Search'}
        </button>
      </div>

      {results !== null && (
        <div className="bg-zinc-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-oswald text-white text-lg">{results.length} record{results.length !== 1 ? 's' : ''} found</h3>
            {results.length > 1 && (
              <button
                onClick={handleEraseAll}
                disabled={deleting}
                className="font-barlow text-xs px-3 py-2 bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-400 rounded-lg transition-colors disabled:opacity-50"
              >
                Erase All {results.length}
              </button>
            )}
          </div>

          {results.length === 0 && (
            <p className="font-barlow text-zinc-500 text-sm">No records found for that search.</p>
          )}

          {results.map(r => (
            <div key={r.id} className="bg-zinc-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-barlow text-white text-sm font-semibold">{r.name}</p>
                <p className="font-barlow text-zinc-400 text-xs">{r.email || '—'} · {r.phone || '—'}</p>
                <p className="font-barlow text-zinc-500 text-xs">{r.date}</p>
              </div>
              <button
                onClick={() => handleErase(r)}
                disabled={deleting}
                className="flex-shrink-0 font-barlow text-xs px-3 py-2 bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-400 rounded-lg transition-colors disabled:opacity-50"
              >
                Erase
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-zinc-800 rounded-2xl p-5 space-y-3">
        <h3 className="font-oswald text-white text-lg">Data Retention Policy</h3>
        <div className="space-y-2 font-barlow text-sm">
          <div className="flex gap-3 text-zinc-300"><span className="text-zinc-500 w-32 flex-shrink-0">Bookings</span><span>Personal data kept while booking is active. Anonymisable on request.</span></div>
          <div className="flex gap-3 text-zinc-300"><span className="text-zinc-500 w-32 flex-shrink-0">Orders</span><span>Retained 2 years for accounting/HMRC compliance. No personal identifiers stored on orders.</span></div>
          <div className="flex gap-3 text-zinc-300"><span className="text-zinc-500 w-32 flex-shrink-0">Tips & Payments</span><span>Retained 7 years for tax records. No guest personal data stored.</span></div>
          <div className="flex gap-3 text-zinc-300"><span className="text-zinc-500 w-32 flex-shrink-0">Marketing</span><span>Opt-in only. Guests can withdraw consent at any time — use Erase above.</span></div>
        </div>
      </div>
    </div>
  )
}
