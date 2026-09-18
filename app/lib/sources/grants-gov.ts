// Grants.gov Search2 API client — PUBLIC and KEYLESS (no registration).
//
// Endpoint: POST https://api.grants.gov/v1/api/search2
// Docs:     https://www.grants.gov/api/api-guide  ("Search2")
//
// The search hit is a summary record (no long description body). For a full
// synopsis you'd call fetchOpportunity separately — not done in this slice.

const GRANTS_SEARCH_URL = 'https://api.grants.gov/v1/api/search2'

export interface GrantHit {
  id: string
  number?: string
  title?: string
  agencyCode?: string
  agency?: string
  openDate?: string // MM/DD/YYYY
  closeDate?: string // MM/DD/YYYY or ""
  oppStatus?: string // posted | forecasted | closed | archived
  docType?: string
  cfdaList?: string[]
}

interface GrantsSearchResponse {
  errorcode: number
  msg?: string
  data?: { hitCount?: number; startRecord?: number; oppHits?: GrantHit[] }
}

export interface GrantsFetchParams {
  keyword: string
  oppStatuses?: string // pipe-delimited; default "posted|forecasted"
  rows?: number
  startRecordNum?: number
}

/** Fetch one page of grant search results. Throws on transport or API error. */
export async function fetchGrantsPage(
  p: GrantsFetchParams,
): Promise<{ hitCount: number; hits: GrantHit[] }> {
  const res = await fetch(GRANTS_SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      keyword: p.keyword,
      oppStatuses: p.oppStatuses ?? 'posted|forecasted',
      rows: p.rows ?? 50,
      startRecordNum: p.startRecordNum ?? 0,
    }),
    signal: AbortSignal.timeout(30_000),
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Grants.gov HTTP ${res.status}: ${body.slice(0, 300)}`)
  }

  const json = (await res.json()) as GrantsSearchResponse
  if (json.errorcode !== 0) {
    throw new Error(`Grants.gov error ${json.errorcode}: ${json.msg ?? 'unknown'}`)
  }
  return { hitCount: json.data?.hitCount ?? 0, hits: json.data?.oppHits ?? [] }
}

/** Map Grants.gov oppStatus onto our BD_GrantStatus enum. */
export function grantStatus(oppStatus?: string): 'ACTIVE' | 'UPCOMING' | 'CLOSED' {
  switch ((oppStatus ?? '').toLowerCase()) {
    case 'posted':
      return 'ACTIVE'
    case 'forecasted':
      return 'UPCOMING'
    default:
      return 'CLOSED'
  }
}

export function grantDetailUrl(id: string): string {
  return `https://www.grants.gov/search-results-detail/${id}`
}
