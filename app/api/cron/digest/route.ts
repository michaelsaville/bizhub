// Cron: build + send the weekly lead digest via Resend. Advances the "last
// sent" watermark only on a successful send. Schedule weekly, e.g.:
//   0 7 * * MON  curl -s -H "Authorization: Bearer $CRON_SECRET" \
//                  http://localhost:3004/api/cron/digest

import { NextResponse } from 'next/server'
import { sendDigest } from '@/app/lib/digest'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function run(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (secret) {
    const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    const query = new URL(req.url).searchParams.get('secret')
    if (header !== secret && query !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }
  const force = new URL(req.url).searchParams.get('force') === '1'
  const r = await sendDigest({ force })
  return NextResponse.json({
    total: r.built.total,
    since: r.built.since,
    sent: r.sent,
    advancedWatermark: r.advancedWatermark,
  })
}

export const GET = run
export const POST = run
