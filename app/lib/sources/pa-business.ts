// PA Dept. of State new-business registrations — Socrata SODA, PUBLIC/KEYLESS.
//
// Dataset: xvd7-5r2c on data.pa.gov ("Registered Businesses in PA").
// One row PER officer/party on a filing, so callers dedup by filing_number.
// County is Title-Case; filter with upper(). A newly-registered business is a
// greenfield MSP prospect (needs network, cameras, phones, IT).

const SODA_URL = 'https://data.pa.gov/resource/xvd7-5r2c.json'

export interface PaBusinessRow {
  filing_number?: string
  business_name?: string
  typeofbusinessregistration?: string
  shortcountyname?: string
  city?: string
  creationdate?: string
  [k: string]: unknown
}

export interface FetchPaBusinessParams {
  counties: string[] // matched case-insensitively
  entityTypesLike: string[] // substrings (e.g. "Limited Liability", "Business Corporation")
  since: string // YYYY-MM-DD
  limit?: number
  offset?: number
}

export async function fetchPaBusinesses(p: FetchPaBusinessParams): Promise<PaBusinessRow[]> {
  const counties = p.counties.map((c) => `'${c.toUpperCase()}'`).join(',')
  const typeClause = p.entityTypesLike
    .map((t) => `typeofbusinessregistration like '%${t}%'`)
    .join(' OR ')
  const where = [
    `upper(shortcountyname) in(${counties})`,
    `creationdate > '${p.since}'`,
    `(${typeClause})`,
  ].join(' AND ')

  const url = new URL(SODA_URL)
  url.searchParams.set(
    '$select',
    'filing_number,business_name,typeofbusinessregistration,shortcountyname,city,creationdate',
  )
  url.searchParams.set('$where', where)
  url.searchParams.set('$order', 'creationdate DESC')
  url.searchParams.set('$limit', String(p.limit ?? 500))
  url.searchParams.set('$offset', String(p.offset ?? 0))

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PA SODA HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  return (await res.json()) as PaBusinessRow[]
}
