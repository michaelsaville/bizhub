// Proposal draft generator (BizHub capability #3). Given a confirmed/suggested
// client-grant match, ask Claude to draft a grant-application narrative tailored
// to the client + the funded work PCC2K would install. Stored as a BD_Proposal
// (status DRAFT) for the operator to edit — AI output is a starting point, never
// presented as finished/authoritative.

import { Prisma } from '@prisma/client'
import { prisma } from '@/app/lib/prisma'
import { getAnthropic, aiConfigured, AI_WRITING_MODEL, extractJson, textOf } from '@/app/lib/ai'
import { getCapabilityProfile } from '@/app/lib/settings'

export interface ProposalSection {
  heading: string
  body: string
}
export interface ProposalBody {
  summary: string
  sections: ProposalSection[]
  generatedModel: string
  generatedAt: string
  aiDraft: true
}

export interface DraftResult {
  ok: boolean
  proposalId: string | null
  errors: string[]
}

// Lazily ensure a system BD_User exists to own AI-generated proposals while
// auth is bypassed (createdById is a required FK).
export async function getSystemUser(): Promise<string> {
  const email = 'system@bizhub.pcc2k.com'
  const user = await prisma.bD_User.upsert({
    where: { email },
    update: {},
    create: { entraId: 'system', email, name: 'BizHub System', role: 'ADMIN' },
    select: { id: true },
  })
  return user.id
}

const buildSystemPrompt = (profile: string) => `You draft grant-application narratives for a low-voltage / IT integrator that would
partner with the applicant organization to deliver the funded work.

${profile}

You are given a grant program and one of PCC2K's client organizations that plausibly
qualifies. Draft a professional, specific first-draft application narrative FROM THE
APPLICANT ORGANIZATION'S PERSPECTIVE, describing the project PCC2K would implement
(cameras, cabling, access control, networking, or managed IT as fits the grant).

Write these sections, in order:
1. "Executive Summary"
2. "Statement of Need"
3. "Project Description & Scope of Work" (concrete PCC2K-installable systems)
4. "Budget Justification" (narrative only, rough categories — no invented exact dollar figures; use ranges or "TBD pending site survey")
5. "Expected Outcomes"

Keep each section 2-4 short paragraphs. Plain, grant-appropriate prose. Do NOT
fabricate specific award amounts, statistics, or facts about the organization you
weren't given — write so a human can fill specifics in. ASCII characters only.

Return ONLY JSON (no fences):
{"summary": "<1-2 sentence overview>", "sections": [{"heading": "...", "body": "..."}, ...]}`

function parseBody(text: string): { summary: string; sections: ProposalSection[] } {
  const raw = extractJson(text) as Record<string, unknown>
  const sections = Array.isArray(raw.sections)
    ? (raw.sections as Record<string, unknown>[])
        .filter((s) => s && typeof s.heading === 'string')
        .map((s) => ({ heading: String(s.heading), body: String(s.body ?? '') }))
    : []
  return { summary: String(raw.summary ?? ''), sections }
}

export async function draftProposalForMatch(matchId: string): Promise<DraftResult> {
  const result: DraftResult = { ok: false, proposalId: null, errors: [] }

  if (!aiConfigured()) {
    result.errors.push('ANTHROPIC_API_KEY is not set — cannot draft proposals.')
    return result
  }

  const match = await prisma.bD_ClientGrantMatch.findUnique({
    where: { id: matchId },
    include: { grant: true },
  })
  if (!match) {
    result.errors.push('Match not found.')
    return result
  }

  const promptInput = {
    grant: {
      name: match.grant.name,
      agency: match.grant.agency,
      description: match.grant.description ?? '',
      eligibility: match.grant.eligibility ?? {},
      deadline: match.grant.nextDeadline?.toISOString().slice(0, 10) ?? null,
    },
    client: { name: match.clientNameCached, whyItFits: match.matchNotes ?? '' },
  }

  let parsed: { summary: string; sections: ProposalSection[] }
  const model = AI_WRITING_MODEL
  try {
    const anthropic = getAnthropic()
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 3000,
      system: buildSystemPrompt(await getCapabilityProfile()),
      messages: [{ role: 'user', content: JSON.stringify(promptInput) }],
    })
    parsed = parseBody(textOf(msg))
  } catch (e) {
    result.errors.push(`AI draft failed: ${(e as Error).message}`)
    return result
  }

  if (parsed.sections.length === 0) {
    result.errors.push('AI returned no usable sections.')
    return result
  }

  const body: ProposalBody = {
    summary: parsed.summary,
    sections: parsed.sections,
    generatedModel: model,
    generatedAt: new Date().toISOString(),
    aiDraft: true,
  }

  try {
    const createdById = await getSystemUser()
    const proposal = await prisma.bD_Proposal.create({
      data: {
        kind: 'GRANT_APPLICATION',
        title: `${match.clientNameCached} — ${match.grant.name}`,
        externalClientId: match.externalClientId,
        clientNameCached: match.clientNameCached,
        grantMatchId: match.id,
        body: body as unknown as Prisma.InputJsonValue,
        status: 'DRAFT',
        createdById,
      },
      select: { id: true },
    })
    result.proposalId = proposal.id
    result.ok = true
  } catch (e) {
    result.errors.push(`create proposal: ${(e as Error).message}`)
  }

  return result
}
