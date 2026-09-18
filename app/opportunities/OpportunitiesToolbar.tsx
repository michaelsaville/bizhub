'use client'

import { useState, useTransition } from 'react'
import { refreshErateAction, scoreBidsAction } from '@/app/lib/actions/opportunities'

export default function OpportunitiesToolbar() {
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<'erate' | 'score' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setBusy('erate')
              const s = await refreshErateAction()
              setBusy(null)
              setMsg(s.errors.length ? s.errors[0] : `${s.created} new · ${s.updated} updated E-Rate 470s`)
            })
          }
          className="btn-ghost disabled:opacity-50"
        >
          {pending && busy === 'erate' ? 'Pulling E-Rate…' : 'Refresh E-Rate 470s'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setBusy('score')
              const s = await scoreBidsAction()
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
