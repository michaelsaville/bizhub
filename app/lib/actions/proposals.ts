'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/app/lib/prisma'
import { draftProposalForMatch, type DraftResult } from '@/app/lib/proposals'

/** Generate an AI proposal draft from a client-grant match. */
export async function draftProposalAction(matchId: string): Promise<DraftResult> {
  const result = await draftProposalForMatch(matchId)
  revalidatePath('/proposals')
  revalidatePath('/matches')
  return result
}

/** Save operator edits to a proposal's section bodies. */
export async function saveProposalAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const existing = await prisma.bD_Proposal.findUnique({ where: { id }, select: { body: true } })
  if (!existing) return
  const body = (existing.body ?? {}) as Record<string, unknown>
  const sections = Array.isArray(body.sections)
    ? (body.sections as { heading: string; body: string }[])
    : []
  const updated = sections.map((s, i) => ({
    heading: s.heading,
    body: String(formData.get(`section_${i}`) ?? s.body),
  }))
  await prisma.bD_Proposal.update({
    where: { id },
    data: { body: { ...body, sections: updated } as unknown as Prisma.InputJsonValue },
  })
  revalidatePath(`/proposals/${id}`)
}

/** Advance a proposal's status (DRAFT → REVIEW → SENT ...). */
export async function setProposalStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  const allowed = ['DRAFT', 'REVIEW', 'SENT', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']
  if (!id || !allowed.includes(status)) return
  await prisma.bD_Proposal.update({
    where: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { status: status as any, ...(status === 'SENT' ? { sentAt: new Date() } : {}) },
  })
  revalidatePath(`/proposals/${id}`)
  revalidatePath('/proposals')
}
