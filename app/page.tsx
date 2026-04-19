import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { prisma } from '@/app/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  // Light DB probe so a broken schema fails visibly at render time, not
  // silently when the poller tries to upsert. Falls back to zeros if the
  // tables aren't pushed yet.
  const stats = await Promise.all([
    prisma.bD_BidOpportunity.count().catch(() => 0),
    prisma.bD_GrantProgram.count().catch(() => 0),
    prisma.bD_ClientGrantMatch.count().catch(() => 0),
    prisma.bD_Proposal.count().catch(() => 0),
  ])
  const [bids, grants, matches, proposals] = stats

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">BizHub</h1>
          <p className="mt-1 text-sm text-slate-600">
            Discover bids, match grants to your clients, and draft proposals
            with one click.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <StatCard label="Open bids" value={bids} />
          <StatCard label="Tracked grants" value={grants} />
          <StatCard label="Client matches" value={matches} />
          <StatCard label="Proposals" value={proposals} />
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Getting started
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            This is the empty framework. Data pollers, grant matching, and
            proposal generation are not wired up yet — see{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">
              PLANNING.md
            </code>{' '}
            for the roadmap.
          </p>
          <div className="flex gap-2">
            <Link href="/opportunities" className="btn-primary">
              Browse opportunities
            </Link>
            <a href="https://sam.gov" target="_blank" rel="noopener" className="btn-ghost">
              SAM.gov →
            </a>
            <a href="https://grants.gov" target="_blank" rel="noopener" className="btn-ghost">
              Grants.gov →
            </a>
          </div>
        </div>
      </main>
    </>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card text-center">
      <div className="text-3xl font-bold text-brand-600">{value}</div>
      <div className="text-sm text-slate-600 mt-1">{label}</div>
    </div>
  )
}
