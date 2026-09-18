// Cron entry point for the Grants.gov poller (keyless source).
// Same guard pattern as poll-sam: CRON_SECRET via Bearer header or ?secret=.

import { NextResponse } from 'next/server'
import { pollGrantsGov } from '@/app/lib/poll-grants'

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
  const summary = await pollGrantsGov()
  return NextResponse.json(summary, { status: summary.ok ? 200 : 207 })
}

export const GET = run
export const POST = run
