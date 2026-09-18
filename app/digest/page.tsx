import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { buildDigest, getLastDigestAt, type DigestItem } from '@/app/lib/digest'
import { mailConfigured } from '@/app/lib/mail'
import { ScoreBadge } from '@/components/ui'
import DigestSendButton from './DigestSendButton'

export const dynamic = 'force-dynamic'

function Group({ title, items }: { title: string; items: DigestItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-700">
        {title} ({items.length})
      </h2>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <ScoreBadge score={it.score} />
            <div className="min-w-0 flex-1">
              <Link href={it.href} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                {it.title}
              </Link>
              <div className="truncate text-xs text-slate-500">{it.subtitle}</div>
              {it.note && <div className="truncate text-xs text-slate-400">{it.note}</div>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default async function DigestPage() {
  const [digest, lastSent] = await Promise.all([buildDigest(), getLastDigestAt()])
  const configured = mailConfigured()
  const to = process.env.DIGEST_TO ?? '(not set)'
  const from = process.env.DIGEST_FROM ?? '(default)'

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Weekly digest</h1>
            <p className="mt-1 text-sm text-slate-600">
              Hot leads (score {digest.min}+) that surfaced since your last digest —
              emailed weekly so you don&apos;t have to check.
            </p>
          </div>
          <DigestSendButton />
        </div>

        {/* Status */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="card">
            <div className="text-xs uppercase tracking-wide text-slate-400">Recipient</div>
            <div className="mt-1 truncate text-sm font-medium text-slate-800">{to}</div>
          </div>
          <div className="card">
            <div className="text-xs uppercase tracking-wide text-slate-400">Last sent</div>
            <div className="mt-1 text-sm font-medium text-slate-800">
              {lastSent ? lastSent.toLocaleString() : 'Never (showing last 7 days)'}
            </div>
          </div>
          <div className="card">
            <div className="text-xs uppercase tracking-wide text-slate-400">Email delivery</div>
            <div className="mt-1 text-sm font-medium text-slate-800">
              {configured ? 'Key set' : 'No key'}
            </div>
          </div>
        </div>

        {!configured ? (
          <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No Resend key configured — the preview below works, but nothing will send.
          </div>
        ) : (
          <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Delivery requires the <code>{from}</code> domain to be verified in Resend
            (add the DNS records in the Resend dashboard). Until then, “Send digest now”
            will report a “domain not verified” error — the preview is fully live.
          </div>
        )}

        {/* Preview */}
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Pending digest — {digest.total} lead{digest.total === 1 ? '' : 's'}
        </h2>
        {digest.total === 0 ? (
          <div className="card py-12 text-center text-sm text-slate-400">
            No new hot leads since {digest.since.toLocaleDateString()}. All quiet.
          </div>
        ) : (
          <>
            <Group title="New grants" items={digest.grants} />
            <Group title="New bid leads" items={digest.bids} />
            <Group title="New funded buyers" items={digest.awards} />
            {digest.newMatches.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-700">
                  New client matches ({digest.newMatches.length})
                </h2>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {digest.newMatches.map((m, i) => (
                    <li key={i} className="px-4 py-3 text-sm text-slate-800">
                      <b>{m.client}</b> → {m.grant}{' '}
                      <span className="text-xs text-slate-500">· score {m.score}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </>
  )
}
