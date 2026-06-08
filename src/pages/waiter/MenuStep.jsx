import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { ALLERGENS, DRINK_SUBCATEGORIES } from '../../lib/constants'
import { printTicket } from '../../lib/printer'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'

export default function MenuStep({ table, checklist, staff, mode, onDone, onBack }) {
  const { settings } = useApp()
  const [tab, setTab] = useState('drinks')
  const [cart, setCart] = useState([])
  const [note, setNote] = useState('')
  const [filterAllergens, setFilterAllergens] = useState(checklist.allergens || [])
  const [subcategory, setSubcategory] = useState('All')
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showCart, setShowCart] = useState(false)

  const menuItems = settings?.menu_items || []

  const drinks = menuItems.filter(i => i.type === 'drink' && i.active !== false)
  const food = menuItems.filter(i => i.type === 'food' && i.active !== false)

  const visibleDrinks = useMemo(() => {
    let items = drinks
    if (filterAllergens.length > 0) items = items.filter(i => !i.allergens?.some(a => filterAllergens.includes(a)))
    if (subcategory !== 'All') items = items.filter(i => i.subcategory === subcategory)
    return items
  }, [drinks, filterAllergens, subcategory])

  const visibleFood = useMemo(() => {
    if (filterAllergens.length > 0) return food.filter(i => !i.allergens?.some(a => filterAllergens.includes(a)))
    return food
  }, [food, filterAllergens])

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)

  const addItem = (item) => {
    setCart(prev => {
      const existing = prev.find(x => x.id === item.id)
      if (existing) return prev.map(x => x.id === item.id ? { ...x, qty: x.qty + 1 } : x)
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const removeItem = (id) => {
    setCart(prev => {
      const existing = prev.find(x => x.id === id)
      if (!existing || existing.qty <= 1) return prev.filter(x => x.id !== id)
      return prev.map(x => x.id === id ? { ...x, qty: x.qty - 1 } : x)
    })
  }

  const getQty = (id) => cart.find(x => x.id === id)?.qty || 0

  const handleSubmit = async () => {
    if (cart.length === 0) return
    setSubmitting(true)

    const foodItems = cart.filter(i => i.type === 'food')
    const drinkItems = cart.filter(i => i.type === 'drink')

    try {
      // Insert order
      const { data: order, error } = await supabase.from('orders').insert({
        table_number: table.number,
        items: cart.map(i => ({ id: i.id, name: i.name, type: i.type, price: i.price, qty: i.qty })),
        note,
        total: cartTotal,
        status: 'pending',
        tab_closed: false,
        id_checked: checklist.idChecked,
        allergy_checked: checklist.allergyChecked,
        allergens: checklist.allergens,
        staff_name: staff.name,
        staff_colour: staff.colour,
      }).select().single()

      if (error) throw error

      // Insert routed items
      const routedItems = [
        ...drinkItems.map(i => ({
          order_id: order.id,
          item_name: i.name,
          item_type: 'drink',
          quantity: i.qty,
          status: 'pending',
          routed_to: 'bar',
        })),
        ...foodItems.map(i => ({
          order_id: order.id,
          item_name: i.name,
          item_type: 'food',
          quantity: i.qty,
          status: 'pending',
          routed_to: 'kitchen',
        })),
      ]
      if (routedItems.length > 0) {
        await supabase.from('order_items_routed').insert(routedItems)
      }

      // Print tickets
      const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      if (drinkItems.length > 0) {
        await printTicket({ type: 'bar', tableNumber: table.number, items: drinkItems.map(i => ({ name: i.name, quantity: i.qty })), allergens: checklist.allergens, staffName: staff.name, note, time: timeStr })
      }
      if (foodItems.length > 0) {
        await printTicket({ type: 'kitchen', tableNumber: table.number, items: foodItems.map(i => ({ name: i.name, quantity: i.qty })), allergens: checklist.allergens, staffName: staff.name, note, time: timeStr })
      }

      setShowConfirm(false)
      setSuccess(true)
      setTimeout(onDone, 3000)
    } catch (e) {
      console.error(e)
      alert('Failed to send order: ' + e.message)
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center gap-6">
        <div className="text-7xl animate-bounce">✅</div>
        <h2 className="font-oswald text-3xl text-white">Order Sent!</h2>
        <p className="font-barlow text-zinc-400 text-lg">Table {table.number} · {cart.length} item{cart.length > 1 ? 's' : ''} · £{cartTotal.toFixed(2)}</p>
        <p className="font-barlow text-zinc-500 text-sm">Returning to floor map...</p>
      </div>
    )
  }

  const visibleItems = tab === 'drinks' ? visibleDrinks : visibleFood

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      <header className="bg-zinc-900 px-5 py-4 flex items-center gap-4 border-b border-zinc-800">
        <button onClick={onBack} className="text-zinc-400 hover:text-white font-barlow text-2xl touch-btn w-10 h-10 flex items-center justify-center">←</button>
        <div className="flex-1">
          <h1 className="font-oswald text-2xl text-white">Menu — Table {table.number}</h1>
          {checklist.allergens?.length > 0 && (
            <p className="font-barlow text-red-400 text-sm">⚠ Allergens: {checklist.allergens.join(', ')}</p>
          )}
        </div>
        <button
          onClick={() => setShowCart(true)}
          className="relative bg-amber-600 text-white font-oswald px-4 py-2 rounded-xl flex items-center gap-2"
        >
          🛒 {cart.length > 0 && <span className="bg-white text-amber-700 rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">{cart.reduce((s, i) => s + i.qty, 0)}</span>}
          <span>£{cartTotal.toFixed(2)}</span>
        </button>
      </header>

      {/* Tab selector */}
      <div className="flex bg-zinc-900 border-b border-zinc-800">
        {['drinks', 'food'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 font-oswald text-lg transition-colors ${tab === t ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-400 hover:text-white'}`}
          >
            {t === 'drinks' ? '🍺 Drinks' : '🍽 Food'}
          </button>
        ))}
      </div>

      {/* Allergen filter bar */}
      {checklist.allergens?.length > 0 && (
        <div className="bg-red-900/30 border-b border-red-900/50 px-4 py-2 flex items-center gap-2 flex-wrap">
          <span className="font-barlow text-red-400 text-sm font-semibold">Hiding allergens:</span>
          {ALLERGENS.map(a => (
            <button
              key={a}
              onClick={() => setFilterAllergens(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
              className={`font-barlow text-xs px-2 py-1 rounded-full transition-colors ${filterAllergens.includes(a) ? 'bg-red-600 text-white' : 'bg-zinc-700 text-zinc-400'}`}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {/* Subcategory tabs for drinks */}
      {tab === 'drinks' && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-zinc-900/50 border-b border-zinc-800">
          {['All', ...DRINK_SUBCATEGORIES].map(s => (
            <button
              key={s}
              onClick={() => setSubcategory(s)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl font-barlow text-sm transition-colors ${subcategory === s ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Menu items */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'drinks' && subcategory === 'All' ? (
          DRINK_SUBCATEGORIES.filter(sc => visibleDrinks.some(i => i.subcategory === sc)).map(sc => (
            <div key={sc} className="mb-6">
              <h3 className="font-oswald text-zinc-400 text-base tracking-widest mb-2 uppercase">{sc}</h3>
              <div className="space-y-2">
                {visibleDrinks.filter(i => i.subcategory === sc).map(item => (
                  <MenuItemRow key={item.id} item={item} qty={getQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item.id)} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="space-y-2">
            {visibleItems.map(item => (
              <MenuItemRow key={item.id} item={item} qty={getQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item.id)} />
            ))}
            {visibleItems.length === 0 && (
              <div className="text-center text-zinc-500 font-barlow text-lg py-12">
                No items — all filtered by allergens or no items in this category
              </div>
            )}
          </div>
        )}
      </div>

      {/* Send order button */}
      {cart.length > 0 && (
        <div className="p-4 border-t border-zinc-800 bg-zinc-900">
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-oswald text-xl py-5 rounded-2xl transition-colors"
          >
            Send Order · £{cartTotal.toFixed(2)}
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <Modal title="Order Summary" onClose={() => setShowCart(false)} size="md">
          <div className="space-y-3">
            {cart.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <button onClick={() => removeItem(item.id)} className="w-8 h-8 bg-zinc-700 rounded-full text-white hover:bg-red-700 transition-colors flex items-center justify-center">−</button>
                <span className="font-barlow text-zinc-400 text-base w-6 text-center">{item.qty}×</span>
                <span className="font-barlow text-white flex-1 text-base">{item.name}</span>
                <span className="font-barlow text-zinc-300 text-base">£{(item.price * item.qty).toFixed(2)}</span>
                <button onClick={() => addItem(item)} className="w-8 h-8 bg-zinc-700 rounded-full text-white hover:bg-green-700 transition-colors flex items-center justify-center">+</button>
              </div>
            ))}
            <div className="border-t border-zinc-700 pt-3 flex justify-between">
              <span className="font-oswald text-white text-xl">Total</span>
              <span className="font-oswald text-amber-500 text-xl">£{cartTotal.toFixed(2)}</span>
            </div>
            <div>
              <label className="font-barlow text-zinc-400 text-sm block mb-1">Special note (optional)</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="E.g. no ice, extra lemon..."
                rows={2}
                className="w-full bg-zinc-700 text-white font-barlow text-base rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-amber-600 resize-none"
              />
            </div>
            <button
              onClick={() => { setShowCart(false); setShowConfirm(true) }}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-oswald text-xl py-4 rounded-xl transition-colors"
            >
              Confirm & Send →
            </button>
          </div>
        </Modal>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <Modal title="Confirm Order" onClose={() => !submitting && setShowConfirm(false)} size="md">
          <div className="space-y-4">
            <div className="bg-zinc-700 rounded-xl p-4 space-y-2">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between font-barlow text-white text-base">
                  <span>{item.qty}× {item.name}</span>
                  <span>£{(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-zinc-600 pt-2 flex justify-between">
                <span className="font-oswald text-white">Total</span>
                <span className="font-oswald text-amber-500">£{cartTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-3 text-sm font-barlow text-zinc-400">
              <span>Table {table.number}</span>
              <span>·</span>
              <span>{staff.name}</span>
              {checklist.allergens?.length > 0 && (
                <><span>·</span><span className="text-red-400">⚠ {checklist.allergens.join(', ')}</span></>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-oswald text-xl py-5 rounded-2xl transition-colors flex items-center justify-center gap-3"
            >
              {submitting ? <Spinner size="sm" color="white" /> : '✓'} Send to Bar & Kitchen
            </button>
            <button onClick={() => setShowConfirm(false)} disabled={submitting} className="w-full text-zinc-400 font-barlow py-2 hover:text-white">
              Back to Menu
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function MenuItemRow({ item, qty, onAdd, onRemove }) {
  return (
    <div className="bg-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className="flex-1">
        <div className="font-barlow text-white text-base font-semibold">{item.name}</div>
        {item.allergens?.length > 0 && (
          <div className="font-barlow text-orange-400 text-xs mt-0.5">{item.allergens.join(' · ')}</div>
        )}
      </div>
      <div className="font-barlow text-zinc-300 text-base mr-2">£{item.price.toFixed(2)}</div>
      <div className="flex items-center gap-2">
        {qty > 0 && (
          <button onClick={onRemove} className="w-9 h-9 bg-zinc-700 rounded-full text-white hover:bg-red-700 transition-colors flex items-center justify-center font-bold text-lg">−</button>
        )}
        {qty > 0 && <span className="font-oswald text-white text-lg w-5 text-center">{qty}</span>}
        <button onClick={onAdd} className="w-9 h-9 bg-amber-600 rounded-full text-white hover:bg-amber-700 transition-colors flex items-center justify-center font-bold text-lg">+</button>
      </div>
    </div>
  )
}
