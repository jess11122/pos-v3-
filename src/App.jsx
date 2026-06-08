import { BrowserRouter, Routes, Route } from 'react-router-dom'
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

function AppRoutes() {
  const { settings, loadingSettings, settingsError, refreshSettings } = useApp()

  if (loadingSettings) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center flex-col gap-4">
        <div className="text-4xl">🍺</div>
        <Spinner size="lg" />
        <p className="font-barlow text-zinc-500 text-lg">Loading TabFlow…</p>
      </div>
    )
  }

  // FIX: show useful error instead of blank screen or wrong wizard
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

  if (!settings) {
    return <SetupWizard />
  }

  return (
    <Routes>
      <Route path="/" element={<RoleSelect />} />
      <Route path="/waiter" element={<ErrorBoundary><WaiterPage /></ErrorBoundary>} />
      <Route path="/bar" element={<ErrorBoundary><BarPage /></ErrorBoundary>} />
      <Route path="/kitchen" element={<ErrorBoundary><KitchenPage /></ErrorBoundary>} />
      <Route path="/tables" element={<ErrorBoundary><TablesPage /></ErrorBoundary>} />
      <Route path="/bookings" element={<ErrorBoundary><BookingsPage /></ErrorBoundary>} />
      <Route path="/admin" element={<ErrorBoundary><AdminPage /></ErrorBoundary>} />
    </Routes>
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
