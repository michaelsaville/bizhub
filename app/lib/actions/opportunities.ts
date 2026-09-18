'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'
import { pollSamGov, type PollSummary } from '@/app/lib/poll-opportunities'
import { pollErate, type EratePollSummary } from '@/app/lib/poll-erate'
import { scoreUnscoredBids, type BidScoreSummary } from '@/app/lib/score-bids'

/** Manual "Refresh from SAM.gov" trigger (blocked until SAM_GOV_API_KEY set). */
export async function refreshOpportunitiesAction(): Promise<PollSummary> {
  const summary = await pollSamGov()
  revalidatePath('/opportunities')
  return summary
}

/** Manual "Refresh E-Rate 470s" trigger (keyless). */
export async function refreshErateAction(): Promise<EratePollSummary> {
  const summary = await pollErate()
  revalidatePath('/opportunities')
  return summary
}

/** Manual "Score with AI" trigger for bids. */
export async function scoreBidsAction(): Promise<BidScoreSummary> {
  const summary = await scoreUnscoredBids()
  revalidatePath('/opportunities')
  revalidatePath('/')
  return summary
}

/** Triage: soft-hide a bid. */
export async function dismissBidAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await prisma.bD_BidOpportunity.update({ where: { id }, data: { dismissedAt: new Date() } })
  revalidatePath('/opportunities')
}

/** Undo a bid dismissal. */
export async function restoreBidAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await prisma.bD_BidOpportunity.update({ where: { id }, data: { dismissedAt: null } })
  revalidatePath('/opportunities')
}
