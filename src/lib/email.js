// Booking confirmation emails via Resend (called from Supabase Edge Function in production)
// In dev, logs to console

export async function sendBookingConfirmation(booking) {
  const edgeFnUrl = import.meta.env.VITE_SUPABASE_URL?.replace('.supabase.co', '.supabase.co/functions/v1/send-email')
  if (!edgeFnUrl || edgeFnUrl.includes('placeholder')) {
    console.log('Email (dev):', booking)
    return { ok: true }
  }
  try {
    const res = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'booking_confirmation', booking }),
    })
    return { ok: res.ok }
  } catch (e) {
    console.error('Email send failed:', e)
    return { ok: false }
  }
}
