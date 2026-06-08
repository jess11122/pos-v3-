import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [settingsError, setSettingsError] = useState(null) // FIX: distinguish error from no-settings
  const [isOnline, setIsOnline] = useState(navigator.onLine)
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

  const loadSettings = useCallback(async () => {
    try {
      setSettingsError(null)
      const { data, error } = await supabase.from('settings').select('*').limit(1).single()
      // PGRST116 = no rows found (not an error — just first-time setup)
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

  useEffect(() => { loadSettings() }, [loadSettings])

  const saveStaff = (staff) => {
    setSelectedStaff(staff)
    if (staff) sessionStorage.setItem('tabflow_staff', JSON.stringify(staff))
    else sessionStorage.removeItem('tabflow_staff')
  }

  const refreshSettings = async () => {
    const { data } = await supabase.from('settings').select('*').limit(1).single()
    setSettings(data)
    return data
  }

  return (
    <AppContext.Provider value={{
      settings, loadingSettings, settingsError, refreshSettings,
      selectedStaff, saveStaff, isOnline,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
