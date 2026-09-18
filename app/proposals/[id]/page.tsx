import Link from 'next/link'
import { notFound } from 'next/navigation'
import TopBar from '@/components/TopBar'
import { prisma } from '@/app/lib/prisma'
import { ProposalStatusPill } from '@/components/pills'
import { setProposalStatusAction } from '@/app/lib/actions/proposals'
import ProposalEditor, { type EditorSection } from './ProposalEditor'

export const dynamic = 'force-dynamic'

const NEXT_STATUS: Record<string, string[]> = {
  DRAFT: ['REVIEW'],
  REVIEW: ['SENT', 'DRAFT'],
  SENT: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [],
  REJECTED: ['DRAFT'],
  WITHDRAWN: ['DRAFT'],
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const proposal = await prisma.bD_Proposal
    .findUnique({
      where: { id },
      include: { grantMatch: { select: { grantId: true } } },
    })
    .catch(() => null)

  if (!proposal) notFound()

  const body = (proposal.body ?? {}) as {
    summary?: string
    sections?: EditorSection[]
    generatedModel?: string
    aiDraft?: boolean
  }
  const sections = Array.isArray(body.sections) ? body.sections : []

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link href="/proposals" className="text-sm text-slate-500 hover:text-brand-700">
          ← Proposals
        </Link>

        <div className="mt-3 flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{proposal.title}</h1>
              <ProposalStatusPill status={proposal.status} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {proposal.kind.replace(/_/g, ' ').toLowerCase()} ·{' '}
              {proposal.clientNameCached ?? 'No client'}
            </p>
            {body.summary && (
              <p className="mt-2 max-w-2xl text-sm text-slate-500">{body.summary}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {proposal.grantMatch && (
              <Link href={`/grants/${proposal.grantMatch.grantId}`} className="btn-ghost">
                Grant ↗
              </Link>
            )}
            {(NEXT_STATUS[proposal.status] ?? []).map((s) => (
              <form key={s} action={setProposalStatusAction}>
                <input type="hidden" name="id" value={proposal.id} />
                <input type="hidden" name="status" value={s} />
                <button className={s === 'REJECTED' ? 'btn-ghost hover:text-red-600' : 'btn-primary'}>
                  {s === 'REVIEW'
                    ? 'Mark ready for review'
                    : s === 'SENT'
                      ? 'Mark sent'
                      : s === 'DRAFT'
                        ? 'Back to draft'
                        : `Mark ${s.toLowerCase()}`}
                </button>
              </form>
            ))}
          </div>
        </div>

        {body.aiDraft && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            This is an AI-generated first draft{body.generatedModel ? ` (${body.generatedModel})` : ''}.
            Review and edit every section before sending — do not treat figures or claims as verified.
          </p>
        )}

        <div className="mt-6">
          {sections.length === 0 ? (
            <p className="text-sm text-slate-500">This proposal has no content sections.</p>
          ) : (
            <ProposalEditor id={proposal.id} sections={sections} />
          )}
        </div>
      </main>
    </>
  )
}
