'use server'

import { revalidatePath } from 'next/cache'
import { sendDigest } from '@/app/lib/digest'

export interface SendDigestOutcome {
  ok: boolean
  message: string
}

/** Manual "Send digest now" trigger from the /digest page. */
export async function sendDigestAction(): Promise<SendDigestOutcome> {
  const r = await sendDigest({ force: true })
  revalidatePath('/digest')
  if (r.sent.ok) return { ok: true, message: `Sent — ${r.built.total} leads (id ${r.sent.id ?? '—'})` }
  if (r.sent.skipped) return { ok: false, message: `Not sent: ${r.sent.error}` }
  return { ok: false, message: `Delivery failed: ${r.sent.error}` }
}
