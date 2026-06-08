export default function Spinner({ size = 'md', color = 'amber' }) {
  const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' }
  const colors = { amber: 'border-amber-600', white: 'border-white', green: 'border-green-500' }
  return (
    <div className={`${sizes[size]} border-4 border-zinc-600 ${colors[color]} border-t-transparent rounded-full animate-spin`} />
  )
}
