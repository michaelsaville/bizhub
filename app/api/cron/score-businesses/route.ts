// Cron: AI-score unscored new businesses.
import { NextResponse } from 'next/server'
import { scoreUnscoredBusinesses } from '@/app/lib/score-businesses'

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
  const summary = await scoreUnscoredBusinesses()
  return NextResponse.json(summary, { status: summary.ok ? 200 : 207 })
}

export const GET = run
export const POST = run
