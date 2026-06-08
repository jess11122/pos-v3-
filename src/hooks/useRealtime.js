import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// FIX: handle TIMED_OUT + CLOSED (not just CHANNEL_ERROR), debounce callbacks
// so 10 devices firing simultaneously don't trigger 10 re-queries per device.
export function useRealtime(table, onUpdate, filter = null, debounceMs = 300) {
  const cbRef = useRef(onUpdate)
  cbRef.current = onUpdate
  const debounceTimer = useRef(null)

  useEffect(() => {
    let channel
    let retryTimer
    let mounted = true

    const debouncedUpdate = (payload) => {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        if (mounted) cbRef.current(payload)
      }, debounceMs)
    }

    const subscribe = () => {
      if (!mounted) return
      const channelName = `rt-${table}-${Math.random().toString(36).slice(2)}`
      const config = { event: '*', schema: 'public', table }
      if (filter) config.filter = filter

      channel = supabase
        .channel(channelName)
        .on('postgres_changes', config, debouncedUpdate)
        .subscribe((status) => {
          // FIX: reconnect on any non-healthy status
          if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status) && mounted) {
            channel?.unsubscribe()
            retryTimer = setTimeout(subscribe, 3000)
          }
        })
    }

    subscribe()

    return () => {
      mounted = false
      clearTimeout(retryTimer)
      clearTimeout(debounceTimer.current)
      channel?.unsubscribe()
    }
  }, [table, filter, debounceMs])
}
