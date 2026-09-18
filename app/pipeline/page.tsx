import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { prisma } from '@/app/lib/prisma'
import { money } from '@/components/ui'
import {
  setStageAction,
  setPipelineValueAction,
  removeFromPipelineAction,
} from '@/app/lib/actions/pipeline'

export const dynamic = 'force-dynamic'

type Stage = 'PURSUING' | 'SUBMITTED' | 'WON' | 'LOST'
const STAGES: Stage[] = ['PURSUING', 'SUBMITTED', 'WON', 'LOST']
const STAGE_META: Record<Stage, { label: string; head: string }> = {
  PURSUING: { label: 'Pursuing', head: 'text-blue-700' },
  SUBMITTED: { label: 'Submitted', head: 'text-indigo-700' },
  WON: { label: 'Won', head: 'text-emerald-700' },
  LOST: { label: 'Lost', head: 'text-slate-500' },
}
const TYPE_BADGE: Record<string, string> = {
  GRANT: 'bg-brand-50 text-brand-700',
  BID: 'bg-amber-50 text-amber-700',
  AWARD: 'bg-blue-50 text-blue-700',
  MATCH: 'bg-indigo-50 text-indigo-700',
  PROPOSAL: 'bg-slate-100 text-slate-600',
  BUSINESS: 'bg-emerald-50 text-emerald-700',
}
const DETAIL: Record<string, (id: string) => string> = {
  GRANT: (id) => `/grants/${id}`,
  BID: (id) => `/opportunities/${id}`,
  AWARD: (id) => `/awards/${id}`,
  MATCH: () => `/matches`,
  PROPOSAL: (id) => `/proposals/${id}`,
  BUSINESS: () => `/businesses`,
}

function nextStages(stage: Stage): { stage: Stage; label: string }[] {
  switch (stage) {
    case 'PURSUING':
      return [
        { stage: 'SUBMITTED', label: 'Submitted' },
        { stage: 'WON', label: 'Won' },
        { stage: 'LOST', label: 'Lost' },
      ]
    case 'SUBMITTED':
      return [
        { stage: 'WON', label: 'Won' },
        { stage: 'LOST', label: 'Lost' },
      ]
    default:
      return [{ stage: 'PURSUING', label: 'Reopen' }]
  }
}

export default async function PipelinePage() {
  const items = await prisma.bD_PipelineItem
    .findMany({ orderBy: { updatedAt: 'desc' } })
    .catch(() => [])

  const dollars = (c: bigint | null) => (c == null ? 0 : Number(c) / 100)
  const openValue = items
    .filter((i) => i.stage === 'PURSUING' || i.stage === 'SUBMITTED')
    .reduce((s, i) => s + dollars(i.valueCents), 0)
  const wonValue = items.filter((i) => i.stage === 'WON').reduce((s, i) => s + dollars(i.valueCents), 0)
  const wonCount = items.filter((i) => i.stage === 'WON').length
  const lostCount = items.filter((i) => i.stage === 'LOST').length
  const winRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : null

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Pipeline</h1>
          <p className="mt-1 text-sm text-slate-600">
            Deals you&apos;re working — added from any lead, tracked to Won or Lost.
          </p>
        </div>

        {/* Summary */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card"><div className="text-2xl font-bold text-brand-600 tabular-nums">${Math.round(openValue).toLocaleString()}</div><div className="mt-1 text-xs text-slate-500">Open pipeline value</div></div>
          <div className="card"><div className="text-2xl font-bold text-emerald-600 tabular-nums">${Math.round(wonValue).toLocaleString()}</div><div className="mt-1 text-xs text-slate-500">Won value</div></div>
          <div className="card"><div className="text-2xl font-bold text-slate-800 tabular-nums">{items.length}</div><div className="mt-1 text-xs text-slate-500">Total deals</div></div>
          <div className="card"><div className="text-2xl font-bold text-slate-800 tabular-nums">{winRate == null ? '—' : `${winRate}%`}</div><div className="mt-1 text-xs text-slate-500">Win rate</div></div>
        </div>

        {items.length === 0 ? (
          <div className="card py-16 text-center">
            <p className="text-slate-500">Your pipeline is empty.</p>
            <p className="mx-auto mt-2 max-w-md text-xs text-slate-400">
              Open any grant, bid, or funded buyer and hit “Add to pipeline” to start
              tracking it here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STAGES.map((stage) => {
              const col = items.filter((i) => i.stage === stage)
              return (
                <div key={stage} className="rounded-xl bg-slate-100/60 p-3">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <h2 className={`text-sm font-semibold uppercase tracking-wide ${STAGE_META[stage].head}`}>
                      {STAGE_META[stage].label}
                    </h2>
                    <span className="text-xs text-slate-400">{col.length}</span>
                  </div>
                  <div className="space-y-3">
                    {col.map((i) => (
                      <div key={i.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TYPE_BADGE[i.itemType] ?? 'bg-slate-100 text-slate-500'}`}>
                            {i.itemType.toLowerCase()}
                          </span>
                          {i.valueCents != null && (
                            <span className="text-xs font-medium tabular-nums text-slate-600">
                              {money(Number(i.valueCents))}
                            </span>
                          )}
                        </div>
                        <Link
                          href={DETAIL[i.itemType](i.refId)}
                          className="block text-sm font-medium text-slate-900 hover:text-brand-700"
                        >
                          {i.titleCached}
                        </Link>
                        {i.subtitle && <div className="mt-0.5 truncate text-xs text-slate-500">{i.subtitle}</div>}

                        {/* value edit */}
                        <form action={setPipelineValueAction} className="mt-2 flex items-center gap-1">
                          <input type="hidden" name="id" value={i.id} />
                          <span className="text-xs text-slate-400">$</span>
                          <input
                            name="dollars"
                            defaultValue={i.valueCents != null ? String(Number(i.valueCents) / 100) : ''}
                            placeholder="value"
                            inputMode="decimal"
                            className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                          />
                          <button className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100">set</button>
                        </form>

                        {/* stage controls */}
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          {nextStages(stage).map((n) => (
                            <form key={n.stage} action={setStageAction}>
                              <input type="hidden" name="id" value={i.id} />
                              <input type="hidden" name="stage" value={n.stage} />
                              <button
                                className={`rounded px-2 py-0.5 text-xs font-medium ${
                                  n.stage === 'WON'
                                    ? 'text-emerald-700 hover:bg-emerald-50'
                                    : n.stage === 'LOST'
                                      ? 'text-slate-500 hover:bg-slate-100'
                                      : 'text-brand-700 hover:bg-brand-50'
                                }`}
                              >
                                {n.label}
                              </button>
                            </form>
                          ))}
                          <form action={removeFromPipelineAction} className="ml-auto">
                            <input type="hidden" name="id" value={i.id} />
                            <button className="rounded px-1.5 py-0.5 text-xs text-slate-300 hover:bg-slate-100 hover:text-red-500" title="Remove">
                              ✕
                            </button>
                          </form>
                        </div>
                      </div>
                    ))}
                    {col.length === 0 && <p className="px-1 py-2 text-xs text-slate-400">—</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
