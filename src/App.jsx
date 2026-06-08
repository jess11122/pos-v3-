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
  const { settings, loadingSettings } = useApp()

  if (loadingSettings) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center flex-col gap-4">
        <div className="text-4xl">🍺</div>
        <Spinner size="lg" />
        <p className="font-barlow text-zinc-500 text-lg">Loading TabFlow…</p>
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
