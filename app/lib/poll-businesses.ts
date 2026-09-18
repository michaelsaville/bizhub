// New-business poller → BD_NewBusiness. Pulls recently-registered LLCs/corps in
// PCC2K's PA border counties, dedups by filing number, upserts. Greenfield MSP
// prospects. Operator fields (relevanceScore/dismissedAt) untouched on update.

import { prisma } from '@/app/lib/prisma'
import { fetchPaBusinesses, type PaBusinessRow } from '@/app/lib/sources/pa-business'

// PA counties bordering / near Cumberland MD (PCC2K's base).
const NEAR_REGION_COUNTIES = [
  'Somerset',
  'Bedford',
  'Fulton',
  'Franklin',
  'Fayette',
  'Greene',
  'Washington',
]
// For-profit entity types worth prospecting (skip nonprofits/partnerships noise).
const ENTITY_TYPES_LIKE = ['Limited Liability', 'Business Corporation']
const LOOKBACK_DAYS = 120
const PAGE_SIZE = 500
const MAX_PAGES = 4

export const BUSINESS_CONFIG = { counties: NEAR_REGION_COUNTIES, lookbackDays: LOOKBACK_DAYS }

export interface BusinessPollSummary {
  ok: boolean
  ran: string
  fetched: number
  unique: number
  created: number
  updated: number
  errors: string[]
}

function toDate(v?: string): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function titleCase(s?: string): string | null {
  return s ? s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()) : null
}

export async function pollBusinesses(): Promise<BusinessPollSummary> {
  const summary: BusinessPollSummary = {
    ok: false,
    ran: new Date().toISOString(),
    fetched: 0,
    unique: 0,
    created: 0,
    updated: 0,
    errors: [],
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10)
  const seen = new Set<string>()

  for (let page = 0; page < MAX_PAGES; page++) {
    let rows: PaBusinessRow[]
    try {
      rows = await fetchPaBusinesses({
        counties: NEAR_REGION_COUNTIES,
        entityTypesLike: ENTITY_TYPES_LIKE,
        since,
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
      const filing = r.filing_number
      if (!filing || seen.has(filing)) continue
      seen.add(filing)
      summary.unique++

      const data = {
        source: 'pa-dos',
        externalId: filing,
        name: titleCase(r.business_name) || '(unnamed)',
        entityType: r.typeofbusinessregistration ?? null,
        county: titleCase(r.shortcountyname),
        city: titleCase(r.city),
        state: 'PA',
        filedDate: toDate(r.creationdate),
        sourceUrl: `https://www.corporations.pa.gov/search/corpsearch`,
        rawPayload: r as unknown as object,
      }
      try {
        const existing = await prisma.bD_NewBusiness.findUnique({
          where: { source_externalId: { source: 'pa-dos', externalId: filing } },
          select: { id: true },
        })
        await prisma.bD_NewBusiness.upsert({
          where: { source_externalId: { source: 'pa-dos', externalId: filing } },
          create: data,
          update: data,
        })
        if (existing) summary.updated++
        else summary.created++
      } catch (e) {
        summary.errors.push(`upsert ${filing}: ${(e as Error).message}`)
      }
    }
    if (rows.length < PAGE_SIZE) break
  }

  summary.ok = summary.errors.length === 0
  return summary
}
