'use client'

import { useState, useTransition } from 'react'
import { sendDigestAction } from '@/app/lib/actions/digest'

export default function DigestSendButton() {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await sendDigestAction()))}
        className="btn-primary disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Send digest now'}
      </button>
      {result && (
        <p className={`max-w-sm text-right text-xs ${result.ok ? 'text-emerald-600' : 'text-amber-600'}`}>
          {result.message}
        </p>
      )}
    </div>
  )
}
