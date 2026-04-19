import TopBar from '@/components/TopBar'
import { prisma } from '@/app/lib/prisma'

export const dynamic = 'force-dynamic'

function money(cents: number | null, cents2?: number | null): string {
  if (cents == null) return '—'
  const lo = `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  if (cents2 != null && cents2 !== cents) {
    return `${lo} – $${(cents2 / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }
  return lo
}

export default async function OpportunitiesPage() {
  const opportunities = await prisma.bD_BidOpportunity
    .findMany({
      orderBy: [{ closingDate: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    })
    .catch(() => [])

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Opportunities</h1>
            <p className="mt-1 text-sm text-slate-600">
              Bids and RFPs surfaced from SAM.gov and state procurement portals.
            </p>
          </div>
        </div>

        {opportunities.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-slate-500">No opportunities yet.</p>
            <p className="mt-2 text-xs text-slate-400 max-w-md mx-auto">
              The nightly poller hasn&apos;t been wired up. Once a data source
              (SAM.gov, wvpurchasing.gov, grants.gov) is connected, new
              postings will land here as they&apos;re discovered.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Agency</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-right">Closing</th>
                  <th className="px-4 py-3 text-right">Match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {opportunities.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {o.sourceUrl ? (
                        <a
                          href={o.sourceUrl}
                          target="_blank"
                          rel="noopener"
                          className="hover:text-brand-600"
                        >
                          {o.title}
                        </a>
                      ) : (
                        o.title
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{o.source}</td>
                    <td className="px-4 py-3 text-slate-600">{o.agency ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{o.state ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                      {money(o.contractValueCentsLow, o.contractValueCentsHigh)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">
                      {o.closingDate ? o.closingDate.toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {o.matchScore != null ? (
                        <span className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                          {o.matchScore}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
