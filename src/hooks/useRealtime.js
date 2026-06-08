import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useRealtime(table, onUpdate, filter = null) {
  const cbRef = useRef(onUpdate)
  cbRef.current = onUpdate

  useEffect(() => {
    let channel
    let retryTimer

    const subscribe = () => {
      let q = supabase.channel(`rt-${table}-${Math.random()}`)
      const config = { event: '*', schema: 'public', table }
      if (filter) config.filter = filter

      channel = q
        .on('postgres_changes', config, (payload) => cbRef.current(payload))
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            channel.unsubscribe()
            retryTimer = setTimeout(subscribe, 3000)
          }
        })
    }

    subscribe()
    return () => {
      clearTimeout(retryTimer)
      channel?.unsubscribe()
    }
  }, [table, filter])
}
