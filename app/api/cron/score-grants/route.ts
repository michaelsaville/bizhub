// Cron entry point for AI grant relevance scoring. Scores up to a capped batch
// of unscored grants per call (see score-grants.ts) — call repeatedly (or let a
// nightly cron do it) until `remaining` reaches 0. Secret-guarded like the pollers.

import { NextResponse } from 'next/server'
import { scoreUnscoredGrants } from '@/app/lib/score-grants'

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
  const summary = await scoreUnscoredGrants()
  return NextResponse.json(summary, { status: summary.ok ? 200 : 207 })
}

export const GET = run
export const POST = run
