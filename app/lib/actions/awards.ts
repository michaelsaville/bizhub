'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'
import { pollAwards, type AwardsPollSummary } from '@/app/lib/poll-awards'
import { pollContracts, type ContractsPollSummary } from '@/app/lib/poll-contracts'
import { scoreUnscoredAwards, type AwardScoreSummary } from '@/app/lib/score-awards'

/** Manual "Refresh grants" trigger (keyless USAspending assistance awards). */
export async function refreshAwardsAction(): Promise<AwardsPollSummary> {
  const summary = await pollAwards()
  revalidatePath('/awards')
  return summary
}

/** Manual "Refresh contracts" trigger (keyless USAspending contract awards). */
export async function refreshContractsAction(): Promise<ContractsPollSummary> {
  const summary = await pollContracts()
  revalidatePath('/awards')
  return summary
}

/** Manual "Score with AI" trigger for awards. */
export async function scoreAwardsAction(): Promise<AwardScoreSummary> {
  const summary = await scoreUnscoredAwards()
  revalidatePath('/awards')
  revalidatePath('/')
  return summary
}

/** Triage: soft-hide a funded award. */
export async function dismissAwardAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await prisma.bD_FundedAward.update({ where: { id }, data: { dismissedAt: new Date() } })
  revalidatePath('/awards')
}

/** Undo an award dismissal. */
export async function restoreAwardAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await prisma.bD_FundedAward.update({ where: { id }, data: { dismissedAt: null } })
  revalidatePath('/awards')
}
