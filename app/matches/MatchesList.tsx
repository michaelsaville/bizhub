'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { decideMatchAction } from '@/app/lib/actions/matches'
import { draftProposalAction } from '@/app/lib/actions/proposals'
import { MatchStatusPill } from '@/components/pills'
import { ScoreBadge, money } from '@/components/ui'

export interface MatchCard {
  id: string
  clientNameCached: string
  matchScore: number
  matchNotes: string | null
  status: string
  grantId: string
  grantName: string
  agency: string
  maxAwardCents: number | null
  matchRequired: string | null
  proposalId: string | null
}

export default function MatchesList({ matches }: { matches: MatchCard[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [drafting, setDrafting] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  function decide(id: string, decision: 'accept' | 'reject') {
    start(async () => {
      const fd = new FormData()
      fd.set('id', id)
      fd.set('decision', decision)
      await decideMatchAction(fd)
      router.refresh()
    })
  }

  if (matches.length === 0) {
    return (
      <div className="card py-16 text-center">
        <p className="text-slate-500">No client matches yet.</p>
        <p className="mx-auto mt-2 max-w-md text-xs text-slate-400">
          Open a hot grant and hit “Find client matches” to populate this inbox.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {err && <p className="col-span-full text-xs text-red-600">{err}</p>}
      {matches.map((m) => (
        <div key={m.id} className="card flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <ScoreBadge score={m.matchScore} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="truncate font-semibold text-slate-900">{m.clientNameCached}</span>
                <span className="text-slate-300" aria-hidden>→</span>
                <Link href={`/grants/${m.grantId}`} className="truncate text-slate-600 hover:text-brand-700">
                  {m.grantName}
                </Link>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <MatchStatusPill status={m.status} />
                <span className="text-xs text-slate-500">{m.agency}</span>
              </div>
            </div>
          </div>

          {m.matchNotes && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
              {m.matchNotes}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">Max award</dt>
              <dd className="font-medium text-slate-800">{money(m.maxAwardCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Match req.</dt>
              <dd className="font-medium text-slate-800">{m.matchRequired ?? 'None'}</dd>
            </div>
          </dl>

          <div className="mt-1 flex gap-2 border-t border-slate-100 pt-3">
            {m.status === 'SUGGESTED' ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => decide(m.id, 'accept')}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => decide(m.id, 'reject')}
                  className="btn-ghost flex-1 hover:text-red-600 disabled:opacity-50"
                >
                  Not a fit
                </button>
              </>
            ) : m.proposalId ? (
              <Link href={`/proposals/${m.proposalId}`} className="btn-primary flex-1 text-center">
                View proposal →
              </Link>
            ) : (
              <button
                type="button"
                disabled={pending || drafting === m.id}
                onClick={() =>
                  start(async () => {
                    setDrafting(m.id)
                    const r = await draftProposalAction(m.id)
                    setDrafting(null)
                    if (r.ok && r.proposalId) router.push(`/proposals/${r.proposalId}`)
                    else setErr(r.errors[0] ?? 'Draft failed')
                  })
                }
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {drafting === m.id ? 'Drafting…' : 'Draft proposal'}
              </button>
            )}
            <Link href={`/grants/${m.grantId}`} className="btn-ghost">
              Details
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
