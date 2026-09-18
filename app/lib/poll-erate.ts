// E-Rate Form 470 poller → BD_BidOpportunity. Ingests Category-2 (internal
// connections) 470s for WV/MD/PA as bid opportunities / prospect leads.
// Contact info is preserved in rawPayload for the detail page. Upserts on
// (source, externalId); operator fields (status/matchScore/dismissedAt) are
// left untouched on update.

import { prisma } from '@/app/lib/prisma'
import { fetchErate470s, type Erate470 } from '@/app/lib/sources/erate'
import { getTargetStates } from '@/app/lib/settings'

const FUNDING_YEARS = ['2026', '2027'] as const // current + next cycle
const PAGE_SIZE = 200
const MAX_PAGES = 6 // ≤1200 records/run safety cap

export const ERATE_CONFIG = {
  fundingYears: FUNDING_YEARS,
}

export interface EratePollSummary {
  ok: boolean
  ran: string
  fetched: number
  created: number
  updated: number
  truncated: boolean
  errors: string[]
}

function toDate(v?: string): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function description(r: Erate470): string | null {
  const cat2 = r.category_two_description?.trim()
  const cat1 = r.category_one_description?.trim()
  const parts: string[] = []
  if (cat2) parts.push(`Category 2 (internal connections): ${cat2}`)
  if (cat1) parts.push(`Category 1 (transport): ${cat1}`)
  return parts.join('\n\n').slice(0, 4000) || null
}

export async function pollErate(): Promise<EratePollSummary> {
  const summary: EratePollSummary = {
    ok: false,
    ran: new Date().toISOString(),
    fetched: 0,
    created: 0,
    updated: 0,
    truncated: false,
    errors: [],
  }

  const states = await getTargetStates()

  for (let page = 0; page < MAX_PAGES; page++) {
    let rows: Erate470[]
    try {
      rows = await fetchErate470s({
        states,
        fundingYears: [...FUNDING_YEARS],
        cat2Only: true,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
    } catch (e) {
      summary.errors.push(`page ${page}: ${(e as Error).message}`)
      break
    }

    if (rows.length === 0) break
    summary.fetched += rows.length

    for (const r of rows) {
      if (!r.application_number) continue
      const title =
        r.form_nickname?.trim() ||
        `E-Rate 470 — ${r.billed_entity_name ?? 'Applicant'}`
      const data = {
        source: 'erate-470',
        externalId: r.application_number,
        title,
        description: description(r),
        agency: r.billed_entity_name ?? null,
        state: r.billed_entity_state ?? null,
        naicsCodes: [] as string[],
        postingDate: toDate(r.created_datetime),
        closingDate: toDate(r.allowable_contract_date),
        setAsideType: r.applicant_type ?? null,
        sourceUrl: r.website_url ?? null,
        rawPayload: r as unknown as object,
      }
      try {
        const existing = await prisma.bD_BidOpportunity.findUnique({
          where: { source_externalId: { source: 'erate-470', externalId: r.application_number } },
          select: { id: true },
        })
        await prisma.bD_BidOpportunity.upsert({
          where: { source_externalId: { source: 'erate-470', externalId: r.application_number } },
          create: data,
          update: data, // status / matchScore / dismissedAt intentionally omitted
        })
        if (existing) summary.updated++
        else summary.created++
      } catch (e) {
        summary.errors.push(`upsert ${r.application_number}: ${(e as Error).message}`)
      }
    }

    if (rows.length < PAGE_SIZE) break
    if (page === MAX_PAGES - 1) summary.truncated = true
  }

  summary.ok = summary.errors.length === 0
  return summary
}
