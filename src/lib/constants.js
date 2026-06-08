export const ALLERGENS = [
  'Gluten', 'Crustaceans', 'Eggs', 'Fish', 'Peanuts',
  'Soybeans', 'Milk', 'Nuts', 'Celery', 'Mustard',
  'Sesame', 'Sulphites', 'Lupin', 'Molluscs',
]

export const DRINK_SUBCATEGORIES = [
  'Beer', 'Wine', 'Spirits', 'Cocktails', 'Soft Drinks', 'Hot Drinks', 'Other',
]

export const BOOKING_TIMES = (() => {
  const times = []
  for (let h = 11; h <= 22; h++) {
    times.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 22 || true) times.push(`${String(h).padStart(2, '0')}:30`)
  }
  return times.filter(t => t <= '22:30')
})()

export const BOOKING_STATUSES = ['confirmed', 'arrived', 'no_show', 'cancelled']

export const STATUS_COLOURS = {
  confirmed: 'bg-blue-600',
  arrived: 'bg-green-600',
  no_show: 'bg-red-600',
  cancelled: 'bg-zinc-600',
}

export const ORDER_STATUS = {
  PENDING: 'pending',
  COMPLETE: 'complete',
}

export const ITEM_STATUS = {
  PENDING: 'pending',
  MAKING: 'making',
  READY: 'ready',
  COMPLETE: 'complete',
}

export const ADMIN_PIN_DEFAULT = '1234'
