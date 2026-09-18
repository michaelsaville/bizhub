import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { prisma } from '@/app/lib/prisma'
import { ScoreBadge, money } from '@/components/ui'
import { dismissAwardAction, restoreAwardAction } from '@/app/lib/actions/awards'
import AwardsToolbar from './AwardsToolbar'

export const dynamic = 'force-dynamic'

const TIERS: Record<string, { label: string; min: number }> = {
  all: { label: 'All', min: -1 },
  promising: { label: 'Promising 40+', min: 40 },
  warm: { label: 'Warm 60+', min: 60 },
  hot: { label: 'Hot 80+', min: 80 },
}

function dollarsFromCents(cents: bigint | null): number | null {
  return cents == null ? null : Number(cents)
}

const SRC: Record<string, { label: string; where: object }> = {
  all: { label: 'All', where: {} },
  grant: { label: 'Grants (buyers)', where: { source: 'usaspending' } },
  contract: { label: 'Contracts (subs)', where: { source: 'usaspending-contract' } },
}

export default async function AwardsPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; dismissed?: string; src?: string }>
}) {
  const sp = await searchParams
  const tierKey = sp.tier && TIERS[sp.tier] ? sp.tier : 'all'
  const srcKey = sp.src && SRC[sp.src] ? sp.src : 'all'
  const showDismissed = sp.dismissed === '1'
  const min = TIERS[tierKey].min

  const where = {
    dismissedAt: showDismissed ? { not: null } : null,
    ...SRC[srcKey].where,
    ...(min >= 0 ? { relevanceScore: { gte: min } } : {}),
  }

  const [awards, total, scored, hot] = await Promise.all([
    prisma.bD_FundedAward
      .findMany({
        where,
        orderBy: [{ relevanceScore: { sort: 'desc', nulls: 'last' } }, { startDate: 'desc' }],
        take: 300,
      })
      .catch(() => []),
    prisma.bD_FundedAward.count({ where: { dismissedAt: null } }).catch(() => 0),
    prisma.bD_FundedAward.count({ where: { dismissedAt: null, relevanceScore: { not: null } } }).catch(() => 0),
    prisma.bD_FundedAward.count({ where: { dismissedAt: null, relevanceScore: { gte: 80 } } }).catch(() => 0),
  ])

  const qs = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const tier = patch.tier ?? tierKey
    if (tier !== 'all') params.set('tier', tier)
    const src = patch.src ?? srcKey
    if (src !== 'all') params.set('src', src)
    const dism = patch.dismissed ?? (showDismissed ? '1' : undefined)
    if (dism === '1') params.set('dismissed', '1')
    const s = params.toString()
    return s ? `/awards?${s}` : '/awards'
  }

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Funded buyers &amp; contractors</h1>
            <p className="mt-1 text-sm text-slate-600">
              WV/MD/PA orgs that just got federal money — grant recipients (buyers)
              + contract winners (subcontract/partner leads), ranked by PCC2K fit.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {total} tracked · {scored} scored · {hot} hot (80+)
              {scored < total && (
                <span className="text-amber-600"> · {total - scored} unscored — hit “Score with AI”</span>
              )}
            </p>
          </div>
          <AwardsToolbar />
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {Object.entries(SRC).map(([key, s]) => (
            <Link
              key={key}
              href={qs({ src: key })}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                key === srcKey
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {s.label}
            </Link>
          ))}
          <span className="mx-1 text-slate-300">|</span>
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

        {awards.length === 0 ? (
          <div className="card py-16 text-center">
            <p className="text-slate-500">
              {showDismissed ? 'Nothing dismissed.' : 'No funded awards match this filter.'}
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-slate-400">
              {total === 0
                ? 'Hit “Refresh from USAspending” to pull recent grant awards for WV/MD/PA — no API key required.'
                : 'Try a lower fit tier, or score more awards with AI.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {awards.map((a) => (
              <li key={a.id} className="group flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                <ScoreBadge score={a.relevanceScore} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/awards/${a.id}`}
                      className="truncate font-medium text-slate-900 hover:text-brand-700"
                    >
                      {a.recipientName}
                    </Link>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        a.source === 'usaspending-contract'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {a.source === 'usaspending-contract' ? 'contract' : 'grant'}
                    </span>
                    {a.relevanceCategory && a.relevanceCategory !== 'Unrelated' && (
                      <span className="hidden shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:inline">
                        {a.relevanceCategory}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <span className="truncate">{a.awardingAgency ?? '—'}</span>
                    {a.recipientState && <><span className="text-slate-300">·</span><span>{a.recipientState}</span></>}
                    {a.startDate && <><span className="text-slate-300">·</span><span>{a.startDate.toLocaleDateString()}</span></>}
                  </div>
                  {a.relevanceNotes && (
                    <p className="mt-1 line-clamp-1 text-xs text-slate-400">{a.relevanceNotes}</p>
                  )}
                </div>
                <div className="hidden shrink-0 text-right text-xs tabular-nums font-medium text-slate-600 sm:block">
                  {money(dollarsFromCents(a.awardAmountCents))}
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {showDismissed ? (
                    <form action={restoreAwardAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="rounded-lg px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                        Restore
                      </button>
                    </form>
                  ) : (
                    <form action={dismissAwardAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-red-600">
                        Dismiss
                      </button>
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
