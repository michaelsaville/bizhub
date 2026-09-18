'use client'

import { useState, useTransition } from 'react'
import { refreshAwardsAction, refreshContractsAction, scoreAwardsAction } from '@/app/lib/actions/awards'

export default function AwardsToolbar() {
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<'grants' | 'contracts' | 'score' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setBusy('grants')
              const s = await refreshAwardsAction()
              setBusy(null)
              setMsg(s.errors.length ? s.errors[0] : `${s.created} new · ${s.updated} updated grants`)
            })
          }
          className="btn-ghost disabled:opacity-50"
        >
          {pending && busy === 'grants' ? 'Pulling…' : 'Refresh grants'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setBusy('contracts')
              const s = await refreshContractsAction()
              setBusy(null)
              setMsg(s.errors.length ? s.errors[0] : `${s.created} new · ${s.updated} updated contracts`)
            })
          }
          className="btn-ghost disabled:opacity-50"
        >
          {pending && busy === 'contracts' ? 'Pulling…' : 'Refresh contracts'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setBusy('score')
              const s = await scoreAwardsAction()
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
