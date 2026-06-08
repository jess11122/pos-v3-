import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { lazy, Suspense, useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import ErrorBoundary from './components/ui/ErrorBoundary'
import OfflineBanner from './components/ui/OfflineBanner'
import Spinner from './components/ui/Spinner'
import SetupWizard from './pages/SetupWizard'
import RoleSelect from './pages/RoleSelect'
import WaiterPage from './pages/waiter/WaiterPage'
import BarPage from './pages/BarPage'
import KitchenPage from './pages/KitchenPage'
import TablesPage from './pages/TablesPage'
import BookingsPage from './pages/BookingsPage'
import AdminPage from './pages/admin/AdminPage'

// Lazy-load heavy/less-frequent pages
const DisplayPage = lazy(() => import('./pages/DisplayPage'))
const GroupDashboard = lazy(() => import('./pages/GroupDashboard'))

// PWA service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// NPS Popup — shown after 30 days of first use
function NpsPopup() {
  const [show, setShow] = useState(false)
  const [score, setScore] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const firstUse = localStorage.getItem('tabflow_first_use')
    if (!firstUse) { localStorage.setItem('tabflow_first_use', Date.now()); return }
    const dismissed = localStorage.getItem('tabflow_nps_dismissed')
    if (dismissed) return
    const days = (Date.now() - parseInt(firstUse)) / (1000 * 60 * 60 * 24)
    if (days >= 30) setShow(true)
  }, [])

  if (!show) return null

  const dismiss = () => {
    localStorage.setItem('tabflow_nps_dismissed', '1')
    setShow(false)
  }

  const submit = async (s) => {
    setScore(s)
    try {
      const { supabase } = await import('./lib/supabase')
      await supabase.from('nps_responses').insert({ score: s })
    } catch {}
    setSubmitted(true)
    setTimeout(dismiss, 2000)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-zinc-800 border border-zinc-700 rounded-2xl p-5 w-80 shadow-2xl animate-slide-up">
      <button onClick={dismiss} className="absolute top-3 right-3 text-zinc-600 hover:text-white font-barlow text-sm">✕</button>
      {submitted ? (
        <div className="text-center py-2">
          <div className="text-3xl mb-2">🙏</div>
          <p className="font-oswald text-white text-lg">Thanks for your feedback!</p>
        </div>
      ) : (
        <>
          <p className="font-oswald text-white text-base mb-1">How likely are you to recommend TabFlow?</p>
          <p className="font-barlow text-zinc-500 text-xs mb-4">0 = not likely · 10 = definitely</p>
          <div className="flex flex-wrap gap-1.5">
            {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
              <button
                key={n}
                onClick={() => submit(n)}
                className={`w-9 h-9 rounded-lg font-oswald text-sm transition-all active:scale-95 ${
                  n >= 9 ? 'bg-green-900/40 text-green-400 hover:bg-green-700' :
                  n >= 7 ? 'bg-amber-900/40 text-amber-400 hover:bg-amber-700' :
                  'bg-red-900/40 text-red-400 hover:bg-red-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function VenuePicker() {
  const { venues, selectVenue } = useApp()
  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-6">
      <div className="bg-zinc-800 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
        <div className="text-4xl mb-4">🏢</div>
        <h1 className="font-oswald text-3xl text-white mb-2">Choose Venue</h1>
        <p className="font-barlow text-zinc-400 mb-6">Select which location you're working at</p>
        <div className="space-y-3">
          {venues.map(v => (
            <button
              key={v.id}
              onClick={() => selectVenue(v)}
              className="w-full bg-zinc-700 hover:bg-amber-600 text-white font-oswald text-xl py-4 rounded-2xl transition-colors"
            >
              {v.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function AppRoutes() {
  const { settings, loadingSettings, settingsError, refreshSettings, venues, currentVenue } = useApp()

  if (loadingSettings) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center flex-col gap-4">
        <div className="text-4xl">🍺</div>
        <Spinner size="lg" />
        <p className="font-barlow text-zinc-500 text-lg">Loading TabFlow…</p>
      </div>
    )
  }

  if (settingsError) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-6">
        <div className="bg-zinc-800 rounded-2xl p-8 max-w-md text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="font-oswald text-2xl text-white mb-2">Cannot connect to database</h2>
          <p className="font-barlow text-zinc-400 text-sm mb-6">{settingsError}</p>
          <button
            onClick={refreshSettings}
            className="bg-amber-600 hover:bg-amber-700 text-white font-oswald px-6 py-3 rounded-xl transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (venues.length > 1 && !currentVenue) {
    return <VenuePicker />
  }

  if (!settings) {
    return <SetupWizard />
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<RoleSelect />} />
        <Route path="/waiter" element={<ErrorBoundary><WaiterPage /></ErrorBoundary>} />
        <Route path="/bar" element={<ErrorBoundary><BarPage /></ErrorBoundary>} />
        <Route path="/kitchen" element={<ErrorBoundary><KitchenPage /></ErrorBoundary>} />
        <Route path="/tables" element={<ErrorBoundary><TablesPage /></ErrorBoundary>} />
        <Route path="/bookings" element={<ErrorBoundary><BookingsPage /></ErrorBoundary>} />
        <Route path="/admin" element={<ErrorBoundary><AdminPage /></ErrorBoundary>} />
        <Route path="/display" element={
          <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><Spinner size="lg" /></div>}>
            <DisplayPage />
          </Suspense>
        } />
        <Route path="/group" element={
          <Suspense fallback={<div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center"><Spinner size="lg" /></div>}>
            <GroupDashboard />
          </Suspense>
        } />
      </Routes>
      <NpsPopup />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <OfflineBanner />
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  )
}
