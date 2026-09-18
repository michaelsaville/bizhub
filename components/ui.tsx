// Shared UI atoms for BizHub. One source of truth for score tiers, deadline
// urgency, money formatting, and the small primitives every screen composes.
// Extends the existing teal design system (globals.css .card/.btn-*, brand-*).

import Link from 'next/link'
import type { ReactNode } from 'react'

// ── money ───────────────────────────────────────────────────────────────────
export function money(cents?: number | null, centsHigh?: number | null): string {
  if (cents == null) return '—'
  const fmt = (c: number) =>
    `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  if (centsHigh != null && centsHigh !== cents) return `${fmt(cents)} – ${fmt(centsHigh)}`
  return fmt(cents)
}

// ── score tiers ───────────────────────────────────────────────────────────��─
export type ScoreTier = 'hot' | 'warm' | 'cool' | 'none'
export function scoreTier(score?: number | null): ScoreTier {
  if (score == null) return 'none'
  if (score >= 80) return 'hot'
  if (score >= 60) return 'warm'
  return 'cool'
}

const SCORE_STYLES: Record<ScoreTier, string> = {
  hot: 'bg-brand-700 text-white ring-1 ring-brand-700',
  warm: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  cool: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  none: 'bg-white text-slate-400 ring-1 ring-slate-200',
}
const SCORE_LABEL: Record<ScoreTier, string> = {
  hot: 'Hot match',
  warm: 'Warm match',
  cool: 'Cool match',
  none: 'Not yet scored',
}

export function ScoreBadge({ score, size = 'sm' }: { score?: number | null; size?: 'sm' | 'lg' }) {
  const tier = scoreTier(score)
  const dims = size === 'lg' ? 'h-12 w-12 text-lg' : 'h-8 w-8 text-xs'
  return (
    <span
      title={SCORE_LABEL[tier]}
      aria-label={`Relevance score ${score ?? 'not scored'} of 100 — ${SCORE_LABEL[tier]}`}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums ${dims} ${SCORE_STYLES[tier]}`}
    >
      {score ?? '—'}
    </span>
  )
}

// ── deadline urgency ──────────────────────────────────────────────────────────
export type Urgency = 'overdue' | 'critical' | 'soon' | 'month' | 'far' | 'none'
export function urgency(date?: Date | null): Urgency {
  if (!date) return 'none'
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000)
  if (days < 0) return 'overdue'
  if (days <= 3) return 'critical'
  if (days <= 7) return 'soon'
  if (days <= 30) return 'month'
  return 'far'
}
export function daysLeft(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000)
}

const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: 'text-slate-400 line-through',
  critical: 'text-red-600 font-semibold',
  soon: 'text-orange-600 font-medium',
  month: 'text-amber-600',
  far: 'text-slate-500',
  none: 'text-slate-400',
}

export function Deadline({ date }: { date?: Date | null }) {
  const u = urgency(date)
  if (!date) return <span className="text-slate-400">No deadline</span>
  const d = daysLeft(date)
  const label =
    u === 'overdue'
      ? 'Closed'
      : d === 0
        ? 'Due today'
        : d === 1
          ? 'Due tomorrow'
          : `${d} days left`
  return (
    <span className={URGENCY_TEXT[u]} title={date.toLocaleDateString()}>
      {u === 'critical' && <span aria-hidden className="mr-1">●</span>}
      {label}
    </span>
  )
}

// ── key/value fact row (detail sidebars) ─────────────────────────────────────
export function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  )
}

// ── stat tile (dashboard) ────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  hint,
  href,
  accent,
}: {
  label: string
  value: number | string
  hint?: string
  href?: string
  accent?: 'brand' | 'red'
}) {
  const numColor = accent === 'red' ? 'text-red-600' : 'text-brand-600'
  const inner = (
    <div className="card transition-shadow hover:shadow-md">
      <div className={`text-3xl font-bold tabular-nums ${numColor}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-600">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}
