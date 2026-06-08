import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [settingsError, setSettingsError] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [venues, setVenues] = useState([])
  const [currentVenue, setCurrentVenue] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tabflow_venue') || 'null') }
    catch { return null }
  })
  const [selectedStaff, setSelectedStaff] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('tabflow_staff') || 'null') }
    catch { return null }
  })

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const loadSettings = useCallback(async (venueId = null) => {
    try {
      setSettingsError(null)
      // Multi-venue: filter by venue_id if one is selected
      let q = supabase.from('settings').select('*').limit(1)
      if (venueId) q = q.eq('venue_id', venueId)
      const { data, error } = await q.maybeSingle()
      if (error && error.code !== 'PGRST116') {
        setSettingsError(error.message)
        setSettings(null)
      } else {
        setSettings(data || null)
      }
    } catch (e) {
      setSettingsError(e.message)
      setSettings(null)
    } finally {
      setLoadingSettings(false)
    }
  }, [])

  const loadVenues = useCallback(async () => {
    const { data } = await supabase.from('venues').select('*').order('created_at')
    setVenues(data || [])
    return data || []
  }, [])

  useEffect(() => {
    const init = async () => {
      const venueList = await loadVenues()
      if (venueList.length === 0) {
        // No venues yet — single-venue legacy mode, load settings directly
        await loadSettings(null)
      } else if (venueList.length === 1) {
        // Auto-select single venue
        const v = venueList[0]
        setCurrentVenue(v)
        localStorage.setItem('tabflow_venue', JSON.stringify(v))
        await loadSettings(v.id)
      } else if (currentVenue) {
        // Multiple venues, use stored selection
        await loadSettings(currentVenue.id)
      } else {
        // Multiple venues, none selected — show venue picker
        setLoadingSettings(false)
      }
    }
    init()
  }, [loadSettings, loadVenues])

  // Realtime subscription to settings so 86 toggles, happy hour etc
  // propagate to all devices instantly without page refresh
  useEffect(() => {
    if (!settings?.id) return
    const channel = supabase
      .channel(`settings-${settings.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings', filter: `id=eq.${settings.id}` },
        (payload) => { setSettings(payload.new) }
      )
      .subscribe()
    return () => channel.unsubscribe()
  }, [settings?.id])

  const selectVenue = async (venue) => {
    setCurrentVenue(venue)
    localStorage.setItem('tabflow_venue', JSON.stringify(venue))
    setLoadingSettings(true)
    await loadSettings(venue.id)
  }

  const saveStaff = (staff) => {
    setSelectedStaff(staff)
    if (staff) sessionStorage.setItem('tabflow_staff', JSON.stringify(staff))
    else sessionStorage.removeItem('tabflow_staff')
  }

  const refreshSettings = async () => {
    let q = supabase.from('settings').select('*').limit(1)
    if (currentVenue?.id) q = q.eq('venue_id', currentVenue.id)
    const { data } = await q.maybeSingle()
    setSettings(data)
    return data
  }

  // Helper: update a single settings field without full refresh
  const updateSettings = async (patch) => {
    if (!settings?.id) return
    const { data } = await supabase.from('settings').update(patch).eq('id', settings.id).select().single()
    setSettings(data)
    return data
  }

  // Check if happy hour is currently active
  const happyHourActive = (() => {
    const hh = settings?.happy_hour
    if (!hh?.enabled) return false
    const now = new Date()
    const [sh, sm] = hh.start.split(':').map(Number)
    const [eh, em] = hh.end.split(':').map(Number)
    const start = sh * 60 + sm
    const end = eh * 60 + em
    const current = now.getHours() * 60 + now.getMinutes()
    return current >= start && current <= end
  })()

  return (
    <AppContext.Provider value={{
      settings, loadingSettings, settingsError, refreshSettings, updateSettings,
      selectedStaff, saveStaff, isOnline,
      venues, currentVenue, selectVenue,
      happyHourActive,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
