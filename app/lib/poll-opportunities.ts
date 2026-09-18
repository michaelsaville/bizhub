// SAM.gov bid poller — first real BizHub data slice (no AI yet).
//
// Loops our target NAICS codes over a rolling lookback window, keeps only
// postings whose place-of-performance is WV/MD/PA, and upserts them into
// BD_BidOpportunity keyed on (source, externalId). Operator-set fields
// (status, matchScore, matchNotes) are deliberately NOT overwritten on
// update — only the source-derived fields are refreshed.
//
// Silent-cap discipline (per feedback_full_sweep_pattern): the summary reports
// exactly what was fetched, matched, dropped-out-of-state, and truncated by the
// per-NAICS page cap, so "quiet" runs are never mistaken for "nothing new".

import { prisma } from '@/app/lib/prisma'
import {
  fetchSamPage,
  placeOfPerformanceState,
  type SamOpportunity,
} from '@/app/lib/sources/sam-gov'

// PCC2K capability NAICS: 238210 electrical/low-voltage contractors,
// 561621 security systems services (cameras/access), 541512 computer systems
// design (networking/IT). Extend as we validate signal.
const TARGET_NAICS = ['238210', '561621', '541512'] as const
const TARGET_STATES = ['WV', 'MD', 'PA'] as const
const LOOKBACK_DAYS = 30
const PAGE_SIZE = 100
const MAX_PAGES_PER_NAICS = 3 // safety cap — ≤300 notices/NAICS/run

export const POLL_CONFIG = {
  naics: TARGET_NAICS,
  states: TARGET_STATES,
  lookbackDays: LOOKBACK_DAYS,
}

export interface PollSummary {
  ok: boolean
  ran: string // ISO timestamp
  windowFrom: string // MM/dd/yyyy
  windowTo: string // MM/dd/yyyy
  fetched: number // rows returned by SAM across all NAICS/pages
  matchedState: number // rows in a target state
  droppedOutOfState: number
  created: number
  updated: number
  truncatedNaics: string[] // NAICS that hit the page cap (more may exist)
  naicsBreakdown: Record<string, number>
  errors: string[]
}

function mmddyyyy(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}`
}

function toDate(v?: string | null): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function collectNaics(o: SamOpportunity): string[] {
  return Array.from(
    new Set([o.naicsCode, ...(o.naicsCodes ?? [])].filter(Boolean) as string[]),
  )
}

export async function pollSamGov(): Promise<PollSummary> {
  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - LOOKBACK_DAYS)
  const windowTo = mmddyyyy(now)
  const windowFrom = mmddyyyy(from)

  const summary: PollSummary = {
    ok: false,
    ran: now.toISOString(),
    windowFrom,
    windowTo,
    fetched: 0,
    matchedState: 0,
    droppedOutOfState: 0,
    created: 0,
    updated: 0,
    truncatedNaics: [],
    naicsBreakdown: {},
    errors: [],
  }

  const apiKey = process.env.SAM_GOV_API_KEY?.trim()
  if (!apiKey) {
    summary.errors.push(
      'SAM_GOV_API_KEY is not set. Register a free key at sam.gov → Account Details → API Key, add it to ~/bizhub/.env.local, then rebuild the container.',
    )
    return summary
  }

  for (const naics of TARGET_NAICS) {
    let offset = 0
    for (let page = 0; page < MAX_PAGES_PER_NAICS; page++) {
      let resp
      try {
        resp = await fetchSamPage({
          apiKey,
          postedFrom: windowFrom,
          postedTo: windowTo,
          naics,
          limit: PAGE_SIZE,
          offset,
        })
      } catch (e) {
        summary.errors.push(`NAICS ${naics} page ${page}: ${(e as Error).message}`)
        break
      }

      const rows = resp.opportunitiesData ?? []
      summary.fetched += rows.length

      for (const o of rows) {
        if (!o.noticeId) continue
        const st = placeOfPerformanceState(o)
        if (!st || !(TARGET_STATES as readonly string[]).includes(st)) {
          summary.droppedOutOfState++
          continue
        }
        summary.matchedState++
        summary.naicsBreakdown[naics] = (summary.naicsBreakdown[naics] ?? 0) + 1

        const data = {
          source: 'sam.gov',
          externalId: o.noticeId,
          title: o.title?.trim() || '(untitled notice)',
          description:
            [o.type, o.typeOfSetAsideDescription].filter(Boolean).join(' · ') || null,
          agency: o.fullParentPathName ?? null,
          state: st,
          naicsCodes: collectNaics(o),
          postingDate: toDate(o.postedDate),
          closingDate: toDate(o.responseDeadLine),
          setAsideType: o.typeOfSetAsideDescription ?? null,
          sourceUrl: o.uiLink ?? null,
          rawPayload: o as unknown as object,
        }

        try {
          const existing = await prisma.bD_BidOpportunity.findUnique({
            where: { source_externalId: { source: 'sam.gov', externalId: o.noticeId } },
            select: { id: true },
          })
          await prisma.bD_BidOpportunity.upsert({
            where: { source_externalId: { source: 'sam.gov', externalId: o.noticeId } },
            create: data,
            update: data, // status / matchScore / matchNotes intentionally omitted
          })
          if (existing) summary.updated++
          else summary.created++
        } catch (e) {
          summary.errors.push(`upsert ${o.noticeId}: ${(e as Error).message}`)
        }
      }

      offset += PAGE_SIZE
      const exhausted = rows.length < PAGE_SIZE || offset >= (resp.totalRecords ?? 0)
      if (exhausted) break
      if (page === MAX_PAGES_PER_NAICS - 1 && !exhausted) {
        summary.truncatedNaics.push(naics)
      }
    }
  }

  summary.ok = summary.errors.length === 0
  return summary
}
