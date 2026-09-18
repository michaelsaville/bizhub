'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'
import { pollBusinesses, type BusinessPollSummary } from '@/app/lib/poll-businesses'
import { scoreUnscoredBusinesses, type BusinessScoreSummary } from '@/app/lib/score-businesses'

export async function refreshBusinessesAction(): Promise<BusinessPollSummary> {
  const summary = await pollBusinesses()
  revalidatePath('/businesses')
  return summary
}

export async function scoreBusinessesAction(): Promise<BusinessScoreSummary> {
  const summary = await scoreUnscoredBusinesses()
  revalidatePath('/businesses')
  return summary
}

export async function dismissBusinessAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await prisma.bD_NewBusiness.update({ where: { id }, data: { dismissedAt: new Date() } })
  revalidatePath('/businesses')
}

export async function restoreBusinessAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await prisma.bD_NewBusiness.update({ where: { id }, data: { dismissedAt: null } })
  revalidatePath('/businesses')
}
