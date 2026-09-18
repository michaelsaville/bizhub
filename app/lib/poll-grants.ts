// Grants.gov poller — keyless companion to the SAM.gov bid poller.
//
// Queries a curated set of capability keywords (things PCC2K can actually
// install), dedups hits across keywords by Grants.gov id, and upserts into
// BD_GrantProgram keyed on (source, externalId). Only posted + forecasted
// programs are pulled — closed/archived would flood the table with stale rows.
//
// No client matching here — that's capability #2 (BD_ClientGrantMatch), a
// later slice. This is just the raw pipe: real grants on screen.

import { prisma } from '@/app/lib/prisma'
import {
  fetchGrantsPage,
  grantDetailUrl,
  grantStatus,
  type GrantHit,
} from '@/app/lib/sources/grants-gov'
import { getGrantKeywords } from '@/app/lib/settings'

const ROWS_PER_KEYWORD = 50

export const GRANTS_CONFIG = {
  statuses: 'posted + forecasted',
}

export interface GrantsPollSummary {
  ok: boolean
  ran: string
  fetched: number // total hits returned across all keyword queries
  unique: number // distinct programs after cross-keyword dedup
  created: number
  updated: number
  keywordBreakdown: Record<string, number>
  errors: string[]
}

function parseMMDDYYYY(v?: string): Date | null {
  if (!v || !v.trim()) return null
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim())
  if (m) return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]))
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function describe(h: GrantHit): string | null {
  const parts = [
    h.number,
    h.docType,
    h.cfdaList?.length ? `CFDA ${h.cfdaList.join(', ')}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

export async function pollGrantsGov(): Promise<GrantsPollSummary> {
  const summary: GrantsPollSummary = {
    ok: false,
    ran: new Date().toISOString(),
    fetched: 0,
    unique: 0,
    created: 0,
    updated: 0,
    keywordBreakdown: {},
    errors: [],
  }

  const seen = new Set<string>()
  const keywords = await getGrantKeywords()

  for (const keyword of keywords) {
    let page
    try {
      page = await fetchGrantsPage({ keyword, rows: ROWS_PER_KEYWORD })
    } catch (e) {
      summary.errors.push(`"${keyword}": ${(e as Error).message}`)
      continue
    }

    summary.fetched += page.hits.length

    for (const h of page.hits) {
      if (!h.id || seen.has(h.id)) continue
      seen.add(h.id)
      summary.unique++
      summary.keywordBreakdown[keyword] = (summary.keywordBreakdown[keyword] ?? 0) + 1

      const data = {
        source: 'grants.gov',
        externalId: h.id,
        name: h.title?.trim() || '(untitled program)',
        agency: h.agency || h.agencyCode || '—',
        description: describe(h),
        eligibility: {
          number: h.number ?? '',
          cfdaList: h.cfdaList ?? [],
          oppStatus: h.oppStatus ?? '',
          openDate: h.openDate ?? '',
        },
        nextDeadline: parseMMDDYYYY(h.closeDate),
        sourceUrl: grantDetailUrl(h.id),
        status: grantStatus(h.oppStatus),
      }

      try {
        const existing = await prisma.bD_GrantProgram.findUnique({
          where: { source_externalId: { source: 'grants.gov', externalId: h.id } },
          select: { id: true },
        })
        await prisma.bD_GrantProgram.upsert({
          where: { source_externalId: { source: 'grants.gov', externalId: h.id } },
          create: data,
          update: data,
        })
        if (existing) summary.updated++
        else summary.created++
      } catch (e) {
        summary.errors.push(`upsert ${h.id}: ${(e as Error).message}`)
      }
    }
  }

  summary.ok = summary.errors.length === 0
  return summary
}
