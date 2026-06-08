import { useEffect } from 'react'

export default function Modal({ children, onClose, title, size = 'md' }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl', full: 'max-w-full' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-zinc-800 rounded-2xl w-full ${sizes[size]} shadow-2xl fade-in max-h-[90vh] flex flex-col`}>
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-zinc-700 flex-shrink-0">
            <h2 className="font-oswald text-xl text-white">{title}</h2>
            {onClose && (
              <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl leading-none touch-btn w-10 h-10 flex items-center justify-center">
                ×
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
      </div>
    </div>
  )
}
