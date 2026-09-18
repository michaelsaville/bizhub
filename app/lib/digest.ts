// Weekly lead digest. Aggregates leads that became "hot" since the last digest
// (or the last 7 days on first run) across all three sources + new client
// matches, renders an HTML email, and sends it via Resend. The "last sent"
// watermark advances ONLY on a successful send, so nothing is ever skipped
// while email delivery is still pending domain verification.

import { prisma } from '@/app/lib/prisma'
import { sendEmail, mailConfigured, type SendResult } from '@/app/lib/mail'
import { getDigestConfig } from '@/app/lib/settings'

const WATERMARK_KEY = 'digest.last_sent_at'
const APP_URL = 'https://bizhub.pcc2k.com'

export interface DigestItem {
  kind: 'grant' | 'bid' | 'award'
  href: string
  score: number
  title: string
  subtitle: string
  note: string | null
}

export interface DigestData {
  since: Date
  min: number
  grants: DigestItem[]
  bids: DigestItem[]
  awards: DigestItem[]
  newMatches: { client: string; grant: string; score: number }[]
  total: number
}

export async function getLastDigestAt(): Promise<Date | null> {
  const row = await prisma.bD_Setting.findUnique({ where: { key: WATERMARK_KEY } })
  if (!row) return null
  const d = new Date(row.valueEncrypted)
  return Number.isNaN(d.getTime()) ? null : d
}

async function setLastDigestAt(when: Date): Promise<void> {
  await prisma.bD_Setting.upsert({
    where: { key: WATERMARK_KEY },
    update: { valueEncrypted: when.toISOString() },
    create: { key: WATERMARK_KEY, valueEncrypted: when.toISOString() },
  })
}

export async function buildDigest(since?: Date): Promise<DigestData> {
  const { minScore: min } = await getDigestConfig()
  const sinceDate = since ?? (await getLastDigestAt()) ?? new Date(Date.now() - 7 * 86_400_000)

  const [grants, bids, awards, matches] = await Promise.all([
    prisma.bD_GrantProgram.findMany({
      where: { dismissedAt: null, relevanceScore: { gte: min }, scoredAt: { gt: sinceDate } },
      orderBy: { relevanceScore: 'desc' },
      take: 25,
    }),
    prisma.bD_BidOpportunity.findMany({
      where: { dismissedAt: null, matchScore: { gte: min }, scoredAt: { gt: sinceDate } },
      orderBy: { matchScore: 'desc' },
      take: 25,
    }),
    prisma.bD_FundedAward.findMany({
      where: { dismissedAt: null, relevanceScore: { gte: min }, scoredAt: { gt: sinceDate } },
      orderBy: { relevanceScore: 'desc' },
      take: 25,
    }),
    prisma.bD_ClientGrantMatch.findMany({
      where: { status: 'SUGGESTED', createdAt: { gt: sinceDate } },
      orderBy: { matchScore: 'desc' },
      take: 15,
      include: { grant: { select: { name: true } } },
    }),
  ])

  const grantItems: DigestItem[] = grants.map((g) => ({
    kind: 'grant',
    href: `${APP_URL}/grants/${g.id}`,
    score: g.relevanceScore ?? 0,
    title: g.name,
    subtitle: g.agency,
    note: g.relevanceNotes,
  }))
  const bidItems: DigestItem[] = bids.map((b) => ({
    kind: 'bid',
    href: `${APP_URL}/opportunities/${b.id}`,
    score: b.matchScore ?? 0,
    title: b.title,
    subtitle: [b.agency, b.state].filter(Boolean).join(' · '),
    note: b.matchNotes,
  }))
  const awardItems: DigestItem[] = awards.map((a) => ({
    kind: 'award',
    href: `${APP_URL}/awards/${a.id}`,
    score: a.relevanceScore ?? 0,
    title: a.recipientName,
    subtitle: [a.awardingAgency, a.recipientState].filter(Boolean).join(' · '),
    note: a.relevanceNotes,
  }))

  return {
    since: sinceDate,
    min,
    grants: grantItems,
    bids: bidItems,
    awards: awardItems,
    newMatches: matches.map((m) => ({
      client: m.clientNameCached,
      grant: m.grant.name,
      score: m.matchScore,
    })),
    total: grantItems.length + bidItems.length + awardItems.length + matches.length,
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

function section(title: string, items: DigestItem[]): string {
  if (items.length === 0) return ''
  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 12px;vertical-align:top;border-bottom:1px solid #f1f5f9;">
          <span style="display:inline-block;min-width:34px;text-align:center;background:#0f766e;color:#fff;border-radius:999px;font-size:12px;font-weight:700;padding:3px 0;">${it.score}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
          <a href="${esc(it.href)}" style="color:#0f172a;font-weight:600;text-decoration:none;font-size:14px;">${esc(it.title)}</a>
          <div style="color:#64748b;font-size:12px;margin-top:2px;">${esc(it.subtitle || '')}</div>
          ${it.note ? `<div style="color:#94a3b8;font-size:12px;margin-top:3px;">${esc(it.note)}</div>` : ''}
        </td>
      </tr>`,
    )
    .join('')
  return `
    <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#0f766e;margin:24px 0 6px;">${esc(title)} (${items.length})</h2>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">${rows}</table>`
}

export function renderDigestHtml(d: DigestData): string {
  const matchesBlock = d.newMatches.length
    ? `<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#0f766e;margin:24px 0 6px;">New client matches (${d.newMatches.length})</h2>
       <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
       ${d.newMatches
         .map(
           (m) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;">
             <b>${esc(m.client)}</b> &rarr; ${esc(m.grant)}
             <span style="color:#64748b;font-size:12px;"> · score ${m.score}</span></td></tr>`,
         )
         .join('')}</table>`
    : ''

  const body =
    d.total === 0
      ? `<p style="color:#64748b;font-size:14px;">No new hot leads since ${d.since.toLocaleDateString()}. All quiet.</p>`
      : section('New grants', d.grants) +
        section('New bid leads', d.bids) +
        section('New funded buyers', d.awards) +
        matchesBlock

  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
      <div style="margin-bottom:8px;">
        <span style="font-size:20px;font-weight:800;color:#0f766e;">BizHub</span>
        <span style="color:#64748b;font-size:14px;"> · Weekly lead digest</span>
      </div>
      <p style="color:#64748b;font-size:13px;margin:0 0 4px;">
        ${d.total} new lead${d.total === 1 ? '' : 's'} scoring ${d.min}+ since ${d.since.toLocaleDateString()}.
      </p>
      ${body}
      <p style="margin-top:28px;">
        <a href="${APP_URL}" style="background:#0d9488;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">Open BizHub</a>
      </p>
      <p style="color:#94a3b8;font-size:11px;margin-top:24px;">You're receiving this because BizHub digests are enabled. Sources: Grants.gov, USAC E-Rate, USAspending.</p>
    </div></body></html>`
}

export interface DigestSendResult {
  built: DigestData
  sent: SendResult
  advancedWatermark: boolean
}

/** Build the pending digest and send it. Advances the watermark only on success. */
export async function sendDigest(opts?: { force?: boolean }): Promise<DigestSendResult> {
  const data = await buildDigest()
  const cfg = await getDigestConfig()

  if (!cfg.enabled && !opts?.force) {
    return { built: data, sent: { ok: false, skipped: true, error: 'digest disabled in settings' }, advancedWatermark: false }
  }
  if (data.total === 0 && !opts?.force) {
    return { built: data, sent: { ok: false, skipped: true, error: 'no new leads' }, advancedWatermark: false }
  }
  if (!mailConfigured()) {
    return { built: data, sent: { ok: false, skipped: true, error: 'RESEND_API_KEY not set' }, advancedWatermark: false }
  }

  const to = cfg.recipient
  if (!to) {
    return { built: data, sent: { ok: false, skipped: true, error: 'digest recipient not set' }, advancedWatermark: false }
  }

  const subject = `BizHub: ${data.total} new lead${data.total === 1 ? '' : 's'} (${data.min}+)`
  const sent = await sendEmail({ to, subject, html: renderDigestHtml(data) })

  let advanced = false
  if (sent.ok) {
    await setLastDigestAt(new Date())
    advanced = true
  }
  return { built: data, sent, advancedWatermark: advanced }
}
