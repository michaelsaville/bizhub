import Link from 'next/link'
import { notFound } from 'next/navigation'
import TopBar from '@/components/TopBar'
import { prisma } from '@/app/lib/prisma'
import { ScoreBadge, Deadline, Fact, money } from '@/components/ui'
import { OppStatusPill } from '@/components/pills'
import PipelineButton from '@/components/PipelineButton'

export const dynamic = 'force-dynamic'

const SOURCE_LABEL: Record<string, string> = {
  'erate-470': 'E-Rate Form 470',
  'sam.gov': 'SAM.gov',
}

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const bid = await prisma.bD_BidOpportunity.findUnique({ where: { id } }).catch(() => null)
  if (!bid) notFound()

  const pipe = await prisma.bD_PipelineItem
    .findUnique({ where: { itemType_refId: { itemType: 'BID', refId: bid.id } }, select: { stage: true } })
    .catch(() => null)

  const raw = (bid.rawPayload ?? {}) as Record<string, string | undefined>
  const isErate = bid.source === 'erate-470'
  const contactName = raw.contact_name
  const contactEmail = raw.contact_email
  const contactPhone = raw.contact_phone
  const hasContact = Boolean(contactName || contactEmail || contactPhone)
  const closed = bid.closingDate ? bid.closingDate.getTime() < Date.now() : false

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Link href="/opportunities" className="text-sm text-slate-500 hover:text-brand-700">
          ← Bids &amp; RFPs
        </Link>

        <div className="mt-3 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <ScoreBadge score={bid.matchScore} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{bid.title}</h1>
                <OppStatusPill status={bid.status} />
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {SOURCE_LABEL[bid.source] ?? bid.source}
                {bid.agency ? ` · ${bid.agency}` : ''}
                {bid.state ? ` · ${bid.state}` : ''}
              </p>
              <p className="mt-1 text-sm">
                <Deadline date={bid.closingDate} />
                {closed && <span className="ml-2 text-xs text-slate-400">(bidding window closed — treat as a prospect lead)</span>}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <PipelineButton
              itemType="BID"
              refId={bid.id}
              title={bid.title}
              subtitle={bid.agency ?? undefined}
              valueCents={bid.contractValueCentsLow ?? null}
              inPipeline={!!pipe}
              stage={pipe?.stage}
            />
            {bid.sourceUrl && (
              <a href={bid.sourceUrl} target="_blank" rel="noopener" className="btn-ghost">
                Applicant site ↗
              </a>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {bid.matchScore != null && bid.matchNotes && (
              <section className="card border-brand-100 bg-brand-50">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-700">
                  Why this scored {bid.matchScore}
                </h2>
                <p className="text-sm leading-relaxed text-slate-700">{bid.matchNotes}</p>
              </section>
            )}

            <section className="card">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Requested services
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {bid.description || 'No service description provided.'}
              </p>
            </section>
          </div>

          <aside className="space-y-6">
            {hasContact && (
              <div className="card border-brand-200">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-700">
                  Contact — reach out
                </h2>
                <dl className="space-y-3 text-sm">
                  {contactName && <Fact label="Name" value={contactName} />}
                  {contactEmail && (
                    <Fact
                      label="Email"
                      value={
                        <a href={`mailto:${contactEmail}`} className="text-brand-700 hover:underline">
                          {contactEmail}
                        </a>
                      }
                    />
                  )}
                  {contactPhone && (
                    <Fact
                      label="Phone"
                      value={
                        <a href={`tel:${contactPhone}`} className="text-brand-700 hover:underline">
                          {contactPhone}
                        </a>
                      }
                    />
                  )}
                </dl>
              </div>
            )}

            <div className="card">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Key facts
              </h2>
              <dl className="space-y-3 text-sm">
                <Fact label="Applicant" value={bid.agency ?? '—'} />
                {isErate && <Fact label="Type" value={bid.setAsideType ?? '—'} />}
                {isErate && raw.funding_year && <Fact label="Funding year" value={raw.funding_year} />}
                {isErate && raw.billed_entity_city && (
                  <Fact label="City" value={`${raw.billed_entity_city}, ${bid.state ?? ''}`} />
                )}
                <Fact
                  label={isErate ? 'Allowable contract date' : 'Closing'}
                  value={bid.closingDate ? bid.closingDate.toLocaleDateString() : '—'}
                />
                {bid.postingDate && <Fact label="Posted" value={bid.postingDate.toLocaleDateString()} />}
                {!isErate && (
                  <Fact label="Value" value={money(bid.contractValueCentsLow, bid.contractValueCentsHigh)} />
                )}
                <Fact label="Source" value={SOURCE_LABEL[bid.source] ?? bid.source} />
                <Fact label="ID" value={bid.externalId} />
              </dl>
            </div>
          </aside>
        </div>
      </main>
    </>
  )
}
