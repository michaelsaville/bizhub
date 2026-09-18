// AI relevance scoring for funded awards. Scores whether a recently-funded
// organization is a plausible PCC2K SALES prospect — i.e. the award funds
// installable physical-security / network / broadband / facility work for an
// org type PCC2K serves. Writes BD_FundedAward.relevanceScore/Category/Notes.

import { prisma } from '@/app/lib/prisma'
import { getAnthropic, aiConfigured, AI_SCORING_MODEL, extractJson, textOf } from '@/app/lib/ai'
import { getCapabilityProfile } from '@/app/lib/settings'

const BATCH_SIZE = 12
const CONCURRENCY = 5
const MAX_PER_RUN = 120

export interface AwardScoreSummary {
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

const buildSystemPrompt = (profile: string) => `You score recently-AWARDED federal funding as SALES/SUBCONTRACT PROSPECTS for a
low-voltage / IT integrator. Each item is either a GRANT (assistance the recipient
will SPEND — a potential BUYER) or a CONTRACT (procurement the recipient WON — a
potential SUBCONTRACT partner or competitor). Its "kind" is given.

${profile}

Score 0-100 = how strong a PCC2K opportunity this is:
- GRANT items: high if the award funds installable physical-security / cameras /
  access control / networking / broadband / structured cabling / facility security
  for a school, library, municipality, county, housing authority, nonprofit, or
  small business in the region (they'll hire someone to install it).
- CONTRACT items: high if the funded work is construction / renovation / facility /
  electronic-security / cabling / network work where PCC2K could SUBCONTRACT the
  low-voltage scope, OR the winner is a firm PCC2K could partner with or sell IT to.
- 40-59: tangential — infrastructure is a stretch.
- 0-39: NOT a PCC2K fit — research grants, medical/clinical, social services,
  university science, agriculture, entitlement/formula funding (Medicaid, block
  grants), or contracts with no install/facility component. Score LOW even if a
  keyword matched.

category: ONE of "Physical Security", "Networking/Broadband", "School Safety",
"Facility/Construction", "Managed IT", "Subcontract", "Unrelated".
rationale: <= 140 chars — name the deciding factor (kind + org + funded work).

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

export async function scoreUnscoredAwards(): Promise<AwardScoreSummary> {
  const summary: AwardScoreSummary = {
    ok: false,
    ran: new Date().toISOString(),
    scored: 0,
    remaining: 0,
    errors: [],
  }
  if (!aiConfigured()) {
    summary.errors.push('ANTHROPIC_API_KEY is not set — cannot score awards.')
    return summary
  }

  const unscored = await prisma.bD_FundedAward.findMany({
    where: { relevanceScore: null, dismissedAt: null },
    orderBy: { startDate: 'desc' },
    take: MAX_PER_RUN,
    select: { id: true, externalId: true, recipientName: true, awardingAgency: true, purpose: true, recipientState: true, source: true },
  })
  const totalUnscored = await prisma.bD_FundedAward.count({
    where: { relevanceScore: null, dismissedAt: null },
  })
  summary.remaining = Math.max(0, totalUnscored - unscored.length)

  if (unscored.length === 0) {
    summary.ok = true
    return summary
  }

  const byExternalId = new Map(unscored.map((a) => [a.externalId, a.id]))
  const lites = unscored.map((a) => ({
    id: a.externalId,
    kind: a.source === 'usaspending-contract' ? 'contract' : 'grant',
    recipient: a.recipientName,
    agency: a.awardingAgency,
    state: a.recipientState,
    purpose: (a.purpose ?? '').slice(0, 500),
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
          messages: [{ role: 'user', content: `Score these awards:\n${JSON.stringify(batch)}` }],
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
          await prisma.bD_FundedAward.update({
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
