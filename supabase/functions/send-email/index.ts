import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'bookings@tabflow.app'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { type, booking } = await req.json()

  if (type !== 'booking_confirmation' || !booking?.email) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid request' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #d97706;">Booking Confirmed ✓</h1>
      <p>Hi ${booking.name},</p>
      <p>Your reservation has been confirmed. Here are your details:</p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; color: #666;">Date</td><td style="padding: 8px; font-weight: bold;">${booking.date}</td></tr>
        <tr><td style="padding: 8px; color: #666;">Time</td><td style="padding: 8px; font-weight: bold;">${booking.time}</td></tr>
        <tr><td style="padding: 8px; color: #666;">Party Size</td><td style="padding: 8px; font-weight: bold;">${booking.party_size} guests</td></tr>
        ${booking.occasion ? `<tr><td style="padding: 8px; color: #666;">Occasion</td><td style="padding: 8px;">${booking.occasion}</td></tr>` : ''}
        ${booking.special_requests ? `<tr><td style="padding: 8px; color: #666;">Notes</td><td style="padding: 8px;">${booking.special_requests}</td></tr>` : ''}
      </table>
      <p style="margin-top: 24px; color: #666; font-size: 14px;">If you need to make any changes, please contact us as soon as possible.</p>
    </div>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: booking.email,
        subject: `Booking Confirmed — ${booking.date} at ${booking.time}`,
        html,
      }),
    })
    const data = await res.json()
    return new Response(JSON.stringify({ ok: res.ok, data }), {
      headers: { 'Content-Type': 'application/json' },
      status: res.ok ? 200 : 500,
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
