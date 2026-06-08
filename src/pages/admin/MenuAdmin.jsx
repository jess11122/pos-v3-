import { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { ALLERGENS, DRINK_SUBCATEGORIES } from '../../lib/constants'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'

const FOOD_SUBCATEGORIES = ['Deli Food', 'Snacks', 'Desserts', 'Other']

export default function MenuAdmin() {
  const { settings, refreshSettings } = useApp()
  const [editItem, setEditItem] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [filter, setFilter] = useState('all')

  const menuItems = settings?.menu_items || []
  const filtered = filter === 'all' ? menuItems : menuItems.filter(i => i.type === filter)

  const saveItems = async (items) => {
    await supabase.from('settings').update({ menu_items: items }).eq('id', settings.id)
    await refreshSettings()
  }

  const handleSave = async (item) => {
    const items = editItem
      ? menuItems.map(i => i.id === editItem.id ? { ...editItem, ...item } : i)
      : [...menuItems, { ...item, id: Date.now() }]
    await saveItems(items)
    setEditItem(null)
    setShowNew(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this item?')) return
    await saveItems(menuItems.filter(i => i.id !== id))
  }

  const toggleActive = async (id) => {
    await saveItems(menuItems.map(i => i.id === id ? { ...i, active: !i.active } : i))
  }

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-oswald text-xl text-white">Menu Items ({menuItems.length})</h2>
        <button onClick={() => setShowNew(true)} className="bg-amber-600 hover:bg-amber-700 text-white font-oswald px-4 py-2 rounded-xl transition-colors">+ Add Item</button>
      </div>

      <div className="flex gap-2 mb-4">
        {[['all', 'All'], ['drink', 'Drinks'], ['food', 'Food']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={`px-4 py-2 rounded-xl font-barlow text-sm transition-colors ${filter === key ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>{label}</button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(item => (
          <div key={item.id} className={`bg-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3 ${!item.active ? 'opacity-50' : ''}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-barlow text-white text-base font-semibold">{item.name}</span>
                <span className="font-barlow text-zinc-500 text-xs">{item.subcategory}</span>
                <span className={`font-barlow text-xs px-1.5 py-0.5 rounded ${item.type === 'drink' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'}`}>{item.type}</span>
              </div>
              {item.allergens?.length > 0 && (
                <p className="font-barlow text-orange-400 text-xs mt-0.5">{item.allergens.join(', ')}</p>
              )}
            </div>
            <span className="font-oswald text-amber-500 text-base">£{item.price?.toFixed(2)}</span>
            <div className="flex gap-2">
              <button onClick={() => toggleActive(item.id)} className={`font-barlow text-xs px-2 py-1 rounded transition-colors ${item.active ? 'bg-green-800 text-green-300' : 'bg-zinc-700 text-zinc-400'}`}>
                {item.active ? 'Active' : 'Off'}
              </button>
              <button onClick={() => setEditItem(item)} className="font-barlow text-xs px-2 py-1 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors">Edit</button>
              <button onClick={() => handleDelete(item.id)} className="font-barlow text-xs px-2 py-1 rounded bg-red-900/50 text-red-400 hover:bg-red-900 transition-colors">Del</button>
            </div>
          </div>
        ))}
      </div>

      {(showNew || editItem) && (
        <ItemForm
          item={editItem}
          onSave={handleSave}
          onClose={() => { setEditItem(null); setShowNew(false) }}
        />
      )}
    </div>
  )
}

function ItemForm({ item, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '', type: 'drink', subcategory: 'Beer', price: '', allergens: [], active: true,
    ...(item || {}),
    price: item?.price || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const toggleAllergen = (a) => set('allergens', form.allergens?.includes(a) ? form.allergens.filter(x => x !== a) : [...(form.allergens || []), a])

  const subcats = form.type === 'drink' ? DRINK_SUBCATEGORIES : FOOD_SUBCATEGORIES

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) return alert('Name and price required')
    setSaving(true)
    await onSave({ ...form, price: parseFloat(form.price) })
    setSaving(false)
  }

  return (
    <Modal title={item ? 'Edit Item' : 'New Menu Item'} onClose={onClose} size="md">
      <div className="space-y-4">
        <div>
          <label className="label">Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} className="input-field w-full" placeholder="Lager" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type *</label>
            <select value={form.type} onChange={e => { set('type', e.target.value); set('subcategory', e.target.value === 'drink' ? 'Beer' : 'Deli Food') }} className="input-field w-full">
              <option value="drink">Drink</option>
              <option value="food">Food</option>
            </select>
          </div>
          <div>
            <label className="label">Subcategory</label>
            <select value={form.subcategory} onChange={e => set('subcategory', e.target.value)} className="input-field w-full">
              {subcats.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Price (£) *</label>
          <input type="number" step="0.50" min="0" value={form.price} onChange={e => set('price', e.target.value)} className="input-field w-full" placeholder="5.50" />
        </div>
        <div>
          <label className="label">Allergens</label>
          <div className="grid grid-cols-3 gap-1.5">
            {ALLERGENS.map(a => (
              <button key={a} onClick={() => toggleAllergen(a)} className={`py-1.5 px-2 rounded-lg font-barlow text-xs transition-colors ${form.allergens?.includes(a) ? 'bg-orange-700 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
          {saving ? <Spinner size="sm" color="white" /> : (item ? 'Save Changes' : 'Add Item')}
        </button>
      </div>
    </Modal>
  )
}
