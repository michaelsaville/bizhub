// Light AI scoring for new businesses. Signal is thin (name + entity type +
// county only), so scoring INFERS likely industry from the name and judges
// whether it's a plausible MSP prospect (needs network/cameras/phones/IT).
// Honest about uncertainty — most generic-named LLCs land mid/low.

import { prisma } from '@/app/lib/prisma'
import {
  getAnthropic,
  aiConfigured,
  AI_SCORING_MODEL,
  extractJson,
  textOf,
} from '@/app/lib/ai'
import { getCapabilityProfile } from '@/app/lib/settings'

const BATCH_SIZE = 20
const CONCURRENCY = 5
const MAX_PER_RUN = 200

export interface BusinessScoreSummary {
  ok: boolean
  ran: string
  scored: number
  remaining: number
  errors: string[]
}

interface ScoreRow {
  id: string
  score: number
  category: string
  rationale: string
}

const buildSystemPrompt = (profile: string) => `You score newly-registered businesses as MSP SALES PROSPECTS for a low-voltage /
IT integrator. You get only the business NAME, entity type, and county — INFER the
likely industry from the name and judge whether this org would plausibly need
PCC2K's services (network/Wi-Fi/cabling, security cameras, access control, phones,
managed IT) when they set up or grow.

${profile}

Score 0-100:
- 70-100: name strongly implies a business with a physical location + staff that
  needs IT/network/security (retail, restaurant, medical/dental, office, clinic,
  auto, manufacturing, construction/contractor, hospitality, daycare, gym, salon).
- 40-69: plausible but uncertain (generic name, could be a real operating business).
- 0-39: likely NOT a prospect — real-estate holding co, rental/property LLC,
  investment/holding vehicle, single-person consulting, trucking owner-op, or a
  name implying no premises/IT footprint.

category: a short inferred industry label (e.g. "Restaurant", "Construction",
"Medical", "Retail", "Holding/RE", "Unknown").
rationale: <= 120 chars — the inference and why.

Return ONLY a JSON array (no prose, no fences):
[{"id":"<id given>","score":<int>,"category":"<label>","rationale":"<text>"}]
Include every business exactly once by the id provided.`

function parseArray(text: string): ScoreRow[] {
  const raw = extractJson(text)
  if (!Array.isArray(raw)) throw new Error('model did not return an array')
  return raw
    .map((r) => r as Record<string, unknown>)
    .filter((r) => typeof r.id === 'string')
    .map((r) => ({
      id: String(r.id),
      score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))),
      category: String(r.category ?? 'Unknown').slice(0, 40),
      rationale: String(r.rationale ?? '').slice(0, 240),
    }))
}

export async function scoreUnscoredBusinesses(): Promise<BusinessScoreSummary> {
  const summary: BusinessScoreSummary = {
    ok: false,
    ran: new Date().toISOString(),
    scored: 0,
    remaining: 0,
    errors: [],
  }
  if (!aiConfigured()) {
    summary.errors.push('ANTHROPIC_API_KEY is not set — cannot score businesses.')
    return summary
  }

  const unscored = await prisma.bD_NewBusiness.findMany({
    where: { relevanceScore: null, dismissedAt: null },
    orderBy: { filedDate: 'desc' },
    take: MAX_PER_RUN,
    select: { id: true, externalId: true, name: true, entityType: true, county: true },
  })
  const totalUnscored = await prisma.bD_NewBusiness.count({
    where: { relevanceScore: null, dismissedAt: null },
  })
  summary.remaining = Math.max(0, totalUnscored - unscored.length)

  if (unscored.length === 0) {
    summary.ok = true
    return summary
  }

  const byExternalId = new Map(unscored.map((b) => [b.externalId, b.id]))
  const lites = unscored.map((b) => ({
    id: b.externalId,
    name: b.name,
    type: b.entityType,
    county: b.county,
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
          max_tokens: 2000,
          system,
          messages: [{ role: 'user', content: `Score these businesses:\n${JSON.stringify(batch)}` }],
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
          await prisma.bD_NewBusiness.update({
            where: { id: dbId },
            data: {
              relevanceScore: row.score,
              relevanceCategory: row.category,
              relevanceNotes: row.rationale,
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
