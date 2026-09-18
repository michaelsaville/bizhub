// Cron entry point for the SAM.gov poller.
//
// Excluded from the auth middleware matcher (api/cron is in the negative
// lookahead), so it stays reachable when SSO is re-enabled. Guard with
// CRON_SECRET when set — pass it as `Authorization: Bearer <secret>` or
// `?secret=<secret>`. If CRON_SECRET is unset the route is open (fine while
// the whole app is auth-bypassed; set it before re-enabling auth).
//
// Wire a nightly trigger later, e.g.:
//   0 6 * * *  curl -s -H "Authorization: Bearer $CRON_SECRET" \
//                https://bizhub.pcc2k.com/api/cron/poll-sam

import { NextResponse } from 'next/server'
import { pollSamGov } from '@/app/lib/poll-opportunities'

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
  const summary = await pollSamGov()
  return NextResponse.json(summary, { status: summary.ok ? 200 : 207 })
}

export const GET = run
export const POST = run
