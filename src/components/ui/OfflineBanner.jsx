import { useApp } from '../../context/AppContext'

export default function OfflineBanner() {
  const { isOnline } = useApp()
  if (isOnline) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center py-2 font-barlow text-lg font-semibold">
      ⚠ No internet connection — some features unavailable
    </div>
  )
}
