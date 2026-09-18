import Anthropic from '@anthropic-ai/sdk'

// BizHub AI client. Keyed off the env var (shared with TicketHub for now —
// see project_bizdev memory). Unlike TicketHub we don't have an encrypted
// settings layer yet, so read straight from the environment.

let client: Anthropic | null = null

export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  if (!client) client = new Anthropic({ apiKey })
  return client
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

// Robustly pull a JSON value out of a model response even when it wraps the
// JSON in markdown fences or stray prose. Tries a clean parse first, then
// falls back to the outermost [...] / {...} span.
export function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    /* fall through to span extraction */
  }
  const spans: [number, number][] = []
  const a = cleaned.indexOf('['), az = cleaned.lastIndexOf(']')
  const o = cleaned.indexOf('{'), oz = cleaned.lastIndexOf('}')
  if (a !== -1 && az > a) spans.push([a, az])
  if (o !== -1 && oz > o) spans.push([o, oz])
  spans.sort((x, y) => x[0] - y[0])
  for (const [s, e] of spans) {
    try {
      return JSON.parse(cleaned.slice(s, e + 1))
    } catch {
      /* try next span */
    }
  }
  throw new Error('no valid JSON found in model output')
}

// Collapse an Anthropic message's content blocks into plain text.
export function textOf(msg: { content: Array<{ type: string }> }): string {
  return (msg.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
}

// Fast + cheap model for high-volume scoring passes (hundreds of grants).
export const AI_SCORING_MODEL = 'claude-haiku-4-5-20251001'
// Stronger model for one-off generative work (proposal drafts).
export const AI_WRITING_MODEL = 'claude-sonnet-4-6'

// ── PCC2K capability profile ────────────────────────────────────────────────
// The single source of truth for "what work can PCC2K actually win/deliver."
// Fed into every relevance-scoring and matching prompt so the AI judges fit
// against a concrete company, not a vague notion of "IT".
export const PCC2K_PROFILE = `PCC2K is a low-voltage systems integrator and managed IT services provider (MSP)
based in Cumberland, Maryland, serving West Virginia, Maryland, and Pennsylvania
(especially the tri-state Appalachian region — Allegany County MD, Mineral/Hampshire
County WV, and nearby PA).

Services PCC2K can install, integrate, or manage:
- Structured cabling / low-voltage wiring (Cat6, fiber, network drops)
- Security cameras / video surveillance / CCTV systems
- Access control (badge/keycard/door entry systems)
- Networking: switches, routers, firewalls, enterprise Wi-Fi
- Managed IT services, help desk, endpoint/RMM, backups
- Physical security and building security technology
- Broadband / connectivity infrastructure (last-mile, in-building)

Typical customers PCC2K serves or could serve: K-12 schools, public libraries,
municipalities and county government, housing authorities, healthcare/medical
offices, small-to-midsize businesses, nonprofits, and retail sites.

PCC2K does NOT do: medical/clinical services, academic research, social services
delivery, direct human-services programming, agriculture, manufacturing of goods,
or anything unrelated to physical security, networking, cabling, or IT.`
