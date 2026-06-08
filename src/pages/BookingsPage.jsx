import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { ALLERGENS, BOOKING_TIMES, BOOKING_STATUSES, STATUS_COLOURS } from '../lib/constants'
import { sendBookingConfirmation } from '../lib/email'
import { sanitizeName, sanitizePhone, sanitizeText, isValidEmail, sanitizePartySize } from '../lib/sanitize'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { format } from 'date-fns'

async function sendSMSReminder(bookingId) {
  const { data, error } = await supabase.functions.invoke('send-booking-reminder', {
    body: { booking_id: bookingId },
  })
  if (error || data?.error) throw new Error(error?.message || data?.error)
  return data
}

const OCCASIONS = ['Birthday', 'Anniversary', 'Business Lunch', 'Date Night', 'Hen/Stag', 'Other', '']

export default function BookingsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('today')
  const [segment, setSegment] = useState('expected')
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editBooking, setEditBooking] = useState(null)

  const today = format(new Date(), 'yyyy-MM-dd')

  const loadBookings = useCallback(async () => {
    // FIX: always scope queries — today tab = exact date, all tab = limit 200 to prevent unbounded fetch
    let q = supabase.from('bookings').select('*').order('date').order('time')
    if (tab === 'today') {
      q = q.eq('date', today)
    } else {
      q = q.limit(200)
    }
    const { data } = await q
    setBookings(data || [])
    setLoading(false)
  }, [tab, today])

  useEffect(() => { setLoading(true); loadBookings() }, [loadBookings])

  const todayBookings = bookings.filter(b => b.date === today)
  const expected = todayBookings.filter(b => b.status === 'confirmed')
  const arrived = todayBookings.filter(b => b.status === 'arrived')
  const others = todayBookings.filter(b => ['no_show', 'cancelled'].includes(b.status))

  const segmentMap = { expected, arrived, other: others }
  const visibleBookings = tab === 'today' ? (segmentMap[segment] || []) : bookings

  const updateStatus = async (id, status) => {
    await supabase.from('bookings').update({ status }).eq('id', id)
    loadBookings()
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      <header className="bg-zinc-900 px-5 py-4 flex items-center justify-between border-b border-zinc-800">
        <div>
          <h1 className="font-oswald text-2xl text-white">📅 Bookings</h1>
          <p className="font-barlow text-zinc-400 text-base">Reservation management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNew(true)} className="bg-amber-600 hover:bg-amber-700 text-white font-oswald px-4 py-2 rounded-xl transition-colors">+ New</button>
          <button onClick={() => navigate('/')} className="font-barlow text-zinc-400 hover:text-white px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-sm">← Home</button>
        </div>
      </header>

      {/* Main tab */}
      <div className="flex border-b border-zinc-800 bg-zinc-900">
        {[['today', 'Today'], ['all', 'All Bookings']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex-1 py-3 font-oswald text-lg transition-colors ${tab === key ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-400 hover:text-white'}`}>{label}</button>
        ))}
      </div>

      {/* Segment tabs for today */}
      {tab === 'today' && (
        <div className="flex bg-zinc-900/50 border-b border-zinc-800 px-4 gap-2 py-2">
          {[['expected', `Expected (${expected.length})`], ['arrived', `Arrived (${arrived.length})`], ['other', `Other (${others.length})`]].map(([key, label]) => (
            <button key={key} onClick={() => setSegment(key)} className={`px-4 py-2 rounded-xl font-barlow text-sm transition-colors ${segment === key ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>{label}</button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : visibleBookings.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <div className="text-5xl">📅</div>
            <p className="font-barlow text-zinc-500 text-lg">No bookings</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {visibleBookings.map(b => (
              <BookingCard key={b.id} booking={b} onEdit={() => setEditBooking(b)} onStatusChange={(s) => updateStatus(b.id, s)} />
            ))}
          </div>
        )}
      </div>

      {showNew && <BookingForm onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); loadBookings() }} />}
      {editBooking && <BookingForm booking={editBooking} onClose={() => setEditBooking(null)} onSaved={() => { setEditBooking(null); loadBookings() }} />}
    </div>
  )
}

function BookingCard({ booking, onEdit, onStatusChange }) {
  const statusColour = STATUS_COLOURS[booking.status] || 'bg-zinc-600'
  const [smsState, setSmsState] = useState('idle') // idle | sending | sent | error

  const handleSMSReminder = async () => {
    if (!booking.phone) return alert('No phone number on this booking')
    setSmsState('sending')
    try {
      await sendSMSReminder(booking.id)
      setSmsState('sent')
      setTimeout(() => setSmsState('idle'), 3000)
    } catch (e) {
      alert('SMS failed: ' + e.message)
      setSmsState('idle')
    }
  }

  return (
    <div className="bg-zinc-800 rounded-2xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-oswald text-white text-xl">{booking.name}</h3>
          <p className="font-barlow text-zinc-400 text-sm">{booking.date} · {booking.time} · {booking.party_size} covers</p>
          {booking.phone && <p className="font-barlow text-zinc-500 text-sm">{booking.phone}</p>}
        </div>
        <div className="flex flex-col gap-1 items-end">
          <span className={`${statusColour} text-white font-barlow text-xs px-2 py-0.5 rounded-full capitalize`}>{booking.status}</span>
          {booking.deposit_paid && <span className="bg-green-800 text-green-300 font-barlow text-xs px-2 py-0.5 rounded-full">Deposit paid</span>}
        </div>
      </div>

      {booking.dietary_notes && (
        <p className="font-barlow text-orange-400 text-sm mb-2">⚠ {booking.dietary_notes}</p>
      )}
      {booking.occasion && (
        <p className="font-barlow text-zinc-500 text-sm mb-2">🎉 {booking.occasion}</p>
      )}

      <div className="flex gap-2 flex-wrap mt-3">
        {BOOKING_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => onStatusChange(s)}
            disabled={booking.status === s}
            className={`px-3 py-1.5 rounded-lg font-barlow text-sm transition-colors disabled:opacity-30 ${STATUS_COLOURS[s]} text-white hover:brightness-110`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
        <button onClick={onEdit} className="px-3 py-1.5 rounded-lg font-barlow text-sm bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors">Edit</button>
        {booking.phone && (
          <button
            onClick={handleSMSReminder}
            disabled={smsState !== 'idle'}
            className={`px-3 py-1.5 rounded-lg font-barlow text-sm transition-colors disabled:opacity-60 ${smsState === 'sent' ? 'bg-green-800 text-green-300' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
          >
            {smsState === 'sending' ? '⏳ Sending…' : smsState === 'sent' ? '✓ SMS Sent' : '📱 SMS Reminder'}
          </button>
        )}
      </div>
    </div>
  )
}

function BookingForm({ booking, onClose, onSaved }) {
  const isEdit = !!booking
  const [form, setForm] = useState({
    name: '', email: '', phone: '', date: format(new Date(), 'yyyy-MM-dd'), time: '19:00',
    party_size: 2, table_preference: '', occasion: '', dietary_notes: '', special_requests: '',
    status: 'confirmed', deposit_paid: false, notes: '',
    marketing_email: false, marketing_sms: false, marketing_phone: false,
    ...(booking || {}),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const lastSubmit = useRef(0)

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    // Rate limit: 1 submission per 5 seconds
    if (Date.now() - lastSubmit.current < 5000) return setError('Please wait a moment before submitting again')
    lastSubmit.current = Date.now()

    // Validate
    const name = sanitizeName(form.name)
    if (!name) return setError('Guest name is required')
    if (!form.date || !form.time) return setError('Date and time are required')
    if (form.email && !isValidEmail(form.email)) return setError('Invalid email address')

    setSaving(true)
    setError('')
    try {
      const clean = {
        ...form,
        name,
        email: form.email?.trim().toLowerCase().slice(0, 254) || null,
        phone: sanitizePhone(form.phone) || null,
        dietary_notes: sanitizeText(form.dietary_notes, 500),
        special_requests: sanitizeText(form.special_requests, 1000),
        notes: sanitizeText(form.notes, 1000),
        table_preference: sanitizeText(form.table_preference, 100),
        party_size: sanitizePartySize(form.party_size),
      }
      if (isEdit) {
        const { error: err } = await supabase.from('bookings').update(clean).eq('id', booking.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('bookings').insert(clean)
        if (err) throw err
        if (clean.email) await sendBookingConfirmation(clean)
      }
      onSaved()
    } catch {
      setError('Failed to save booking — please try again')
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? 'Edit Booking' : 'New Booking'} onClose={onClose} size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="font-barlow text-zinc-400 text-sm block mb-1">Guest Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="input-field w-full" placeholder="Jane Smith" />
          </div>
          <div>
            <label className="font-barlow text-zinc-400 text-sm block mb-1">Phone</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input-field w-full" placeholder="07700 000000" />
          </div>
          <div>
            <label className="font-barlow text-zinc-400 text-sm block mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input-field w-full" placeholder="jane@example.com" />
          </div>
          <div>
            <label className="font-barlow text-zinc-400 text-sm block mb-1">Date *</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="font-barlow text-zinc-400 text-sm block mb-1">Time *</label>
            <select value={form.time} onChange={e => set('time', e.target.value)} className="input-field w-full">
              {BOOKING_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="font-barlow text-zinc-400 text-sm block mb-1">Party Size</label>
            <input type="number" min={1} max={50} value={form.party_size} onChange={e => set('party_size', parseInt(e.target.value))} className="input-field w-full" />
          </div>
          <div>
            <label className="font-barlow text-zinc-400 text-sm block mb-1">Table Preference</label>
            <input value={form.table_preference} onChange={e => set('table_preference', e.target.value)} className="input-field w-full" placeholder="Table 5, Window..." />
          </div>
          <div>
            <label className="font-barlow text-zinc-400 text-sm block mb-1">Occasion</label>
            <select value={form.occasion} onChange={e => set('occasion', e.target.value)} className="input-field w-full">
              {OCCASIONS.map(o => <option key={o} value={o}>{o || 'None'}</option>)}
            </select>
          </div>
          <div>
            <label className="font-barlow text-zinc-400 text-sm block mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field w-full">
              {BOOKING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="font-barlow text-zinc-400 text-sm block mb-1">Dietary Notes / Allergens</label>
            <input value={form.dietary_notes} onChange={e => set('dietary_notes', e.target.value)} className="input-field w-full" placeholder="Nut allergy, vegan..." />
          </div>
          <div className="col-span-2">
            <label className="font-barlow text-zinc-400 text-sm block mb-1">Special Requests</label>
            <textarea value={form.special_requests} onChange={e => set('special_requests', e.target.value)} rows={2} className="input-field w-full resize-none" placeholder="High chair needed, surprise cake..." />
          </div>
          <div className="col-span-2">
            <label className="font-barlow text-zinc-400 text-sm block mb-1">Staff Notes (internal)</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="input-field w-full resize-none" />
          </div>
        </div>

        {/* Checkboxes */}
        <div className="flex flex-wrap gap-4">
          <CheckboxField label="Deposit Paid" checked={form.deposit_paid} onChange={v => set('deposit_paid', v)} />
          <CheckboxField label="Email Marketing" checked={form.marketing_email} onChange={v => set('marketing_email', v)} />
          <CheckboxField label="SMS Marketing" checked={form.marketing_sms} onChange={v => set('marketing_sms', v)} />
          <CheckboxField label="Phone Marketing" checked={form.marketing_phone} onChange={v => set('marketing_phone', v)} />
        </div>

        {/* Privacy notice — GDPR requirement for data collection */}
        {!isEdit && (
          <div className="bg-zinc-700/50 rounded-xl px-4 py-3 text-xs font-barlow text-zinc-400">
            <p className="font-semibold text-zinc-300 mb-1">Privacy Notice</p>
            <p>We collect your name, contact details and dining preferences to manage your reservation and provide the service you've requested. Your data is stored securely and will not be shared with third parties without your consent. Marketing communications are only sent if you opt in below. You have the right to access, correct or erase your data at any time by contacting the venue.</p>
          </div>
        )}

        {error && <p className="text-red-400 font-barlow text-sm">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-zinc-700 text-white font-oswald py-3 rounded-xl hover:bg-zinc-600 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            {saving ? <Spinner size="sm" color="white" /> : (isEdit ? 'Save Changes' : 'Create Booking')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${checked ? 'bg-amber-600 border-amber-600' : 'border-zinc-500 bg-transparent'}`}
      >
        {checked && <span className="text-white text-xs">✓</span>}
      </div>
      <span className="font-barlow text-zinc-300 text-sm">{label}</span>
    </label>
  )
}
