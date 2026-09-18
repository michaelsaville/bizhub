// Cross-schema read of the TicketHub client list. BizHub's Postgres role
// ("dochub") backs every PCC2K app on the SAME database, so we can read the
// tickethub schema directly — no API/BFF needed. READ-ONLY: BizHub never
// writes to another app's schema.
//
// NOTE: the table is tickethub.th_clients (snake_case @@map), not "TH_Client".
// clientType in prod is only RESIDENTIAL | BUSINESS, so entity-type (school /
// municipality / housing authority) must be INFERRED from name/tags/notes.

import { prisma } from '@/app/lib/prisma'

export interface TicketHubClient {
  id: string
  name: string
  clientType: string | null
  city: string | null
  state: string | null
  tags: string[]
  notes: string | null
}

interface RawClientRow {
  id: string
  name: string
  clientType: string | null
  billingCity: string | null
  billingState: string | null
  tags: string[] | null
  internalNotes: string | null
}

export async function getTicketHubClients(): Promise<TicketHubClient[]> {
  const rows = await prisma.$queryRawUnsafe<RawClientRow[]>(
    `SELECT id, name, "clientType", "billingCity", "billingState", tags, "internalNotes"
       FROM tickethub.th_clients
      WHERE "isActive" = true
      ORDER BY name ASC`,
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    clientType: r.clientType,
    city: r.billingCity,
    state: r.billingState,
    tags: Array.isArray(r.tags) ? r.tags : [],
    notes: r.internalNotes,
  }))
}
