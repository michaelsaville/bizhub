import TopBar from '@/components/TopBar'
import {
  getCapabilityProfile,
  getTargetStates,
  getGrantKeywords,
  getAwardKeywords,
  getContractKeywords,
  getDigestConfig,
  getAllRaw,
  KEYS,
} from '@/app/lib/settings'
import { saveSettingsAction } from '@/app/lib/actions/settings'

export const dynamic = 'force-dynamic'

function Overridden({ on }: { on: boolean }) {
  return (
    <span
      className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        on ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'
      }`}
    >
      {on ? 'custom' : 'default'}
    </span>
  )
}

export default async function SettingsPage() {
  const [profile, states, grantKw, awardKw, contractKw, digest, raw] = await Promise.all([
    getCapabilityProfile(),
    getTargetStates(),
    getGrantKeywords(),
    getAwardKeywords(),
    getContractKeywords(),
    getDigestConfig(),
    getAllRaw(),
  ])

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tune what BizHub ingests and how the AI scores it — takes effect on the
            next poll/score, no rebuild. Clear a field to revert to its default.
          </p>
        </div>

        <form action={saveSettingsAction} className="space-y-6">
          {/* Capability profile */}
          <section className="card">
            <h2 className="text-base font-semibold text-slate-900">
              AI capability profile
              <Overridden on={!!raw[KEYS.profile]} />
            </h2>
            <p className="mb-2 mt-1 text-xs text-slate-500">
              The description of PCC2K fed into every relevance-scoring, matching, and
              proposal prompt. This is the single biggest lever on what scores as “hot.”
            </p>
            <textarea
              name="profile"
              defaultValue={profile}
              rows={12}
              className="input w-full font-mono text-xs leading-relaxed"
            />
          </section>

          {/* Sources */}
          <section className="card">
            <h2 className="text-base font-semibold text-slate-900">Lead sources</h2>
            <div className="mt-3 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Target states <Overridden on={!!raw[KEYS.states]} />
                </label>
                <p className="mb-1 text-xs text-slate-500">
                  Two-letter codes, comma-separated. Applies to E-Rate + award-watch.
                </p>
                <input name="states" defaultValue={states.join(', ')} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Grant keywords <Overridden on={!!raw[KEYS.grantKeywords]} />
                </label>
                <p className="mb-1 text-xs text-slate-500">One per line — searched on Grants.gov.</p>
                <textarea name="grantKeywords" defaultValue={grantKw.join('\n')} rows={5} className="input w-full text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Award-watch keywords <Overridden on={!!raw[KEYS.awardKeywords]} />
                </label>
                <p className="mb-1 text-xs text-slate-500">One per line — searched on USAspending grant awards (buyers).</p>
                <textarea name="awardKeywords" defaultValue={awardKw.join('\n')} rows={5} className="input w-full text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Contract-watch keywords <Overridden on={!!raw[KEYS.contractKeywords]} />
                </label>
                <p className="mb-1 text-xs text-slate-500">One per line — searched on USAspending contract awards (subs/partners).</p>
                <textarea name="contractKeywords" defaultValue={contractKw.join('\n')} rows={5} className="input w-full text-sm" />
              </div>
            </div>
          </section>

          {/* Digest */}
          <section className="card">
            <h2 className="text-base font-semibold text-slate-900">Weekly digest</h2>
            <div className="mt-3 space-y-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="digestEnabled" defaultChecked={digest.enabled} className="h-4 w-4" />
                Send the weekly digest email
              </label>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Recipient <Overridden on={!!raw[KEYS.digestRecipient]} />
                </label>
                <input name="digestRecipient" type="email" defaultValue={digest.recipient} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Minimum score to include <Overridden on={!!raw[KEYS.digestMinScore]} />
                </label>
                <p className="mb-1 text-xs text-slate-500">Only leads scoring at or above this land in the digest.</p>
                <input name="digestMinScore" type="number" min={0} max={100} defaultValue={digest.minScore} className="input w-32" />
              </div>
            </div>
          </section>

          <div className="sticky bottom-4 flex justify-end">
            <button type="submit" className="btn-primary shadow-lg">
              Save settings
            </button>
          </div>
        </form>
      </main>
    </>
  )
}
