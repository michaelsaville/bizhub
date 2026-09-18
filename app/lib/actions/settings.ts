'use server'

import { revalidatePath } from 'next/cache'
import { KEYS, setSetting, clearSetting } from '@/app/lib/settings'

// An empty text field clears the override (reverts to the built-in default).
async function put(key: string, value: string) {
  const v = value.trim()
  if (v) await setSetting(key, v)
  else await clearSetting(key)
}

export async function saveSettingsAction(formData: FormData): Promise<void> {
  const s = (name: string) => String(formData.get(name) ?? '')

  await Promise.all([
    put(KEYS.profile, s('profile')),
    put(KEYS.states, s('states')),
    put(KEYS.grantKeywords, s('grantKeywords')),
    put(KEYS.awardKeywords, s('awardKeywords')),
    put(KEYS.contractKeywords, s('contractKeywords')),
    put(KEYS.digestRecipient, s('digestRecipient')),
    put(KEYS.digestMinScore, s('digestMinScore')),
    // Checkbox: present ('on') when enabled, absent when off.
    setSetting(KEYS.digestEnabled, formData.get('digestEnabled') ? 'true' : 'false'),
  ])

  // New config affects scoring/pollers/digest immediately.
  revalidatePath('/settings')
  revalidatePath('/digest')
}
