'use client'

import { useState } from 'react'
import { saveProposalAction } from '@/app/lib/actions/proposals'

export interface EditorSection {
  heading: string
  body: string
}

export default function ProposalEditor({
  id,
  sections,
}: {
  id: string
  sections: EditorSection[]
}) {
  const [saved, setSaved] = useState(false)

  return (
    <form
      action={async (fd) => {
        await saveProposalAction(fd)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }}
      className="space-y-6"
    >
      <input type="hidden" name="id" value={id} />
      {sections.map((s, i) => (
        <section key={i} className="card border-l-4 border-l-brand-300">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">{s.heading}</h2>
            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-700">
              AI draft
            </span>
          </div>
          <textarea
            name={`section_${i}`}
            defaultValue={s.body}
            rows={Math.max(4, Math.ceil(s.body.length / 90))}
            className="input min-h-[6rem] w-full font-normal leading-relaxed"
          />
        </section>
      ))}
      <div className="sticky bottom-4 flex items-center gap-3">
        <button type="submit" className="btn-primary shadow-lg">
          Save edits
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
      </div>
    </form>
  )
}
