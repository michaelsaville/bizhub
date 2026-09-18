// USAspending.gov award-search client — PUBLIC and KEYLESS.
//
// Endpoint: POST https://api.usaspending.gov/api/v2/search/spending_by_award/
// Docs:     https://api.usaspending.gov/api/v2/search/spending_by_award/
//
// Finds grants/assistance ALREADY AWARDED to recipients in WV/MD/PA whose
// purpose implies installable infrastructure PCC2K delivers. Keyword filter
// narrows the firehose; AI scoring is the real relevance gate downstream.

const AWARD_URL = 'https://api.usaspending.gov/api/v2/search/spending_by_award/'

// Assistance award types: 02 block, 03 formula, 04 project, 05 cooperative agmt.
export const GRANT_AWARD_TYPES = ['02', '03', '04', '05']
// Procurement (contract) award types: A BPA-call, B purchase order, C delivery
// order, D definitive contract.
export const CONTRACT_AWARD_TYPES = ['A', 'B', 'C', 'D']

export interface UsaAward {
  'Award ID'?: string
  'Recipient Name'?: string
  'Award Amount'?: number
  'Awarding Agency'?: string
  'Award Type'?: string
  'Start Date'?: string
  'End Date'?: string
  Description?: string
  'Place of Performance State Code'?: string
  generated_internal_id?: string
  [k: string]: unknown
}

export interface FetchAwardsParams {
  states: string[]
  keywords: string[]
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  awardTypeCodes?: string[] // defaults to grant/assistance types
  page?: number
  limit?: number
}

export async function fetchAwards(
  p: FetchAwardsParams,
): Promise<{ results: UsaAward[]; hasNext: boolean }> {
  const body = {
    filters: {
      award_type_codes: p.awardTypeCodes ?? GRANT_AWARD_TYPES,
      time_period: [{ start_date: p.startDate, end_date: p.endDate }],
      recipient_locations: p.states.map((s) => ({ country: 'USA', state: s })),
      keywords: p.keywords,
    },
    fields: [
      'Award ID',
      'Recipient Name',
      'Award Amount',
      'Awarding Agency',
      'Award Type',
      'Start Date',
      'End Date',
      'Description',
      'Place of Performance State Code',
      'generated_internal_id',
    ],
    page: p.page ?? 1,
    limit: p.limit ?? 100,
    sort: 'Start Date',
    order: 'desc',
  }

  const res = await fetch(AWARD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(40_000),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`USAspending HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    results?: UsaAward[]
    page_metadata?: { hasNext?: boolean }
  }
  return { results: json.results ?? [], hasNext: Boolean(json.page_metadata?.hasNext) }
}

export function awardUrl(generatedInternalId?: string): string | null {
  return generatedInternalId
    ? `https://www.usaspending.gov/award/${generatedInternalId}`
    : null
}
