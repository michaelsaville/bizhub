// USAC E-Rate Form 470 client — Socrata SODA API, PUBLIC and KEYLESS.
//
// Dataset: jp7a-89nd ("E-Rate Open Competitive Bidding: Basic Information")
// Docs:    https://dev.socrata.com/docs/queries/
//
// A Form 470 is a school/library/consortium publicly opening COMPETITIVE
// BIDDING for E-Rate services. Category 2 (internal connections: cabling,
// Wi-Fi/WAPs, switches, internal wiring) is PCC2K's install work — Category 1
// is ISP transport (not us). Every record carries a contact name/email/phone,
// so each is a literal lead. `allowable_contract_date` is the earliest the
// applicant may sign — a proxy for the bidding deadline.

const SODA_URL = 'https://opendata.usac.org/resource/jp7a-89nd.json'

export interface Erate470 {
  application_number: string
  form_nickname?: string
  funding_year?: string
  f470_status?: string
  allowable_contract_date?: string
  created_datetime?: string
  billed_entity_name?: string
  billed_entity_city?: string
  billed_entity_state?: string
  billed_entity_zip?: string
  applicant_type?: string
  website_url?: string
  category_one_description?: string
  category_two_description?: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  [k: string]: unknown
}

export interface FetchErateParams {
  states: string[]
  fundingYears: string[]
  cat2Only?: boolean
  limit?: number
  offset?: number
}

/** Fetch a page of Form 470 records via SoQL. Throws on non-2xx. */
export async function fetchErate470s(p: FetchErateParams): Promise<Erate470[]> {
  const states = p.states.map((s) => `'${s}'`).join(',')
  const years = p.fundingYears.map((y) => `'${y}'`).join(',')
  const clauses = [
    `billed_entity_state in(${states})`,
    `funding_year in(${years})`,
  ]
  if (p.cat2Only) clauses.push('category_two_description IS NOT NULL')

  const url = new URL(SODA_URL)
  url.searchParams.set('$where', clauses.join(' AND '))
  url.searchParams.set('$order', 'created_datetime DESC')
  url.searchParams.set('$limit', String(p.limit ?? 200))
  url.searchParams.set('$offset', String(p.offset ?? 0))

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`USAC SODA HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  return (await res.json()) as Erate470[]
}
