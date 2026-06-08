import { useState, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { ALLERGENS, DRINK_SUBCATEGORIES } from '../../lib/constants'
import { sanitizeText, sanitizeAllergens, validateOrderItems } from '../../lib/sanitize'
import { printTicket } from '../../lib/printer'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'

export default function MenuStep({ table, checklist, staff, mode, onDone, onBack }) {
  const { settings, happyHourActive, currentVenue } = useApp()
  const [tab, setTab] = useState('drinks')
  const [cart, setCart] = useState([])
  const [note, setNote] = useState('')
  const [filterAllergens, setFilterAllergens] = useState(checklist.allergens || [])
  const [subcategory, setSubcategory] = useState('All')
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showCart, setShowCart] = useState(false)
  // Modifier selection modal
  const [modifierItem, setModifierItem] = useState(null)
  const [selectedMods, setSelectedMods] = useState([])
  const lastSubmit = useRef(0)

  const menuItems = settings?.menu_items || []
  const happyHour = settings?.happy_hour

  const getEffectivePrice = (item) => {
    if (!happyHourActive || !happyHour) return item.price
    const cats = happyHour.categories || []
    if (cats.length > 0 && !cats.includes(item.subcategory)) return item.price
    return item.price * (1 - (happyHour.discount_percent || 0) / 100)
  }

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

  // Cart total accounts for modifiers
  const cartTotal = cart.reduce((s, i) => {
    const modPrice = (i.selectedMods || []).reduce((ms, m) => ms + (m.price || 0), 0)
    return s + (i.price + modPrice) * i.qty
  }, 0)

  const tapItem = (item) => {
    const mods = item.modifiers || []
    if (mods.length > 0) {
      setModifierItem(item)
      setSelectedMods([])
    } else {
      addToCart(item, [])
    }
  }

  const addToCart = (item, mods) => {
    const modPrice = mods.reduce((s, m) => s + (m.price || 0), 0)
    const effectivePrice = getEffectivePrice(item)
    const cartKey = item.id + '|' + mods.map(m => m.id).join(',')
    setCart(prev => {
      const existing = prev.find(x => x.cartKey === cartKey)
      if (existing) return prev.map(x => x.cartKey === cartKey ? { ...x, qty: x.qty + 1 } : x)
      return [...prev, { ...item, price: effectivePrice, cartKey, selectedMods: mods, qty: 1 }]
    })
  }

  const removeItem = (cartKey) => {
    setCart(prev => {
      const existing = prev.find(x => x.cartKey === cartKey)
      if (!existing || existing.qty <= 1) return prev.filter(x => x.cartKey !== cartKey)
      return prev.map(x => x.cartKey === cartKey ? { ...x, qty: x.qty - 1 } : x)
    })
  }

  const getQty = (id) => cart.filter(x => x.id === id).reduce((s, x) => s + x.qty, 0)

  const handleSubmit = async () => {
    if (cart.length === 0) return
    // Rate limit: prevent double-submit within 10 seconds
    if (Date.now() - lastSubmit.current < 10000) {
      alert('Order already sent — please wait before submitting again')
      return
    }
    lastSubmit.current = Date.now()

    // Validate cart items are still in the menu (prevents tampered/stale items)
    const { ok, unknown } = validateOrderItems(cart, menuItems)
    if (!ok) {
      alert(`Some items are no longer available: ${unknown.join(', ')}`)
      return
    }

    setSubmitting(true)

    const foodItems = cart.filter(i => i.type === 'food')
    const drinkItems = cart.filter(i => i.type === 'drink')

    try {
      const cleanNote = sanitizeText(note, 500)
      const cleanAllergens = sanitizeAllergens(checklist.allergens || [])

      const { data: order, error } = await supabase.from('orders').insert({
        table_number: table.number,
        items: cart.map(i => ({
          id: i.id,
          name: i.name + (i.selectedMods?.length ? ' (' + i.selectedMods.map(m => m.name).join(', ') + ')' : ''),
          type: i.type,
          price: i.price + (i.selectedMods || []).reduce((s, m) => s + (m.price || 0), 0),
          qty: i.qty,
        })),
        note: cleanNote,
        total: cartTotal,
        status: 'pending',
        tab_closed: false,
        id_checked: checklist.idChecked,
        allergy_checked: checklist.allergyChecked,
        allergens: cleanAllergens,
        staff_name: staff.name,
        staff_colour: staff.colour,
        ...(currentVenue?.id ? { venue_id: currentVenue.id } : {}),
      }).select().single()

      if (error) throw error

      const routedItems = [
        ...drinkItems.map(i => ({
          order_id: order.id,
          item_name: i.name + (i.selectedMods?.length ? ' (' + i.selectedMods.map(m => m.name).join(', ') + ')' : ''),
          item_type: 'drink',
          quantity: i.qty,
          status: 'pending',
          routed_to: 'bar',
          ...(currentVenue?.id ? { venue_id: currentVenue.id } : {}),
        })),
        ...foodItems.map(i => ({
          order_id: order.id,
          item_name: i.name + (i.selectedMods?.length ? ' (' + i.selectedMods.map(m => m.name).join(', ') + ')' : ''),
          item_type: 'food',
          quantity: i.qty,
          status: 'pending',
          routed_to: 'kitchen',
          ...(currentVenue?.id ? { venue_id: currentVenue.id } : {}),
        })),
      ]
      if (routedItems.length > 0) {
        await supabase.from('order_items_routed').insert(routedItems)
      }

      // Auto-log allergen compliance record (Natasha's Law)
      if (cleanAllergens.length > 0) {
        await supabase.from('compliance_log').insert({
          table_number: table.number,
          staff_name: staff.name,
          allergens: cleanAllergens,
          items: cart.map(i => ({ name: i.name, qty: i.qty })),
          id_checked: checklist.idChecked || false,
          ...(currentVenue?.id ? { venue_id: currentVenue.id } : {}),
        })
      }

      const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      if (drinkItems.length > 0) {
        await printTicket({ type: 'bar', tableNumber: table.number, items: drinkItems.map(i => ({ name: i.name + (i.selectedMods?.length ? ' (' + i.selectedMods.map(m => m.name).join(', ') + ')' : ''), quantity: i.qty })), allergens: checklist.allergens, staffName: staff.name, note, time: timeStr })
      }
      if (foodItems.length > 0) {
        await printTicket({ type: 'kitchen', tableNumber: table.number, items: foodItems.map(i => ({ name: i.name + (i.selectedMods?.length ? ' (' + i.selectedMods.map(m => m.name).join(', ') + ')' : ''), quantity: i.qty })), allergens: checklist.allergens, staffName: staff.name, note, time: timeStr })
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
        {happyHourActive && (
          <span className="bg-amber-600/20 border border-amber-500 text-amber-400 font-barlow text-xs px-2 py-1 rounded-full animate-pulse">
            🍺 Happy Hour {happyHour?.discount_percent}% off
          </span>
        )}
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
                  <MenuItemRow key={item.id} item={item} qty={getQty(item.id)} effectivePrice={getEffectivePrice(item)} happyHour={happyHourActive} onTap={() => tapItem(item)} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="space-y-2">
            {visibleItems.map(item => (
              <MenuItemRow key={item.id} item={item} qty={getQty(item.id)} effectivePrice={getEffectivePrice(item)} happyHour={happyHourActive} onTap={() => tapItem(item)} />
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

      {/* Modifier selection modal */}
      {modifierItem && (
        <Modal title={modifierItem.name} onClose={() => setModifierItem(null)} size="sm">
          <div className="space-y-3">
            <p className="font-barlow text-zinc-400 text-sm">Select options:</p>
            {(modifierItem.modifiers || []).map(mod => {
              const selected = selectedMods.find(m => m.id === mod.id)
              return (
                <button
                  key={mod.id}
                  onClick={() => setSelectedMods(prev => prev.find(m => m.id === mod.id) ? prev.filter(m => m.id !== mod.id) : [...prev, mod])}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-barlow text-base transition-colors ${selected ? 'bg-amber-600 text-white' : 'bg-zinc-700 text-white hover:bg-zinc-600'}`}
                >
                  <span>{mod.name}</span>
                  <span className="text-sm opacity-75">{mod.price > 0 ? `+£${mod.price.toFixed(2)}` : mod.price < 0 ? `−£${Math.abs(mod.price).toFixed(2)}` : 'Included'}</span>
                </button>
              )
            })}
            <button
              onClick={() => { addToCart(modifierItem, selectedMods); setModifierItem(null) }}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-oswald text-lg py-4 rounded-xl transition-colors"
            >
              Add to Order — £{(getEffectivePrice(modifierItem) + selectedMods.reduce((s, m) => s + (m.price || 0), 0)).toFixed(2)}
            </button>
          </div>
        </Modal>
      )}

      {/* Cart drawer */}
      {showCart && (
        <Modal title="Order Summary" onClose={() => setShowCart(false)} size="md">
          <div className="space-y-3">
            {cart.map(item => {
              const linePrice = (item.price + (item.selectedMods || []).reduce((s, m) => s + (m.price || 0), 0)) * item.qty
              return (
                <div key={item.cartKey} className="flex items-center gap-3">
                  <button onClick={() => removeItem(item.cartKey)} className="w-8 h-8 bg-zinc-700 rounded-full text-white hover:bg-red-700 transition-colors flex items-center justify-center">−</button>
                  <span className="font-barlow text-zinc-400 text-base w-6 text-center">{item.qty}×</span>
                  <div className="flex-1">
                    <span className="font-barlow text-white text-base">{item.name}</span>
                    {item.selectedMods?.length > 0 && <p className="font-barlow text-zinc-500 text-xs">{item.selectedMods.map(m => m.name).join(', ')}</p>}
                  </div>
                  <span className="font-barlow text-zinc-300 text-base">£{linePrice.toFixed(2)}</span>
                  <button onClick={() => addToCart(item, item.selectedMods || [])} className="w-8 h-8 bg-zinc-700 rounded-full text-white hover:bg-green-700 transition-colors flex items-center justify-center">+</button>
                </div>
              )
            })}
            <div className="border-t border-zinc-700 pt-3 flex justify-between">
              <span className="font-oswald text-white text-xl">Total</span>
              <span className="font-oswald text-amber-500 text-xl">£{cartTotal.toFixed(2)}</span>
            </div>
            {happyHourActive && (
              <p className="font-barlow text-amber-400 text-sm text-center">🍺 Happy hour {happyHour?.discount_percent}% discount applied</p>
            )}
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
              {cart.map(item => {
                const linePrice = (item.price + (item.selectedMods || []).reduce((s, m) => s + (m.price || 0), 0)) * item.qty
                return (
                  <div key={item.cartKey}>
                    <div className="flex justify-between font-barlow text-white text-base">
                      <span>{item.qty}× {item.name}</span>
                      <span>£{linePrice.toFixed(2)}</span>
                    </div>
                    {item.selectedMods?.length > 0 && (
                      <p className="font-barlow text-zinc-500 text-xs ml-4">{item.selectedMods.map(m => m.name).join(', ')}</p>
                    )}
                  </div>
                )
              })}
              <div className="border-t border-zinc-600 pt-2 flex justify-between">
                <span className="font-oswald text-white">Total</span>
                <span className="font-oswald text-amber-500">£{cartTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-3 text-sm font-barlow text-zinc-400 flex-wrap">
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

function MenuItemRow({ item, qty, effectivePrice, happyHour, onTap }) {
  const hasDiscount = happyHour && effectivePrice < item.price
  return (
    <button
      onClick={onTap}
      className={`w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 transition-all active:scale-[0.98] ${
        qty > 0 ? 'bg-amber-900/30 border border-amber-700/50' : 'bg-zinc-800 border border-transparent hover:bg-zinc-700'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-barlow text-white text-base font-semibold leading-tight">{item.name}</div>
        {item.allergens?.length > 0 && (
          <div className="font-barlow text-orange-400 text-xs mt-0.5">{item.allergens.join(' · ')}</div>
        )}
        {item.modifiers?.length > 0 && (
          <div className="font-barlow text-zinc-500 text-xs mt-0.5">Tap to choose options</div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {hasDiscount && <div className="font-barlow text-zinc-500 text-xs line-through">£{item.price.toFixed(2)}</div>}
        <div className={`font-barlow text-base font-semibold ${hasDiscount ? 'text-amber-400' : 'text-zinc-300'}`}>£{effectivePrice.toFixed(2)}</div>
      </div>
      {qty > 0 && (
        <div className="flex-shrink-0 w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center">
          <span className="font-oswald text-white text-base leading-none">{qty}</span>
        </div>
      )}
      {qty === 0 && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full border border-zinc-600 flex items-center justify-center text-zinc-500 text-lg">
          +
        </div>
      )}
    </button>
  )
}
