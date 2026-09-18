import TopBar from '@/components/TopBar'
import { prisma } from '@/app/lib/prisma'
import MatchesList, { type MatchCard } from './MatchesList'

export const dynamic = 'force-dynamic'

// SUGGESTED first (need a decision), then active, then closed-out.
const STATUS_ORDER: Record<string, number> = {
  SUGGESTED: 0,
  REVIEWING: 1,
  APPLYING: 2,
  SUBMITTED: 3,
  AWARDED: 4,
  DECLINED: 5,
  WITHDRAWN: 6,
}

export default async function MatchesPage() {
  const rows = await prisma.bD_ClientGrantMatch
    .findMany({
      include: {
        grant: { select: { id: true, name: true, agency: true, maxAwardCents: true, matchRequired: true } },
        proposals: { select: { id: true }, take: 1 },
      },
      orderBy: { matchScore: 'desc' },
    })
    .catch(() => [])

  const matches: MatchCard[] = rows
    .map((m) => ({
      id: m.id,
      clientNameCached: m.clientNameCached,
      matchScore: m.matchScore,
      matchNotes: m.matchNotes,
      status: m.status,
      grantId: m.grant.id,
      grantName: m.grant.name,
      agency: m.grant.agency,
      maxAwardCents: m.grant.maxAwardCents,
      matchRequired: m.grant.matchRequired,
      proposalId: m.proposals[0]?.id ?? null,
    }))
    .sort(
      (a, b) =>
        (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
        b.matchScore - a.matchScore,
    )

  const pending = matches.filter((m) => m.status === 'SUGGESTED').length

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Matches</h1>
          <p className="mt-1 text-sm text-slate-600">
            Clients that could apply for a grant — AI-suggested, confirmed by you.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {matches.length} total · {pending} awaiting your review
          </p>
        </div>
        <MatchesList matches={matches} />
      </main>
    </>
  )
}
