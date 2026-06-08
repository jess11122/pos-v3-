import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import Spinner from '../../components/ui/Spinner'

const INTEGRATIONS = [
  {
    id: 'google_reviews',
    name: 'Google Reviews',
    description: 'Automatically send customers a review request SMS after their tab closes. Boosts your Google rating passively.',
    category: 'Marketing',
    status: 'active',
    icon: '⭐',
    colour: 'border-yellow-700/40 bg-yellow-900/10',
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Sync your loyalty members and booking list to Mailchimp. Run automated email campaigns to drive repeat visits.',
    category: 'Marketing',
    status: 'active',
    icon: '📧',
    colour: 'border-amber-700/40 bg-amber-900/10',
  },
  {
    id: 'deliverect',
    name: 'Deliverect',
    description: 'Connect Deliveroo and Uber Eats orders directly into TabFlow. Orders appear on the kitchen screen automatically.',
    category: 'Orders',
    status: 'coming_soon',
    icon: '🛵',
    colour: 'border-zinc-700/40 bg-zinc-800/30',
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Sync daily revenue, tips, and voids directly into Xero accounting. End-of-day reconciliation in one click.',
    category: 'Finance',
    status: 'coming_soon',
    icon: '📊',
    colour: 'border-zinc-700/40 bg-zinc-800/30',
  },
  {
    id: 'opentable',
    name: 'OpenTable',
    description: 'Import OpenTable reservations into TabFlow bookings automatically. No double-entry needed.',
    category: 'Bookings',
    status: 'coming_soon',
    icon: '🍽',
    colour: 'border-zinc-700/40 bg-zinc-800/30',
  },
  {
    id: 'stripe',
    name: 'Stripe Terminal',
    description: 'Process card payments directly through TabFlow via Stripe Terminal. No third-party card machine needed.',
    category: 'Payments',
    status: 'coming_soon',
    icon: '💳',
    colour: 'border-zinc-700/40 bg-zinc-800/30',
  },
]

export default function MarketplaceAdmin() {
  const { settings, updateSettings } = useApp()
  const [connecting, setConnecting] = useState('')
  const [googleKey, setGoogleKey] = useState(settings?.integrations?.google_review_link || '')
  const [mailchimpKey, setMailchimpKey] = useState(settings?.integrations?.mailchimp_api_key || '')
  const [activeModal, setActiveModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const connected = settings?.integrations || {}

  const save = async (patch) => {
    setSaving(true)
    await updateSettings({ integrations: { ...connected, ...patch } })
    setMsg('✓ Saved')
    setTimeout(() => setMsg(''), 2000)
    setSaving(false)
    setActiveModal(null)
  }

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-5">
      <div className="bg-zinc-800 rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-oswald text-white text-xl">TabFlow Marketplace</h2>
            <p className="font-barlow text-zinc-400 text-sm mt-1">Connect TabFlow to the tools your venue already uses</p>
          </div>
          <span className="bg-purple-900/30 border border-purple-700/40 text-purple-400 text-xs font-barlow px-3 py-1 rounded-full">Integrations</span>
        </div>
      </div>

      {msg && <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-3 font-barlow text-green-400 text-sm">{msg}</div>}

      <div className="grid gap-4">
        {INTEGRATIONS.map(integration => {
          const isConnected = connected[integration.id + '_connected']
          return (
            <div key={integration.id} className={`rounded-2xl p-5 border ${integration.colour}`}>
              <div className="flex items-start gap-4">
                <div className="text-3xl">{integration.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-oswald text-white text-lg">{integration.name}</h3>
                    <span className="font-barlow text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{integration.category}</span>
                    {isConnected && <span className="font-barlow text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400">Connected</span>}
                  </div>
                  <p className="font-barlow text-zinc-400 text-sm mb-3">{integration.description}</p>
                  {integration.status === 'coming_soon' ? (
                    <span className="font-barlow text-xs px-3 py-1.5 bg-zinc-700/50 text-zinc-500 rounded-xl">Coming Soon</span>
                  ) : (
                    <button
                      onClick={() => setActiveModal(integration.id)}
                      className="font-barlow text-sm px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors"
                    >
                      {isConnected ? 'Configure' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Google Reviews modal */}
      {activeModal === 'google_reviews' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-5">
          <div className="bg-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-oswald text-white text-xl">Connect Google Reviews</h3>
            <p className="font-barlow text-zinc-400 text-sm">Paste your Google Business review link. Staff can send this to customers after payment via SMS.</p>
            <div>
              <label className="label">Google Review Link</label>
              <input value={googleKey} onChange={e => setGoogleKey(e.target.value)} className="input-field w-full text-sm" placeholder="https://g.page/r/..." />
            </div>
            <p className="font-barlow text-zinc-500 text-xs">Find this in Google Business Profile → Get more reviews → Share review form</p>
            <div className="flex gap-3">
              <button onClick={() => save({ google_review_link: googleKey, google_reviews_connected: true })} disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald py-3 rounded-xl transition-colors">
                {saving ? <Spinner size="sm" color="white" /> : 'Save & Connect'}
              </button>
              <button onClick={() => setActiveModal(null)} className="px-4 bg-zinc-700 hover:bg-zinc-600 text-white font-barlow rounded-xl transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Mailchimp modal */}
      {activeModal === 'mailchimp' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-5">
          <div className="bg-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-oswald text-white text-xl">Connect Mailchimp</h3>
            <p className="font-barlow text-zinc-400 text-sm">Enter your Mailchimp API key to sync loyalty members and booking contacts.</p>
            <div>
              <label className="label">API Key</label>
              <input type="password" value={mailchimpKey} onChange={e => setMailchimpKey(e.target.value)} className="input-field w-full font-mono text-sm" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us1" />
            </div>
            <p className="font-barlow text-zinc-500 text-xs">Found in Mailchimp: Account → Extras → API keys</p>
            <div className="flex gap-3">
              <button onClick={() => save({ mailchimp_api_key: mailchimpKey, mailchimp_connected: true })} disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald py-3 rounded-xl transition-colors">
                {saving ? <Spinner size="sm" color="white" /> : 'Save & Connect'}
              </button>
              <button onClick={() => setActiveModal(null)} className="px-4 bg-zinc-700 hover:bg-zinc-600 text-white font-barlow rounded-xl transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
