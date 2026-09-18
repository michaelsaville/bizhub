'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'

type ItemType = 'GRANT' | 'BID' | 'AWARD' | 'MATCH' | 'PROPOSAL'
type Stage = 'PURSUING' | 'SUBMITTED' | 'WON' | 'LOST'

const DETAIL_PATH: Record<ItemType, (id: string) => string> = {
  GRANT: (id) => `/grants/${id}`,
  BID: (id) => `/opportunities/${id}`,
  AWARD: (id) => `/awards/${id}`,
  MATCH: () => `/matches`,
  PROPOSAL: (id) => `/proposals/${id}`,
}

/** Add a lead to the pipeline (idempotent on itemType+refId). */
export async function addToPipelineAction(input: {
  itemType: ItemType
  refId: string
  title: string
  subtitle?: string
  valueCents?: number | null
}): Promise<{ ok: boolean; alreadyIn: boolean }> {
  const existing = await prisma.bD_PipelineItem.findUnique({
    where: { itemType_refId: { itemType: input.itemType, refId: input.refId } },
    select: { id: true },
  })
  if (existing) return { ok: true, alreadyIn: true }

  await prisma.bD_PipelineItem.create({
    data: {
      itemType: input.itemType,
      refId: input.refId,
      titleCached: input.title.slice(0, 300),
      subtitle: input.subtitle?.slice(0, 300) ?? null,
      valueCents: input.valueCents != null ? BigInt(Math.round(input.valueCents)) : null,
      stage: 'PURSUING',
    },
  })
  revalidatePath('/pipeline')
  revalidatePath(DETAIL_PATH[input.itemType](input.refId))
  revalidatePath('/')
  return { ok: true, alreadyIn: false }
}

/** Move a pipeline item to a new stage; stamps closedAt on WON/LOST. */
export async function setStageAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const stage = String(formData.get('stage') ?? '') as Stage
  if (!id || !['PURSUING', 'SUBMITTED', 'WON', 'LOST'].includes(stage)) return
  const closing = stage === 'WON' || stage === 'LOST'
  await prisma.bD_PipelineItem.update({
    where: { id },
    data: { stage, closedAt: closing ? new Date() : null },
  })
  revalidatePath('/pipeline')
  revalidatePath('/')
}

/** Update the value on a pipeline item (dollars → cents). */
export async function setPipelineValueAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const raw = String(formData.get('dollars') ?? '').replace(/[^0-9.]/g, '')
  if (!id) return
  const dollars = raw ? Number(raw) : null
  await prisma.bD_PipelineItem.update({
    where: { id },
    data: { valueCents: dollars != null && Number.isFinite(dollars) ? BigInt(Math.round(dollars * 100)) : null },
  })
  revalidatePath('/pipeline')
}

/** Remove an item from the pipeline. */
export async function removeFromPipelineAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await prisma.bD_PipelineItem.delete({ where: { id } }).catch(() => {})
  revalidatePath('/pipeline')
  revalidatePath('/')
}
