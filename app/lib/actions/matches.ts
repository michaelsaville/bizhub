'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'
import { findClientMatchesForGrant, type MatchRunResult } from '@/app/lib/match-grants'

/** Run AI client-matching for one grant, writing SUGGESTED matches. */
export async function findMatchesAction(grantId: string): Promise<MatchRunResult> {
  const result = await findClientMatchesForGrant(grantId)
  revalidatePath(`/grants/${grantId}`)
  revalidatePath('/matches')
  revalidatePath('/')
  return result
}

/** Operator decision on an AI-suggested client match. */
export async function decideMatchAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const decision = String(formData.get('decision') ?? '')
  if (!id) return
  const status =
    decision === 'accept' ? 'APPLYING' : decision === 'reject' ? 'DECLINED' : null
  if (!status) return
  await prisma.bD_ClientGrantMatch.update({
    where: { id },
    data: { status, decisionAt: new Date() },
  })
  revalidatePath('/matches')
  revalidatePath('/')
}

/**
 * Auto-match the top unmatched hot grants (relevanceScore >= threshold) to
 * PCC2K clients. Produces SUGGESTED matches only — the operator still decides —
 * so running it on a schedule is safe. Used by the match-hot-grants cron.
 */
export async function autoMatchHotGrants(opts?: {
  minScore?: number
  limit?: number
}): Promise<{ processed: number; created: number; results: MatchRunResult[] }> {
  const minScore = opts?.minScore ?? 75
  const limit = opts?.limit ?? 5

  const candidates = await prisma.bD_GrantProgram.findMany({
    where: {
      dismissedAt: null,
      relevanceScore: { gte: minScore },
      clientMatches: { none: {} },
    },
    orderBy: { relevanceScore: 'desc' },
    take: limit,
    select: { id: true },
  })

  const results: MatchRunResult[] = []
  let created = 0
  for (const g of candidates) {
    const r = await findClientMatchesForGrant(g.id)
    results.push(r)
    created += r.created
  }

  revalidatePath('/matches')
  revalidatePath('/')
  return { processed: candidates.length, created, results }
}
