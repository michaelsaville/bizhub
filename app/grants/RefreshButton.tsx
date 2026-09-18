'use client'

import { useState, useTransition } from 'react'
import { refreshGrantsAction } from '@/app/lib/actions/grants'
import type { GrantsPollSummary } from '@/app/lib/poll-grants'

export default function GrantsRefreshButton() {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<GrantsPollSummary | null>(null)

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await refreshGrantsAction()))}
        className="btn-primary disabled:opacity-50"
      >
        {pending ? 'Polling Grants.gov…' : 'Refresh from Grants.gov'}
      </button>

      {result && (
        <div className="max-w-sm text-right">
          {result.errors.length > 0 ? (
            <p className="text-xs text-rose-600">{result.errors[0]}</p>
          ) : (
            <p className="text-xs text-slate-500">
              {result.created} new · {result.updated} updated ·{' '}
              {result.unique} unique programs from {result.fetched} hits
            </p>
          )}
        </div>
      )}
    </div>
  )
}
