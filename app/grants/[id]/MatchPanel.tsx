'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { findMatchesAction, decideMatchAction } from '@/app/lib/actions/matches'
import { draftProposalAction } from '@/app/lib/actions/proposals'
import { MatchStatusPill } from '@/components/pills'
import { ScoreBadge } from '@/components/ui'

export interface MatchLite {
  id: string
  clientNameCached: string
  matchScore: number
  matchNotes: string | null
  status: string
  proposalId: string | null
}

export default function MatchPanel({
  grantId,
  matches,
}: {
  grantId: string
  matches: MatchLite[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [note, setNote] = useState<string | null>(null)
  const [drafting, setDrafting] = useState<string | null>(null)

  function run(fn: () => Promise<void>) {
    start(async () => {
      await fn()
      router.refresh()
    })
  }

  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Client matches
          <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium normal-case text-brand-700">
            AI suggests · you decide
          </span>
        </h2>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await findMatchesAction(grantId)
              setNote(
                r.errors.length
                  ? r.errors[0]
                  : `${r.created + r.updated} client${r.created + r.updated === 1 ? '' : 's'} matched`,
              )
            })
          }
          className="btn-primary disabled:opacity-50"
        >
          {pending ? 'Working…' : matches.length ? 'Re-run matching' : 'Find client matches'}
        </button>
      </div>

      {note && <p className="mb-3 text-xs text-slate-500">{note}</p>}

      {matches.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          No client matches yet. Run matching to see which of PCC2K&apos;s clients could
          apply for this grant.
        </p>
      ) : (
        <ul className="space-y-3">
          {matches.map((m) => (
            <li key={m.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start gap-3">
                <ScoreBadge score={m.matchScore} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{m.clientNameCached}</span>
                    <MatchStatusPill status={m.status} />
                  </div>
                  {m.matchNotes && (
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{m.matchNotes}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {m.status === 'SUGGESTED' && (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              const fd = new FormData()
                              fd.set('id', m.id)
                              fd.set('decision', 'accept')
                              await decideMatchAction(fd)
                            })
                          }
                          className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              const fd = new FormData()
                              fd.set('id', m.id)
                              fd.set('decision', 'reject')
                              await decideMatchAction(fd)
                            })
                          }
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-red-600 disabled:opacity-50"
                        >
                          Not a fit
                        </button>
                      </>
                    )}
                    {m.proposalId ? (
                      <Link
                        href={`/proposals/${m.proposalId}`}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                      >
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
                            else setNote(r.errors[0] ?? 'Draft failed')
                          })
                        }
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-50"
                      >
                        {drafting === m.id ? 'Drafting…' : 'Draft proposal'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
