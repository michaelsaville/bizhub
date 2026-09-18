'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addToPipelineAction } from '@/app/lib/actions/pipeline'

type ItemType = 'GRANT' | 'BID' | 'AWARD' | 'MATCH' | 'PROPOSAL'

export default function PipelineButton({
  itemType,
  refId,
  title,
  subtitle,
  valueCents,
  inPipeline,
  stage,
}: {
  itemType: ItemType
  refId: string
  title: string
  subtitle?: string
  valueCents?: number | null
  inPipeline: boolean
  stage?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [added, setAdded] = useState(inPipeline)
  const [addedStage, setAddedStage] = useState(stage)

  if (added) {
    return (
      <Link href="/pipeline" className="btn-ghost shrink-0">
        In pipeline{addedStage ? ` · ${addedStage.toLowerCase()}` : ''} →
      </Link>
    )
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await addToPipelineAction({ itemType, refId, title, subtitle, valueCents })
          setAdded(true)
          setAddedStage('PURSUING')
          router.refresh()
        })
      }
      className="btn-primary shrink-0 disabled:opacity-50"
    >
      {pending ? 'Adding…' : 'Add to pipeline'}
    </button>
  )
}
