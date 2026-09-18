import Link from 'next/link'
import { notFound } from 'next/navigation'
import TopBar from '@/components/TopBar'
import { prisma } from '@/app/lib/prisma'
import { ScoreBadge, Fact, money } from '@/components/ui'
import PipelineButton from '@/components/PipelineButton'

export const dynamic = 'force-dynamic'

export default async function AwardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const award = await prisma.bD_FundedAward.findUnique({ where: { id } }).catch(() => null)
  if (!award) notFound()

  const pipe = await prisma.bD_PipelineItem
    .findUnique({ where: { itemType_refId: { itemType: 'AWARD', refId: award.id } }, select: { stage: true } })
    .catch(() => null)

  const dollars = award.awardAmountCents == null ? null : Number(award.awardAmountCents)

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Link href="/awards" className="text-sm text-slate-500 hover:text-brand-700">
          ← Funded buyers
        </Link>

        <div className="mt-3 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <ScoreBadge score={award.relevanceScore} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{award.recipientName}</h1>
                {award.relevanceCategory && award.relevanceCategory !== 'Unrelated' && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                    {award.relevanceCategory}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {award.awardingAgency}
                {award.recipientState ? ` · ${award.recipientState}` : ''}
              </p>
              <p className="mt-1 text-lg font-semibold text-brand-700">{money(dollars)}</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <PipelineButton
              itemType="AWARD"
              refId={award.id}
              title={award.recipientName}
              subtitle={award.awardingAgency ?? undefined}
              valueCents={dollars}
              inPipeline={!!pipe}
              stage={pipe?.stage}
            />
            {award.sourceUrl && (
              <a href={award.sourceUrl} target="_blank" rel="noopener" className="btn-ghost">
                View on USAspending ↗
              </a>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {award.relevanceScore != null && award.relevanceNotes && (
              <section className="card border-brand-100 bg-brand-50">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-700">
                  Why this scored {award.relevanceScore}
                </h2>
                <p className="text-sm leading-relaxed text-slate-700">{award.relevanceNotes}</p>
              </section>
            )}

            <section className="card">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Award purpose
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {award.purpose || 'No description provided.'}
              </p>
            </section>

            <section className="card bg-slate-50">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Outreach angle
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                This organization has just been funded. If the award covers work PCC2K
                installs, reach out now while budget is fresh — reference the specific
                program and offer a site assessment. Find the recipient&apos;s contact via
                the USAspending link above or their public site.
              </p>
            </section>
          </div>

          <aside className="space-y-6">
            <div className="card">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Key facts
              </h2>
              <dl className="space-y-3 text-sm">
                <Fact label="Award amount" value={money(dollars)} />
                <Fact label="Awarding agency" value={award.awardingAgency ?? '—'} />
                <Fact label="Award type" value={award.awardType ?? '—'} />
                <Fact label="State" value={award.recipientState ?? '—'} />
                <Fact label="Start" value={award.startDate ? award.startDate.toLocaleDateString() : '—'} />
                <Fact label="End" value={award.endDate ? award.endDate.toLocaleDateString() : '—'} />
                <Fact label="Source" value="USAspending.gov" />
              </dl>
            </div>
          </aside>
        </div>
      </main>
    </>
  )
}
