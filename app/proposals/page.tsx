import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { prisma } from '@/app/lib/prisma'
import { ProposalStatusPill } from '@/components/pills'

export const dynamic = 'force-dynamic'

export default async function ProposalsPage() {
  const proposals = await prisma.bD_Proposal
    .findMany({ orderBy: { updatedAt: 'desc' }, take: 100 })
    .catch(() => [])

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Proposals</h1>
          <p className="mt-1 text-sm text-slate-600">
            AI-drafted grant applications and bid responses — edit, then send.
          </p>
          <p className="mt-1 text-xs text-slate-400">{proposals.length} total</p>
        </div>

        {proposals.length === 0 ? (
          <div className="card py-16 text-center">
            <p className="text-slate-500">No proposals yet.</p>
            <p className="mx-auto mt-2 max-w-md text-xs text-slate-400">
              Accept a client match, then hit “Draft proposal” to generate one.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {proposals.map((p) => (
              <li key={p.id}>
                <Link href={`/proposals/${p.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-slate-900">{p.title}</span>
                      <ProposalStatusPill status={p.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {p.kind.replace(/_/g, ' ').toLowerCase()} · updated{' '}
                      {p.updatedAt.toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-slate-300">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
