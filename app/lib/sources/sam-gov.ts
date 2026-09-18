// SAM.gov Opportunities API v2 client.
//
// Docs:  https://open.gsa.gov/api/get-opportunities-public-api/
// Key:   free — register at https://sam.gov → Sign in → Account Details →
//        "API Key" (Request/Regenerate). Rate limit is per-key/day.
//
// Notes / gotchas baked in here:
//  - `postedFrom` / `postedTo` are REQUIRED and must be MM/dd/yyyy, span ≤ 1yr.
//  - `ncode` filters by NAICS (single code). We loop our target NAICS.
//  - The response's `description` field is a URL to the description text, NOT
//    the text itself — we do not dereference it in this slice.
//  - Contract value is only present on Award notices (`award.amount`); most
//    open solicitations carry no dollar figure, so value is usually null.

const SAM_SEARCH_URL = 'https://api.sam.gov/opportunities/v2/search'

export interface SamOpportunity {
  noticeId: string
  title?: string
  solicitationNumber?: string
  fullParentPathName?: string // agency hierarchy, e.g. "DEPT OF THE ARMY.AMC..."
  postedDate?: string // "yyyy-MM-dd"
  responseDeadLine?: string | null // ISO datetime w/ offset
  type?: string // "Solicitation", "Presolicitation", "Award Notice", ...
  baseType?: string
  naicsCode?: string
  naicsCodes?: string[]
  classificationCode?: string
  typeOfSetAside?: string
  typeOfSetAsideDescription?: string
  active?: string // "Yes" / "No"
  organizationType?: string
  placeOfPerformance?: {
    city?: { code?: string; name?: string }
    state?: { code?: string; name?: string }
    zip?: string
    country?: { code?: string; name?: string }
  } | null
  award?: { amount?: string } | null
  uiLink?: string // human-facing SAM.gov page for this notice
  description?: string // URL to description text (not the text)
  [k: string]: unknown
}

interface SamSearchResponse {
  totalRecords: number
  limit: number
  offset: number
  opportunitiesData?: SamOpportunity[]
}

export interface FetchParams {
  apiKey: string
  postedFrom: string // MM/dd/yyyy
  postedTo: string // MM/dd/yyyy
  naics?: string
  state?: string // two-letter place-of-performance filter
  ptype?: string // procurement type(s)
  limit?: number // max 1000
  offset?: number
}

/** Fetch a single page of the SAM.gov opportunities search. Throws on non-2xx. */
export async function fetchSamPage(p: FetchParams): Promise<SamSearchResponse> {
  const url = new URL(SAM_SEARCH_URL)
  url.searchParams.set('api_key', p.apiKey)
  url.searchParams.set('postedFrom', p.postedFrom)
  url.searchParams.set('postedTo', p.postedTo)
  url.searchParams.set('limit', String(p.limit ?? 100))
  url.searchParams.set('offset', String(p.offset ?? 0))
  if (p.naics) url.searchParams.set('ncode', p.naics)
  if (p.state) url.searchParams.set('state', p.state)
  if (p.ptype) url.searchParams.set('ptype', p.ptype)

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // SAM returns 429 with a descriptive body when the daily key quota is hit;
    // surface the first line so the operator sees "rate limit" vs "bad key".
    throw new Error(`SAM.gov HTTP ${res.status}: ${body.slice(0, 300)}`)
  }
  return (await res.json()) as SamSearchResponse
}

export function placeOfPerformanceState(o: SamOpportunity): string | null {
  return o.placeOfPerformance?.state?.code?.toUpperCase() ?? null
}
