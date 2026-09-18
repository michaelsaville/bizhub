// Status pills for the three BizHub enums. Built on one primitive; colors are
// consistent across enums: teal = new/AI-proposed, amber = under review,
// blue/indigo = active pipeline, emerald = success, red = negative, slate = muted.

const PILL_BASE =
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize'

const OPP_STATUS: Record<string, string> = {
  NEW: 'bg-brand-50 text-brand-700',
  REVIEWING: 'bg-amber-50 text-amber-700',
  PURSUING: 'bg-blue-50 text-blue-700',
  SUBMITTED: 'bg-indigo-50 text-indigo-700',
  WON: 'bg-emerald-50 text-emerald-700',
  LOST: 'bg-red-50 text-red-700',
  DECLINED: 'bg-slate-100 text-slate-500',
  EXPIRED: 'bg-slate-100 text-slate-400',
}
export function OppStatusPill({ status }: { status: string }) {
  return (
    <span className={`${PILL_BASE} ${OPP_STATUS[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status.toLowerCase().replace(/_/g, ' ')}
    </span>
  )
}

const GRANT_STATUS: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  UPCOMING: 'bg-amber-50 text-amber-700',
  CLOSED: 'bg-slate-100 text-slate-500',
}
export function GrantStatusPill({ status }: { status: string }) {
  return (
    <span className={`${PILL_BASE} ${GRANT_STATUS[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status.toLowerCase()}
    </span>
  )
}

const MATCH_STATUS: Record<string, string> = {
  SUGGESTED: 'bg-brand-50 text-brand-700',
  REVIEWING: 'bg-amber-50 text-amber-700',
  APPLYING: 'bg-blue-50 text-blue-700',
  SUBMITTED: 'bg-indigo-50 text-indigo-700',
  AWARDED: 'bg-emerald-50 text-emerald-700',
  DECLINED: 'bg-red-50 text-red-700',
  WITHDRAWN: 'bg-slate-100 text-slate-500',
}
export function MatchStatusPill({ status }: { status: string }) {
  return (
    <span className={`${PILL_BASE} ${MATCH_STATUS[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status.toLowerCase()}
    </span>
  )
}

const PROPOSAL_STATUS: Record<string, string> = {
  DRAFT: 'bg-brand-50 text-brand-700',
  REVIEW: 'bg-amber-50 text-amber-700',
  SENT: 'bg-indigo-50 text-indigo-700',
  ACCEPTED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
  WITHDRAWN: 'bg-slate-100 text-slate-500',
}
export function ProposalStatusPill({ status }: { status: string }) {
  return (
    <span className={`${PILL_BASE} ${PROPOSAL_STATUS[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status.toLowerCase()}
    </span>
  )
}
