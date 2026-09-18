import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { prisma } from '@/app/lib/prisma'
import { ScoreBadge, Deadline, money } from '@/components/ui'
import { OppStatusPill } from '@/components/pills'
import { dismissBidAction, restoreBidAction } from '@/app/lib/actions/opportunities'
import OpportunitiesToolbar from './OpportunitiesToolbar'

export const dynamic = 'force-dynamic'

const SOURCE_LABEL: Record<string, string> = {
  'erate-470': 'E-Rate 470',
  'sam.gov': 'SAM.gov',
}

const TIERS: Record<string, { label: string; min: number }> = {
  all: { label: 'All', min: -1 },
  promising: { label: 'Promising 40+', min: 40 },
  warm: { label: 'Warm 60+', min: 60 },
  hot: { label: 'Hot 80+', min: 80 },
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; dismissed?: string }>
}) {
  const sp = await searchParams
  const tierKey = sp.tier && TIERS[sp.tier] ? sp.tier : 'all'
  const showDismissed = sp.dismissed === '1'
  const min = TIERS[tierKey].min

  const where = {
    dismissedAt: showDismissed ? { not: null } : null,
    ...(min >= 0 ? { matchScore: { gte: min } } : {}),
  }

  const [bids, total, scored, hot] = await Promise.all([
    prisma.bD_BidOpportunity
      .findMany({
        where,
        orderBy: [{ matchScore: { sort: 'desc', nulls: 'last' } }, { closingDate: 'desc' }],
        take: 300,
      })
      .catch(() => []),
    prisma.bD_BidOpportunity.count({ where: { dismissedAt: null } }).catch(() => 0),
    prisma.bD_BidOpportunity.count({ where: { dismissedAt: null, matchScore: { not: null } } }).catch(() => 0),
    prisma.bD_BidOpportunity.count({ where: { dismissedAt: null, matchScore: { gte: 80 } } }).catch(() => 0),
  ])

  const qs = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const tier = patch.tier ?? tierKey
    if (tier !== 'all') params.set('tier', tier)
    const dism = patch.dismissed ?? (showDismissed ? '1' : undefined)
    if (dism === '1') params.set('dismissed', '1')
    const s = params.toString()
    return s ? `/opportunities?${s}` : '/opportunities'
  }

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Bids &amp; RFPs</h1>
            <p className="mt-1 text-sm text-slate-600">
              Public bid opportunities — E-Rate school/library RFPs now, SAM.gov when keyed.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {total} tracked · {scored} scored · {hot} hot (80+)
              {scored < total && (
                <span className="text-amber-600"> · {total - scored} unscored — hit “Score with AI”</span>
              )}
            </p>
          </div>
          <OpportunitiesToolbar />
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {Object.entries(TIERS).map(([key, t]) => (
            <Link
              key={key}
              href={qs({ tier: key })}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                key === tierKey
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </Link>
          ))}
          <span className="mx-1 text-slate-300">|</span>
          <Link
            href={qs({ dismissed: showDismissed ? undefined : '1' })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              showDismissed
                ? 'bg-slate-700 text-white'
                : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {showDismissed ? 'Viewing dismissed' : 'Dismissed'}
          </Link>
        </div>

        {bids.length === 0 ? (
          <div className="card py-16 text-center">
            <p className="text-slate-500">
              {showDismissed ? 'Nothing dismissed.' : 'No bids match this filter.'}
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-slate-400">
              {total === 0
                ? 'Hit “Refresh E-Rate 470s” to pull school/library RFPs for WV/MD/PA — no API key required.'
                : 'Try a lower fit tier, or score more bids with AI.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {bids.map((b) => {
              const closed = b.closingDate ? b.closingDate.getTime() < Date.now() : false
              return (
                <li key={b.id} className="group flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                  <ScoreBadge score={b.matchScore} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/opportunities/${b.id}`}
                        className="truncate font-medium text-slate-900 hover:text-brand-700"
                      >
                        {b.title}
                      </Link>
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        {SOURCE_LABEL[b.source] ?? b.source}
                      </span>
                      {closed && (
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          window closed · lead
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span className="truncate">{b.agency ?? '—'}</span>
                      {b.state && <><span className="text-slate-300">·</span><span>{b.state}</span></>}
                      <span className="text-slate-300">·</span>
                      <Deadline date={b.closingDate} />
                    </div>
                    {b.matchNotes && (
                      <p className="mt-1 line-clamp-1 text-xs text-slate-400">{b.matchNotes}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    {showDismissed ? (
                      <form action={restoreBidAction}>
                        <input type="hidden" name="id" value={b.id} />
                        <button className="rounded-lg px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                          Restore
                        </button>
                      </form>
                    ) : (
                      <form action={dismissBidAction}>
                        <input type="hidden" name="id" value={b.id} />
                        <button className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-red-600">
                          Dismiss
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}
