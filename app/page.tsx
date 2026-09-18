import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { prisma } from '@/app/lib/prisma'
import { ScoreBadge, Deadline, StatCard } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [
    hotGrants,
    hotBids,
    pendingMatches,
    activeProposals,
    topGrants,
    topBids,
    recentMatches,
  ] = await Promise.all([
    prisma.bD_GrantProgram.count({ where: { dismissedAt: null, relevanceScore: { gte: 80 } } }).catch(() => 0),
    prisma.bD_BidOpportunity.count({ where: { dismissedAt: null, matchScore: { gte: 80 } } }).catch(() => 0),
    prisma.bD_ClientGrantMatch.count({ where: { status: 'SUGGESTED' } }).catch(() => 0),
    prisma.bD_Proposal.count({ where: { status: { in: ['DRAFT', 'REVIEW'] } } }).catch(() => 0),
    prisma.bD_GrantProgram
      .findMany({
        where: { dismissedAt: null, relevanceScore: { gte: 60 } },
        orderBy: [{ relevanceScore: 'desc' }, { nextDeadline: 'asc' }],
        take: 6,
      })
      .catch(() => []),
    prisma.bD_BidOpportunity
      .findMany({
        where: { dismissedAt: null, matchScore: { gte: 70 } },
        orderBy: [{ matchScore: 'desc' }, { closingDate: 'desc' }],
        take: 6,
      })
      .catch(() => []),
    prisma.bD_ClientGrantMatch
      .findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { grant: { select: { name: true } } },
      })
      .catch(() => []),
  ])

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">This week</h1>
            <p className="mt-1 text-sm text-slate-600">
              What to apply for, match, and act on — ranked by fit to PCC2K.
            </p>
          </div>
          <Link
            href="/digest"
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
          >
            Weekly digest →
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Hot bid leads (80+)" value={hotBids} href="/opportunities?tier=hot" accent="brand" />
          <StatCard label="Hot grants (80+)" value={hotGrants} href="/grants?tier=hot" accent="brand" />
          <StatCard
            label="Matches to review"
            value={pendingMatches}
            href="/matches"
            accent={pendingMatches > 0 ? 'red' : 'brand'}
            hint={pendingMatches > 0 ? 'awaiting your decision' : undefined}
          />
          <StatCard label="Proposals in progress" value={activeProposals} href="/proposals" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Acting this week */}
          <section className="card lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Best-fit grants</h2>
              <Link href="/grants?tier=warm" className="text-xs font-medium text-brand-700 hover:underline">
                See all →
              </Link>
            </div>
            {topGrants.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                No scored grants yet — go to Grants and hit “Score with AI.”
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {topGrants.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 py-2.5">
                    <ScoreBadge score={g.relevanceScore} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/grants/${g.id}`}
                        className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700"
                      >
                        {g.name}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {g.agency} · <Deadline date={g.nextDeadline} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Right rail */}
          <div className="space-y-6">
            <section className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Top bid leads
                </h2>
                <Link href="/opportunities?tier=warm" className="text-xs font-medium text-brand-700 hover:underline">
                  See all →
                </Link>
              </div>
              {topBids.length === 0 ? (
                <p className="text-sm text-slate-400">No scored bids yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {topBids.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 text-sm">
                      <ScoreBadge score={b.matchScore} />
                      <Link href={`/opportunities/${b.id}`} className="min-w-0 flex-1 truncate text-slate-700 hover:text-brand-700">
                        {b.agency ?? b.title}
                      </Link>
                      <span className="shrink-0 text-xs text-slate-400">{b.state}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Recent client matches
              </h2>
              {recentMatches.length === 0 ? (
                <p className="text-sm text-slate-400">No matches yet.</p>
              ) : (
                <ul className="space-y-3">
                  {recentMatches.map((m) => (
                    <li key={m.id} className="flex gap-3 text-sm">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-300" aria-hidden />
                      <div className="min-w-0">
                        <p className="truncate text-slate-700">
                          <span className="font-medium">{m.clientNameCached}</span> → {m.grant.name}
                        </p>
                        <p className="text-xs text-slate-400">score {m.matchScore} · {m.status.toLowerCase()}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
