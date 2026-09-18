// Runtime config layer over BD_Setting. Every tunable the pollers/scorers/
// digest use reads through here, falling back to a hardcoded default when no
// override row exists — so the Settings UI changes behavior WITHOUT a rebuild.
//
// NOTE: BD_Setting.valueEncrypted stores PLAINTEXT here (these are non-secret
// tuning values). Real secrets stay in env, not this table.

import { prisma } from '@/app/lib/prisma'
import { PCC2K_PROFILE } from '@/app/lib/ai'

export const DEFAULTS = {
  targetStates: ['WV', 'MD', 'PA'],
  grantKeywords: [
    'security camera',
    'video surveillance',
    'school security',
    'access control',
    'broadband',
    'structured cabling',
    'physical security',
  ],
  awardKeywords: [
    'school safety',
    'school security',
    'physical security',
    'security camera',
    'video surveillance system',
    'access control',
    'broadband',
    'fiber optic network',
    'public safety equipment',
    'nonprofit security',
  ],
  contractKeywords: [
    'security system',
    'structured cabling',
    'fire alarm',
    'network infrastructure',
    'access control',
    'video surveillance',
    'building renovation',
    'electrical construction',
    'low voltage',
  ],
  digestMinScore: 80,
  digestEnabled: true,
}

// Settings keys (namespaced).
export const KEYS = {
  profile: 'profile.capability',
  states: 'sources.states',
  grantKeywords: 'grants.keywords',
  awardKeywords: 'awards.keywords',
  contractKeywords: 'contracts.keywords',
  digestEnabled: 'digest.enabled',
  digestRecipient: 'digest.recipient',
  digestMinScore: 'digest.min_score',
} as const

async function raw(key: string): Promise<string | null> {
  const row = await prisma.bD_Setting.findUnique({ where: { key } }).catch(() => null)
  return row?.valueEncrypted ?? null
}

/** Read all override rows at once (for the Settings page). */
export async function getAllRaw(): Promise<Record<string, string>> {
  const rows = await prisma.bD_Setting.findMany().catch(() => [])
  return Object.fromEntries(rows.map((r) => [r.key, r.valueEncrypted]))
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.bD_Setting.upsert({
    where: { key },
    update: { valueEncrypted: value },
    create: { key, valueEncrypted: value },
  })
}

export async function clearSetting(key: string): Promise<void> {
  await prisma.bD_Setting.delete({ where: { key } }).catch(() => {})
}

function splitList(v: string): string[] {
  return v
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ── typed getters used by pollers / scorers / digest ─────────────────────────

export async function getCapabilityProfile(): Promise<string> {
  return (await raw(KEYS.profile))?.trim() || PCC2K_PROFILE
}

export async function getTargetStates(): Promise<string[]> {
  const v = await raw(KEYS.states)
  if (!v) return DEFAULTS.targetStates
  const list = splitList(v).map((s) => s.toUpperCase())
  return list.length ? list : DEFAULTS.targetStates
}

export async function getGrantKeywords(): Promise<string[]> {
  const v = await raw(KEYS.grantKeywords)
  if (!v) return DEFAULTS.grantKeywords
  const list = splitList(v)
  return list.length ? list : DEFAULTS.grantKeywords
}

export async function getAwardKeywords(): Promise<string[]> {
  const v = await raw(KEYS.awardKeywords)
  if (!v) return DEFAULTS.awardKeywords
  const list = splitList(v)
  return list.length ? list : DEFAULTS.awardKeywords
}

export async function getContractKeywords(): Promise<string[]> {
  const v = await raw(KEYS.contractKeywords)
  if (!v) return DEFAULTS.contractKeywords
  const list = splitList(v)
  return list.length ? list : DEFAULTS.contractKeywords
}

export interface DigestConfig {
  enabled: boolean
  recipient: string
  minScore: number
}

export async function getDigestConfig(): Promise<DigestConfig> {
  const [enabled, recipient, minScore] = await Promise.all([
    raw(KEYS.digestEnabled),
    raw(KEYS.digestRecipient),
    raw(KEYS.digestMinScore),
  ])
  const n = Number(minScore)
  return {
    enabled: enabled !== 'false',
    recipient: recipient?.trim() || process.env.DIGEST_TO?.trim() || '',
    minScore: Number.isFinite(n) && n > 0 ? n : DEFAULTS.digestMinScore,
  }
}
