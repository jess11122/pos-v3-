// Booking confirmation emails via Resend (called from Supabase Edge Function in production)
export async function sendBookingConfirmation(booking) {
  const edgeFnUrl = import.meta.env.VITE_SUPABASE_URL?.replace('.supabase.co', '.supabase.co/functions/v1/send-email')
  if (!edgeFnUrl || edgeFnUrl.includes('placeholder')) {
    // Dev mode — no-op (never log booking data to console)
    return { ok: true }
  }
  try {
    const res = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'booking_confirmation', booking }),
    })
    return { ok: res.ok }
  } catch {
    // Intentionally generic — don't expose network details to console in prod
    return { ok: false }
  }
}
