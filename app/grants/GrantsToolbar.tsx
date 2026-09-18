'use client'

import { useState, useTransition } from 'react'
import { refreshGrantsAction, scoreGrantsAction } from '@/app/lib/actions/grants'

export default function GrantsToolbar() {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<'refresh' | 'score' | null>(null)

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setBusy('refresh')
              const s = await refreshGrantsAction()
              setBusy(null)
              setMsg(
                s.errors.length
                  ? s.errors[0]
                  : `${s.created} new · ${s.updated} updated · ${s.unique} programs`,
              )
            })
          }
          className="btn-ghost disabled:opacity-50"
        >
          {pending && busy === 'refresh' ? 'Refreshing…' : 'Refresh from Grants.gov'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setBusy('score')
              const s = await scoreGrantsAction()
              setBusy(null)
              setMsg(
                s.errors.length
                  ? s.errors[0]
                  : `Scored ${s.scored}${s.remaining ? ` · ${s.remaining} left — click again` : ' · all done'}`,
              )
            })
          }
          className="btn-primary disabled:opacity-50"
        >
          {pending && busy === 'score' ? 'Scoring…' : 'Score with AI'}
        </button>
      </div>
      {msg && <p className="max-w-sm text-right text-xs text-slate-500">{msg}</p>}
    </div>
  )
}
