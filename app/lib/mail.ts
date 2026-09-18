// Minimal Resend HTTP-API mailer. Delivery requires RESEND_API_KEY set AND the
// DIGEST_FROM address's domain verified in the Resend account. Returns a status
// object instead of throwing so callers can degrade gracefully.

export interface SendResult {
  ok: boolean
  id?: string
  error?: string
  skipped?: boolean
}

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
  from?: string
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return { ok: false, skipped: true, error: 'RESEND_API_KEY not set' }
  const from = opts.from ?? process.env.DIGEST_FROM ?? 'BizHub <onboarding@resend.dev>'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html }),
      signal: AbortSignal.timeout(20_000),
    })
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!res.ok) return { ok: false, error: body.message || `HTTP ${res.status}` }
    return { ok: true, id: body.id }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
