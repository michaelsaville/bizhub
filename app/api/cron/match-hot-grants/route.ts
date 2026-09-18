// Cron: auto-suggest client matches for the top unmatched hot grants. Produces
// SUGGESTED matches only (human still confirms), so it's safe to schedule.
// Secret-guarded like the other crons.

import { NextResponse } from 'next/server'
import { autoMatchHotGrants } from '@/app/lib/actions/matches'

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
  const url = new URL(req.url)
  const minScore = Number(url.searchParams.get('minScore')) || undefined
  const limit = Number(url.searchParams.get('limit')) || undefined
  const summary = await autoMatchHotGrants({ minScore, limit })
  return NextResponse.json(summary)
}

export const GET = run
export const POST = run
