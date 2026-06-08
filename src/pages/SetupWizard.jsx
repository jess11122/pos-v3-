import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import Spinner from '../components/ui/Spinner'

const DEFAULT_MENU = [
  // Drinks
  { id: 1, name: 'Lager', type: 'drink', subcategory: 'Beer', price: 5.50, allergens: ['Gluten'], active: true },
  { id: 2, name: 'IPA', type: 'drink', subcategory: 'Beer', price: 6.00, allergens: ['Gluten'], active: true },
  { id: 3, name: 'House Red Wine', type: 'drink', subcategory: 'Wine', price: 7.00, allergens: ['Sulphites'], active: true },
  { id: 4, name: 'House White Wine', type: 'drink', subcategory: 'Wine', price: 7.00, allergens: ['Sulphites'], active: true },
  { id: 5, name: 'Prosecco', type: 'drink', subcategory: 'Wine', price: 8.50, allergens: ['Sulphites'], active: true },
  { id: 6, name: 'Gin & Tonic', type: 'drink', subcategory: 'Spirits', price: 8.00, allergens: [], active: true },
  { id: 7, name: 'Vodka & Coke', type: 'drink', subcategory: 'Spirits', price: 7.50, allergens: [], active: true },
  { id: 8, name: 'Mojito', type: 'drink', subcategory: 'Cocktails', price: 10.00, allergens: [], active: true },
  { id: 9, name: 'Espresso Martini', type: 'drink', subcategory: 'Cocktails', price: 11.00, allergens: ['Milk'], active: true },
  { id: 10, name: 'Coca Cola', type: 'drink', subcategory: 'Soft Drinks', price: 3.00, allergens: [], active: true },
  { id: 11, name: 'Orange Juice', type: 'drink', subcategory: 'Soft Drinks', price: 3.50, allergens: [], active: true },
  { id: 12, name: 'Coffee', type: 'drink', subcategory: 'Hot Drinks', price: 3.00, allergens: ['Milk'], active: true },
  { id: 13, name: 'Tea', type: 'drink', subcategory: 'Hot Drinks', price: 2.50, allergens: ['Milk'], active: true },
  // Food
  { id: 14, name: 'Cheese Board', type: 'food', subcategory: 'Deli Food', price: 14.00, allergens: ['Milk', 'Gluten'], active: true },
  { id: 15, name: 'Charcuterie Board', type: 'food', subcategory: 'Deli Food', price: 16.00, allergens: ['Gluten', 'Sulphites'], active: true },
  { id: 16, name: 'Olives', type: 'food', subcategory: 'Deli Food', price: 6.00, allergens: [], active: true },
  { id: 17, name: 'Bread & Butter', type: 'food', subcategory: 'Deli Food', price: 4.00, allergens: ['Gluten', 'Milk'], active: true },
  { id: 18, name: 'Hummus & Crudités', type: 'food', subcategory: 'Deli Food', price: 7.00, allergens: ['Sesame'], active: true },
  { id: 19, name: 'Mixed Nuts', type: 'food', subcategory: 'Deli Food', price: 5.00, allergens: ['Nuts', 'Peanuts'], active: true },
]

const DEFAULT_FLOOR_MAP = {
  tables: Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    number: i + 1,
    x: (i % 5) * 18 + 5,
    y: Math.floor(i / 5) * 35 + 15,
    seats: 4,
  })),
}

export default function SetupWizard() {
  const { refreshSettings } = useApp()
  const [step, setStep] = useState(1)
  const [venueName, setVenueName] = useState('')
  const [pin, setPin] = useState('1234')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!venueName.trim()) return setError('Please enter a venue name')
    if (pin.length < 4) return setError('PIN must be at least 4 digits')
    setSaving(true)
    setError('')
    try {
      const { error: err } = await supabase.from('settings').insert({
        venue_name: venueName.trim(),
        admin_pin: pin,
        table_count: 10,
        floor_map: DEFAULT_FLOOR_MAP,
        menu_items: DEFAULT_MENU,
      })
      if (err) throw err
      await refreshSettings()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-6">
      <div className="bg-zinc-800 rounded-3xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍺</div>
          <h1 className="font-oswald text-4xl text-white tracking-wide">TabFlow</h1>
          <p className="font-barlow text-zinc-400 text-lg mt-1">First-time setup</p>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block font-barlow text-zinc-300 mb-2 text-lg">Venue Name</label>
              <input
                type="text"
                value={venueName}
                onChange={e => setVenueName(e.target.value)}
                placeholder="The Crown & Anchor"
                className="w-full bg-zinc-700 text-white font-barlow text-xl rounded-xl px-4 py-4 outline-none focus:ring-2 focus:ring-amber-600 placeholder-zinc-500"
              />
            </div>
            <button
              onClick={() => { if (venueName.trim()) setStep(2); else setError('Enter venue name') }}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-oswald text-xl py-4 rounded-xl transition-colors touch-btn"
            >
              Next →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block font-barlow text-zinc-300 mb-2 text-lg">Admin PIN</label>
              <p className="font-barlow text-zinc-500 text-sm mb-3">Used to access the Admin panel. Default is 1234.</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-zinc-700 text-white font-oswald text-3xl tracking-[1rem] text-center rounded-xl px-4 py-4 outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>
            {error && <p className="text-red-400 font-barlow text-center">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 bg-zinc-700 text-white font-oswald text-lg py-4 rounded-xl hover:bg-zinc-600 transition-colors">
                ← Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-oswald text-xl py-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Spinner size="sm" color="white" /> : 'Set Up TabFlow'}
              </button>
            </div>
          </div>
        )}

        {error && step === 1 && <p className="text-red-400 font-barlow text-center mt-3">{error}</p>}
      </div>
    </div>
  )
}
