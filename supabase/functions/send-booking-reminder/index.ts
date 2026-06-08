import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { booking_id } = await req.json()
    if (!booking_id) throw new Error('booking_id required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch the booking
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single()
    if (bErr) throw bErr
    if (!booking.phone) throw new Error('Booking has no phone number')

    // Fetch Twilio credentials from settings
    const { data: settings, error: sErr } = await supabase
      .from('settings')
      .select('twilio,venue_name')
      .limit(1)
      .single()
    if (sErr) throw sErr

    const { account_sid, auth_token, from_number } = settings?.twilio || {}
    if (!account_sid || !auth_token || !from_number) throw new Error('Twilio credentials not configured in Admin → Settings')

    // Build SMS message
    const venueName = settings.venue_name || 'the venue'
    const msg = `Hi ${booking.name}! Just a reminder you have a booking at ${venueName} on ${booking.date} at ${booking.time} for ${booking.party_size} guests. See you soon!`

    // Send via Twilio REST API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`
    const body = new URLSearchParams({
      To: booking.phone,
      From: from_number,
      Body: msg,
    })

    const res = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${account_sid}:${auth_token}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    const result = await res.json()
    if (!res.ok) throw new Error(result.message || 'Twilio error')

    return new Response(JSON.stringify({ success: true, sid: result.sid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
