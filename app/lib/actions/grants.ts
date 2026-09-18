'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'
import { pollGrantsGov, type GrantsPollSummary } from '@/app/lib/poll-grants'
import { scoreUnscoredGrants, type ScoreSummary } from '@/app/lib/score-grants'

/** Manual "Refresh from Grants.gov" trigger for the /grants page. */
export async function refreshGrantsAction(): Promise<GrantsPollSummary> {
  const summary = await pollGrantsGov()
  revalidatePath('/grants')
  return summary
}

/** Manual "Score with AI" trigger — ranks unscored grants by PCC2K fit. */
export async function scoreGrantsAction(): Promise<ScoreSummary> {
  const summary = await scoreUnscoredGrants()
  revalidatePath('/grants')
  revalidatePath('/')
  return summary
}

/** Triage: soft-hide a grant from the working list. */
export async function dismissGrantAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await prisma.bD_GrantProgram.update({ where: { id }, data: { dismissedAt: new Date() } })
  revalidatePath('/grants')
}

/** Undo a dismissal. */
export async function restoreGrantAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await prisma.bD_GrantProgram.update({ where: { id }, data: { dismissedAt: null } })
  revalidatePath('/grants')
}
