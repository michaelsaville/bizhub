// Client-to-grant matching (BizHub capability #2). For a given grant, ask
// Claude which of PCC2K's actual TicketHub clients plausibly qualify as the
// APPLICANT/BENEFICIARY — i.e. an entity PCC2K could help apply, then install
// the funded work for. Writes BD_ClientGrantMatch rows as SUGGESTED for the
// operator to confirm/reject. Never auto-advances past SUGGESTED.

import { prisma } from '@/app/lib/prisma'
import { getTicketHubClients, type TicketHubClient } from '@/app/lib/clients'
import { getAnthropic, aiConfigured, AI_SCORING_MODEL, extractJson, textOf } from '@/app/lib/ai'
import { getCapabilityProfile } from '@/app/lib/settings'

export interface MatchRunResult {
  ok: boolean
  grantId: string
  candidates: number
  created: number
  updated: number
  errors: string[]
}

interface MatchRow {
  clientId: string
  score: number
  rationale: string
}

const buildSystemPrompt = (profile: string) => `You match a U.S. federal grant program to a low-voltage / IT integrator's existing
CLIENTS to find which clients could be the grant APPLICANT or beneficiary — an
organization PCC2K could help pursue the grant and then deliver the funded work for.

${profile}

You are given ONE grant and a list of PCC2K's clients (name, type, city/state,
tags, notes). Decide, per client, how plausibly that ORGANIZATION is an eligible
applicant/beneficiary for THIS grant AND the funded work is something PCC2K
installs. A residential/individual client almost never qualifies for an
institutional grant — score those low. Favor schools, libraries, municipalities,
county government, housing authorities, healthcare, and nonprofits in WV/MD/PA.

Return ONLY a JSON array (no prose, no fences) of the clients that plausibly fit,
score >= 55 only (omit poor fits entirely):
[{"clientId": "<id given>", "score": <int 0-100>, "rationale": "<= 160 chars, why this org fits this grant>"}]
If none fit, return [].`

function parseRows(text: string): MatchRow[] {
  const raw = extractJson(text)
  if (!Array.isArray(raw)) return []
  return raw
    .map((r) => r as Record<string, unknown>)
    .filter((r) => typeof r.clientId === 'string')
    .map((r) => ({
      clientId: String(r.clientId),
      score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))),
      rationale: String(r.rationale ?? '').slice(0, 240),
    }))
}

function clientPayload(clients: TicketHubClient[]) {
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.clientType,
    location: [c.city, c.state].filter(Boolean).join(', '),
    tags: c.tags,
    notes: c.notes?.slice(0, 200) ?? '',
  }))
}

export async function findClientMatchesForGrant(grantId: string): Promise<MatchRunResult> {
  const result: MatchRunResult = {
    ok: false,
    grantId,
    candidates: 0,
    created: 0,
    updated: 0,
    errors: [],
  }

  if (!aiConfigured()) {
    result.errors.push('ANTHROPIC_API_KEY is not set — cannot match clients.')
    return result
  }

  const grant = await prisma.bD_GrantProgram.findUnique({ where: { id: grantId } })
  if (!grant) {
    result.errors.push('Grant not found.')
    return result
  }

  const clients = await getTicketHubClients()
  if (clients.length === 0) {
    result.ok = true
    return result
  }

  const grantForAI = {
    name: grant.name,
    agency: grant.agency,
    description: grant.description ?? '',
    eligibility: grant.eligibility ?? {},
    deadline: grant.nextDeadline?.toISOString().slice(0, 10) ?? null,
  }

  let rows: MatchRow[]
  try {
    const anthropic = getAnthropic()
    const msg = await anthropic.messages.create({
      model: AI_SCORING_MODEL,
      max_tokens: 2000,
      system: buildSystemPrompt(await getCapabilityProfile()),
      messages: [
        {
          role: 'user',
          content: `GRANT:\n${JSON.stringify(grantForAI)}\n\nCLIENTS:\n${JSON.stringify(
            clientPayload(clients),
          )}`,
        },
      ],
    })
    rows = parseRows(textOf(msg))
  } catch (e) {
    result.errors.push(`AI match failed: ${(e as Error).message}`)
    return result
  }

  result.candidates = rows.length
  const clientById = new Map(clients.map((c) => [c.id, c]))

  for (const row of rows) {
    const client = clientById.get(row.clientId)
    if (!client) continue
    try {
      const existing = await prisma.bD_ClientGrantMatch.findFirst({
        where: { grantId, externalClientId: client.id },
        select: { id: true },
      })
      if (existing) {
        await prisma.bD_ClientGrantMatch.update({
          where: { id: existing.id },
          data: {
            matchScore: row.score,
            matchNotes: row.rationale,
            clientNameCached: client.name,
          },
        })
        result.updated++
      } else {
        await prisma.bD_ClientGrantMatch.create({
          data: {
            grantId,
            externalClientId: client.id,
            clientNameCached: client.name,
            matchScore: row.score,
            matchNotes: row.rationale,
            status: 'SUGGESTED',
          },
        })
        result.created++
      }
    } catch (e) {
      result.errors.push(`upsert ${client.id}: ${(e as Error).message}`)
    }
  }

  result.ok = result.errors.length === 0
  return result
}
