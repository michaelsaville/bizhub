import Link from 'next/link'
import { notFound } from 'next/navigation'
import TopBar from '@/components/TopBar'
import { prisma } from '@/app/lib/prisma'
import { ScoreBadge, Deadline, Fact, money } from '@/components/ui'
import { GrantStatusPill } from '@/components/pills'
import PipelineButton from '@/components/PipelineButton'
import MatchPanel, { type MatchLite } from './MatchPanel'

export const dynamic = 'force-dynamic'

export default async function GrantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const grant = await prisma.bD_GrantProgram
    .findUnique({
      where: { id },
      include: {
        clientMatches: {
          orderBy: { matchScore: 'desc' },
          include: { proposals: { select: { id: true }, take: 1 } },
        },
      },
    })
    .catch(() => null)

  if (!grant) notFound()

  const pipe = await prisma.bD_PipelineItem
    .findUnique({ where: { itemType_refId: { itemType: 'GRANT', refId: grant.id } }, select: { stage: true } })
    .catch(() => null)

  const matches: MatchLite[] = grant.clientMatches.map((m) => ({
    id: m.id,
    clientNameCached: m.clientNameCached,
    matchScore: m.matchScore,
    matchNotes: m.matchNotes,
    status: m.status,
    proposalId: m.proposals[0]?.id ?? null,
  }))

  const elig = (grant.eligibility ?? {}) as {
    number?: string
    cfdaList?: string[]
    oppStatus?: string
    openDate?: string
  }

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Link href="/grants" className="text-sm text-slate-500 hover:text-brand-700">
          ← Grants
        </Link>

        {/* Header */}
        <div className="mt-3 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <ScoreBadge score={grant.relevanceScore} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{grant.name}</h1>
                <GrantStatusPill status={grant.status} />
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {grant.agency}
                {grant.relevanceCategory && grant.relevanceCategory !== 'Unrelated'
                  ? ` · ${grant.relevanceCategory}`
                  : ''}
              </p>
              <p className="mt-1 text-sm">
                <Deadline date={grant.nextDeadline} />
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <PipelineButton
              itemType="GRANT"
              refId={grant.id}
              title={grant.name}
              subtitle={grant.agency}
              valueCents={grant.maxAwardCents ?? null}
              inPipeline={!!pipe}
              stage={pipe?.stage}
            />
            {grant.sourceUrl && (
              <a href={grant.sourceUrl} target="_blank" rel="noopener" className="btn-ghost">
                View on Grants.gov ↗
              </a>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {grant.relevanceScore != null && grant.relevanceNotes && (
              <section className="card border-brand-100 bg-brand-50">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-700">
                  Why this scored {grant.relevanceScore}
                </h2>
                <p className="text-sm leading-relaxed text-slate-700">{grant.relevanceNotes}</p>
              </section>
            )}

            <section className="card">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Overview
              </h2>
              <p className="text-sm leading-relaxed text-slate-700">
                {grant.description || 'No summary provided by Grants.gov for this program.'}
              </p>
            </section>

            <MatchPanel grantId={grant.id} matches={matches} />
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <div className="card">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Key facts
              </h2>
              <dl className="space-y-3 text-sm">
                <Fact label="Agency" value={grant.agency} />
                <Fact
                  label="Deadline"
                  value={grant.nextDeadline ? grant.nextDeadline.toLocaleDateString() : 'Rolling / TBD'}
                />
                <Fact label="Max award" value={money(grant.maxAwardCents)} />
                <Fact label="Match required" value={grant.matchRequired ?? 'Not specified'} />
                <Fact label="Opportunity #" value={elig.number || '—'} />
                <Fact label="CFDA" value={elig.cfdaList?.join(', ') || '—'} />
                <Fact label="Source" value={grant.source} />
              </dl>
            </div>
          </aside>
        </div>
      </main>
    </>
  )
}
