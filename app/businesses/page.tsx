import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { prisma } from '@/app/lib/prisma'
import { ScoreBadge } from '@/components/ui'
import { dismissBusinessAction, restoreBusinessAction } from '@/app/lib/actions/businesses'
import { BUSINESS_CONFIG } from '@/app/lib/poll-businesses'
import BusinessesToolbar from './BusinessesToolbar'

export const dynamic = 'force-dynamic'

const TIERS: Record<string, { label: string; min: number }> = {
  all: { label: 'All', min: -1 },
  promising: { label: 'Promising 40+', min: 40 },
  warm: { label: 'Warm 60+', min: 60 },
  hot: { label: 'Hot 70+', min: 70 },
}

export default async function BusinessesPage({
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
    ...(min >= 0 ? { relevanceScore: { gte: min } } : {}),
  }

  const [rows, total, scored, hot] = await Promise.all([
    prisma.bD_NewBusiness
      .findMany({
        where,
        orderBy: [{ relevanceScore: { sort: 'desc', nulls: 'last' } }, { filedDate: 'desc' }],
        take: 300,
      })
      .catch(() => []),
    prisma.bD_NewBusiness.count({ where: { dismissedAt: null } }).catch(() => 0),
    prisma.bD_NewBusiness.count({ where: { dismissedAt: null, relevanceScore: { not: null } } }).catch(() => 0),
    prisma.bD_NewBusiness.count({ where: { dismissedAt: null, relevanceScore: { gte: 70 } } }).catch(() => 0),
  ])

  const qs = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const tier = patch.tier ?? tierKey
    if (tier !== 'all') params.set('tier', tier)
    const dism = patch.dismissed ?? (showDismissed ? '1' : undefined)
    if (dism === '1') params.set('dismissed', '1')
    const s = params.toString()
    return s ? `/businesses?${s}` : '/businesses'
  }

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">New businesses</h1>
            <p className="mt-1 text-sm text-slate-600">
              Newly-registered businesses in PA border counties — greenfield prospects
              that need network, cameras, phones, IT. AI infers likely industry.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {total} tracked · {scored} scored · {hot} hot (70+) · {BUSINESS_CONFIG.counties.length} counties · last{' '}
              {BUSINESS_CONFIG.lookbackDays} days
            </p>
          </div>
          <BusinessesToolbar />
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

        {rows.length === 0 ? (
          <div className="card py-16 text-center">
            <p className="text-slate-500">
              {showDismissed ? 'Nothing dismissed.' : 'No businesses match this filter.'}
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-slate-400">
              {total === 0
                ? 'Hit “Refresh from PA registry” to pull recent registrations — no API key required.'
                : 'Try a lower tier, or score more with AI.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {rows.map((b) => (
              <li key={b.id} className="group flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                <ScoreBadge score={b.relevanceScore} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-900">{b.name}</span>
                    {b.relevanceCategory && (
                      <span className="hidden shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:inline">
                        {b.relevanceCategory}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <span>{b.county} County, {b.state}</span>
                    {b.filedDate && <><span className="text-slate-300">·</span><span>filed {b.filedDate.toLocaleDateString()}</span></>}
                    <span className="text-slate-300">·</span>
                    <span className="truncate">{b.entityType}</span>
                  </div>
                  {b.relevanceNotes && (
                    <p className="mt-1 line-clamp-1 text-xs text-slate-400">{b.relevanceNotes}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {showDismissed ? (
                    <form action={restoreBusinessAction}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="rounded-lg px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">Restore</button>
                    </form>
                  ) : (
                    <form action={dismissBusinessAction}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-red-600">Dismiss</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
