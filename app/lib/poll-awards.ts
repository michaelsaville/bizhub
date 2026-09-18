// Award-watch poller → BD_FundedAward. Ingests recent grant AWARDS to WV/MD/PA
// recipients whose purpose implies installable PCC2K work (physical security,
// networking, broadband, facility upgrades). Upserts on (source, externalId);
// operator fields (relevanceScore/dismissedAt) untouched on update.

import { prisma } from '@/app/lib/prisma'
import { fetchAwards, awardUrl, type UsaAward } from '@/app/lib/sources/usaspending'
import { getAwardKeywords, getTargetStates } from '@/app/lib/settings'

const LOOKBACK_MONTHS = 24
const PAGE_SIZE = 100
const MAX_PAGES = 6 // ≤600 awards/run

export const AWARDS_CONFIG = {
  lookbackMonths: LOOKBACK_MONTHS,
}

export interface AwardsPollSummary {
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

function toCents(amount?: number): bigint | null {
  if (amount == null || !Number.isFinite(amount)) return null
  return BigInt(Math.round(amount * 100))
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function pollAwards(): Promise<AwardsPollSummary> {
  const summary: AwardsPollSummary = {
    ok: false,
    ran: new Date().toISOString(),
    fetched: 0,
    created: 0,
    updated: 0,
    truncated: false,
    errors: [],
  }

  const now = new Date()
  const start = new Date(now)
  start.setMonth(start.getMonth() - LOOKBACK_MONTHS)
  const startDate = ymd(start)
  const endDate = ymd(now)
  const [states, keywords] = await Promise.all([getTargetStates(), getAwardKeywords()])

  for (let page = 1; page <= MAX_PAGES; page++) {
    let res: { results: UsaAward[]; hasNext: boolean }
    try {
      res = await fetchAwards({
        states,
        keywords,
        startDate,
        endDate,
        page,
        limit: PAGE_SIZE,
      })
    } catch (e) {
      summary.errors.push(`page ${page}: ${(e as Error).message}`)
      break
    }

    if (res.results.length === 0) break
    summary.fetched += res.results.length

    for (const a of res.results) {
      const externalId = a.generated_internal_id || a['Award ID']
      if (!externalId) continue
      const data = {
        source: 'usaspending',
        externalId,
        recipientName: a['Recipient Name']?.trim() || 'Unknown recipient',
        recipientState: a['Place of Performance State Code'] ?? null,
        recipientCity: null as string | null,
        awardAmountCents: toCents(a['Award Amount']),
        awardingAgency: a['Awarding Agency'] ?? null,
        awardType: a['Award Type'] ?? null,
        purpose: a.Description?.slice(0, 4000) ?? null,
        startDate: toDate(a['Start Date']),
        endDate: toDate(a['End Date']),
        sourceUrl: awardUrl(a.generated_internal_id),
        rawPayload: a as unknown as object,
      }
      try {
        const existing = await prisma.bD_FundedAward.findUnique({
          where: { source_externalId: { source: 'usaspending', externalId } },
          select: { id: true },
        })
        await prisma.bD_FundedAward.upsert({
          where: { source_externalId: { source: 'usaspending', externalId } },
          create: data,
          update: data,
        })
        if (existing) summary.updated++
        else summary.created++
      } catch (e) {
        summary.errors.push(`upsert ${externalId}: ${(e as Error).message}`)
      }
    }

    if (!res.hasNext) break
    if (page === MAX_PAGES) summary.truncated = true
  }

  summary.ok = summary.errors.length === 0
  return summary
}
