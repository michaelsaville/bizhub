// AI relevance scoring for bid opportunities (E-Rate 470s and, later, SAM.gov).
// Scores how well the requested work matches PCC2K's install capabilities, into
// BD_BidOpportunity.matchScore/matchCategory/matchNotes/scoredAt. Batched +
// concurrency-limited like the grant scorer.

import { prisma } from '@/app/lib/prisma'
import { getAnthropic, aiConfigured, AI_SCORING_MODEL, extractJson, textOf } from '@/app/lib/ai'
import { getCapabilityProfile } from '@/app/lib/settings'

const BATCH_SIZE = 12
const CONCURRENCY = 5
const MAX_PER_RUN = 120

export interface BidScoreSummary {
  ok: boolean
  ran: string
  scored: number
  remaining: number
  errors: string[]
}

interface ScoreRow {
  id: string // externalId
  score: number
  category: string
  rationale: string
}

const buildSystemPrompt = (profile: string) => `You score how well a public bid / RFP fits a low-voltage / IT integrator, so a
busy owner can focus on the opportunities they can actually win and deliver.

${profile}

Many of these are E-Rate Form 470s from schools and libraries. Category 2
("internal connections": structured cabling, Wi-Fi access points, network
switches, internal wiring) IS PCC2K's install work — score those high. Category 1
("transport": internet access, fiber/WAN circuits from an ISP) is NOT PCC2K work —
score those low. Managed internal broadband / campus Wi-Fi is a fit.

Score 0-100:
- 80-100: clearly requests installable internal-connections work PCC2K performs
  (cabling, WAPs/Wi-Fi, switches, internal network) for an in-region entity.
- 60-79: likely includes such work, or mixed Cat1/Cat2 where the Cat2 part fits.
- 40-59: tangential — mostly transport with minor internal work.
- 0-39: pure ISP transport, or unrelated to PCC2K.

category: ONE of "Networking/Wi-Fi", "Structured Cabling", "Managed IT",
"Transport (ISP)", "Physical Security", "Unrelated".
rationale: <= 140 chars, name the deciding factor.

Return ONLY a JSON array (no prose, no fences):
[{"id":"<id given>","score":<int>,"category":"<category>","rationale":"<text>"}]
Include every item exactly once by the id provided.`

function parseArray(text: string): ScoreRow[] {
  const raw = extractJson(text)
  if (!Array.isArray(raw)) throw new Error('model did not return an array')
  return raw
    .map((r) => r as Record<string, unknown>)
    .filter((r) => typeof r.id === 'string')
    .map((r) => ({
      id: String(r.id),
      score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))),
      category: String(r.category ?? 'Unrelated').slice(0, 40),
      rationale: String(r.rationale ?? '').slice(0, 240),
    }))
}

export async function scoreUnscoredBids(): Promise<BidScoreSummary> {
  const summary: BidScoreSummary = {
    ok: false,
    ran: new Date().toISOString(),
    scored: 0,
    remaining: 0,
    errors: [],
  }
  if (!aiConfigured()) {
    summary.errors.push('ANTHROPIC_API_KEY is not set — cannot score bids.')
    return summary
  }

  const unscored = await prisma.bD_BidOpportunity.findMany({
    where: { matchScore: null, dismissedAt: null },
    orderBy: [{ closingDate: 'desc' }, { createdAt: 'desc' }],
    take: MAX_PER_RUN,
    select: { id: true, externalId: true, title: true, agency: true, description: true, state: true },
  })
  const totalUnscored = await prisma.bD_BidOpportunity.count({
    where: { matchScore: null, dismissedAt: null },
  })
  summary.remaining = Math.max(0, totalUnscored - unscored.length)

  if (unscored.length === 0) {
    summary.ok = true
    return summary
  }

  const byExternalId = new Map(unscored.map((b) => [b.externalId, b.id]))
  const lites = unscored.map((b) => ({
    id: b.externalId,
    title: b.title,
    applicant: b.agency,
    state: b.state,
    request: (b.description ?? '').slice(0, 600),
  }))

  const batches: (typeof lites)[] = []
  for (let i = 0; i < lites.length; i += BATCH_SIZE) batches.push(lites.slice(i, i + BATCH_SIZE))

  const system = buildSystemPrompt(await getCapabilityProfile())

  let cursor = 0
  async function worker() {
    const anthropic = getAnthropic()
    while (cursor < batches.length) {
      const idx = cursor++
      const batch = batches[idx]
      let rows: ScoreRow[]
      try {
        const msg = await anthropic.messages.create({
          model: AI_SCORING_MODEL,
          max_tokens: 1500,
          system,
          messages: [{ role: 'user', content: `Score these bids:\n${JSON.stringify(batch)}` }],
        })
        rows = parseArray(textOf(msg))
      } catch (e) {
        summary.errors.push(`batch ${idx}: ${(e as Error).message}`)
        continue
      }
      for (const row of rows) {
        const dbId = byExternalId.get(row.id)
        if (!dbId) continue
        try {
          await prisma.bD_BidOpportunity.update({
            where: { id: dbId },
            data: {
              matchScore: row.score,
              matchCategory: row.category,
              matchNotes: row.rationale,
              scoredAt: new Date(),
            },
          })
          summary.scored++
        } catch (e) {
          summary.errors.push(`update ${row.id}: ${(e as Error).message}`)
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () => worker()))
  summary.ok = summary.errors.length === 0
  return summary
}
