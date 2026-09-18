// AI relevance scoring for grants. Turns the raw, keyword-noisy Grants.gov
// list into a ranked, triageable surface by asking Claude to score each
// program's fit against PCC2K's capability profile (app/lib/ai.ts).
//
// Batched (many grants per Claude call) + concurrency-limited so a single
// invocation stays inside the route's 60s budget. Scores at most MAX_PER_RUN
// programs per call and reports how many remain — click/cron again to finish.

import { prisma } from '@/app/lib/prisma'
import { getAnthropic, aiConfigured, AI_SCORING_MODEL, extractJson, textOf } from '@/app/lib/ai'
import { getCapabilityProfile } from '@/app/lib/settings'

const BATCH_SIZE = 12 // grants per Claude call
const CONCURRENCY = 5 // batches in flight at once
const MAX_PER_RUN = 120 // cap per invocation to respect maxDuration

export interface ScoreSummary {
  ok: boolean
  ran: string
  scored: number
  remaining: number
  errors: string[]
}

interface GrantLite {
  externalId: string
  name: string
  agency: string
  description: string | null
  cfda: string[]
}

interface ScoreRow {
  id: string // externalId
  score: number
  category: string
  rationale: string
}

const buildSystemPrompt = (profile: string) => `You score how well U.S. federal grant programs fit a specific low-voltage / IT
managed-service-provider so a busy owner can ignore the noise and focus on real
opportunities.

${profile}

For EACH grant in the batch, judge whether the program could plausibly FUND work
PCC2K installs or manages (cabling, cameras/surveillance, access control,
networking, broadband, managed IT, physical/building security) for an eligible
entity type PCC2K serves.

Score 0-100:
- 80-100: directly funds installable low-voltage / physical-security / network /
  IT infrastructure (e.g. school security, campus cameras, broadband buildout,
  facility security upgrades) for an entity type PCC2K serves.
- 60-79: plausibly includes such infrastructure as an allowable expense, or funds
  facilities/safety work that often carries a security/network component.
- 40-59: tangential — infrastructure is a stretch or a minor allowable cost.
- 0-39: unrelated to PCC2K (research, clinical/medical services, social services,
  individual fellowships, agriculture, arts, etc.).

category: ONE of "Physical Security", "Surveillance", "Access Control",
"Networking/Broadband", "Managed IT", "Facility/Safety", "Unrelated".
rationale: <= 140 chars, plain language, name the deciding factor.

Return ONLY a JSON array — no prose, no markdown fences — of objects:
[{"id": "<the id given>", "score": <int 0-100>, "category": "<category>", "rationale": "<text>"}]
Include every grant from the batch exactly once, keyed by the id provided.`

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

async function scoreBatch(batch: GrantLite[], system: string): Promise<ScoreRow[]> {
  const anthropic = getAnthropic()
  const payload = batch.map((g) => ({
    id: g.externalId,
    name: g.name,
    agency: g.agency,
    summary: g.description ?? '',
    cfda: g.cfda,
  }))
  const msg = await anthropic.messages.create({
    model: AI_SCORING_MODEL,
    max_tokens: 1500,
    system,
    messages: [
      { role: 'user', content: `Score these grants:\n${JSON.stringify(payload)}` },
    ],
  })
  return parseArray(textOf(msg))
}

export async function scoreUnscoredGrants(): Promise<ScoreSummary> {
  const summary: ScoreSummary = {
    ok: false,
    ran: new Date().toISOString(),
    scored: 0,
    remaining: 0,
    errors: [],
  }

  if (!aiConfigured()) {
    summary.errors.push('ANTHROPIC_API_KEY is not set — cannot score grants.')
    return summary
  }

  const unscored = await prisma.bD_GrantProgram.findMany({
    where: { relevanceScore: null },
    orderBy: [{ nextDeadline: 'asc' }, { createdAt: 'desc' }],
    take: MAX_PER_RUN,
    select: {
      id: true,
      externalId: true,
      name: true,
      agency: true,
      description: true,
      eligibility: true,
    },
  })

  const totalUnscored = await prisma.bD_GrantProgram.count({
    where: { relevanceScore: null },
  })
  summary.remaining = Math.max(0, totalUnscored - unscored.length)

  if (unscored.length === 0) {
    summary.ok = true
    return summary
  }

  // externalId is nullable in the model but always set for grants.gov rows.
  const byExternalId = new Map<string, string>() // externalId -> db id
  const lites: GrantLite[] = []
  for (const g of unscored) {
    if (!g.externalId) continue
    byExternalId.set(g.externalId, g.id)
    const elig = (g.eligibility ?? {}) as { cfdaList?: string[] }
    lites.push({
      externalId: g.externalId,
      name: g.name,
      agency: g.agency,
      description: g.description,
      cfda: Array.isArray(elig.cfdaList) ? elig.cfdaList : [],
    })
  }

  // Chunk into batches.
  const batches: GrantLite[][] = []
  for (let i = 0; i < lites.length; i += BATCH_SIZE) {
    batches.push(lites.slice(i, i + BATCH_SIZE))
  }

  const system = buildSystemPrompt(await getCapabilityProfile())

  // Run batches with bounded concurrency.
  let cursor = 0
  async function worker() {
    while (cursor < batches.length) {
      const idx = cursor++
      const batch = batches[idx]
      let rows: ScoreRow[]
      try {
        rows = await scoreBatch(batch, system)
      } catch (e) {
        summary.errors.push(`batch ${idx}: ${(e as Error).message}`)
        continue
      }
      for (const row of rows) {
        const dbId = byExternalId.get(row.id)
        if (!dbId) continue
        try {
          await prisma.bD_GrantProgram.update({
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

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () => worker()),
  )

  summary.ok = summary.errors.length === 0
  return summary
}
