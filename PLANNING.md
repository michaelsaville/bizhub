# BizHub — Planning & Roadmap

> Pre-build decisions captured here so future Michael + future Claude don't
> re-litigate. Mirror of the architecture notes we pinned in memory.

## What this is

Three connected capabilities inside one admin tool:

1. **Bid / RFP scanner** — nightly poll of SAM.gov, state procurement portals,
   and construction bid boards. Surfaces opportunities matching PCC2K's
   capabilities (low voltage, cabling, cameras, networking, IT).
2. **Government grant matcher** — cross-references Grants.gov / USDA RD /
   HUD / FEMA / USAC E-Rate / state DED programs against the client list,
   flags eligible clients with deadlines.
3. **Proposal generator** — on a bid hit or grant match, assembles a draft
   proposal with client context (DocHub), equipment specs (Amazon PA-API
   cache reused from TicketHub), and labor from TicketHub's rate card.
   Output: PDF + a `TH_Estimate` draft POSTed into TicketHub.

## Why a separate app

Decided vs. making it a TicketHub module because:

- **Domain drift.** TicketHub is MSP ops — tickets, SLA, billing, dispatch.
  BizHub is sales-side — bids, grants, proposals. Different personas.
- **Iteration speed.** BizHub will be experimental and prompt-heavy. You
  don't want TicketHub's stability tied to its churn.
- **Multi-tenancy potential.** A bizdev engine could eventually serve other
  MSPs or be commercialized. TicketHub is PCC2K-specific.
- **Schema cleanliness.** `bizdev` schema on the shared Postgres keeps the
  models isolated and lets `prisma db push` stay safe.

## Integration contract with sister apps

### BizHub reads from…

- **DocHub** — client list, site details, existing asset inventory, entity
  type (housing authority, municipality, school, private business) — needed
  for grant eligibility matching.
- **TicketHub** — client contract terms, labor rate cards, Amazon PA-API
  product cache (`TH_AmazonPriceCache`), historical charge/labor patterns
  for similar work.

Initial approach: direct SQL reads via cross-schema queries (same Postgres).
Later: REST reads via signed inter-app tokens if we want to harden.

### BizHub writes to…

- **TicketHub** — when a proposal is approved, POST a draft `TH_Estimate`
  with line items already populated. TicketHub's existing estimate-reminder
  flow takes over from there.
- **DocHub** — on a won bid / awarded grant, create a project record or
  tag the client with the win so it shows up in account context.

No authoritative writes from BizHub back into operational data — it's a
proposer, not an executor.

## Phase plan

### Phase 0 — Framework ✅
Auth, schema, Docker, dashboard, empty list. **You are here.**

### Phase 1 — Bid ingest
- [ ] SAM.gov API key + Free registration
- [ ] `/api/cron/poll-sam-gov` nightly cron (external invoker, Bearer token)
- [ ] Upsert into `BD_BidOpportunity` (idempotent by `source + externalId`)
- [ ] Simple filter: WV/MD/PA + NAICS in target list
- [ ] Raw opportunity appears on `/opportunities`

### Phase 2 — Grant ingest
- [ ] Grants.gov API registration
- [ ] USDA RD + HUD + FEMA + E-Rate curated seed list (admin-maintained)
- [ ] `BD_GrantProgram` populated
- [ ] `/grants` list page

### Phase 3 — Matching (AI)
- [ ] Scoring pass: for each opportunity, score match against capabilities
- [ ] For each grant, cross-reference DocHub clients; create `BD_ClientGrantMatch`
- [ ] Surface matches on dashboard ("3 new client-grant matches this week")
- [ ] Notifications (email or ntfy — reuse TicketHub's ntfy instance)

### Phase 4 — Proposal generation
- [ ] `BD_Proposal` model + PDF generation (react-pdf, like TicketHub invoices)
- [ ] AI drafting for narrative sections (project description, need statement,
      budget justification)
- [ ] Line-item assembly from Amazon PA-API cache + TicketHub rate card
- [ ] Admin-review UI before sending
- [ ] Approved proposal pushes a draft `TH_Estimate` into TicketHub

### Phase 5 — Polish
- [ ] Application deadline tracking + follow-up reminders
- [ ] Win/loss recording + feedback loop into matching weights
- [ ] Compliance-notes AI (prevailing wage, Buy American, reporting cadence)
- [ ] Client-facing proposal portal (read-only proposal view link)

## Example scenario

USDA announces $50K rural-housing security-camera grants in WV. BizHub:

1. Detects on grants.gov overnight
2. Cross-references DocHub clients → matches Romney HA + Keyser HA
3. Pulls 4MP turret specs from TH Amazon cache ($89 cost, $149 marked up)
4. Pulls labor estimate from TicketHub rate card (16 hrs × $95/hr)
5. Generates proposal PDFs for each client: 8-camera system, $2,792 equipment
   + $1,520 labor = $4,312
6. Drafts grant application narrative
7. Notifies Michael: "Grant opportunity matched 2 clients — proposals ready
   for review"
8. On approval: POSTs draft `TH_Estimate`, TicketHub reminder system handles
   follow-up

## Data sources shortlist (authoritative)

### Bids
- **SAM.gov** (free API) — federal + many state/local
- **wvpurchasing.gov** — WV state
- **eMarylandMarketplace** — MD state
- **PA eMarketplace**
- **Dodge / SmartBid / BuildingConnected** — commercial construction (paid)
- **Retail vendor portals** — Dollar General, Family Dollar rollouts

### Grants
- **Grants.gov** (free API)
- **USDA Rural Development**
- **HUD programs**
- **FEMA Homeland Security Grants**
- **USAC E-Rate** (schools + libraries)
- **State DEDs** — WV, MD, PA
- **Utility rebate programs**

## Not doing (explicit no's)

- Not building a CRM — that lives in TicketHub
- Not billing customers directly — invoices stay in TicketHub
- Not syncing Amazon PA-API independently — reuse TicketHub's cache
- Not building an end-customer portal in V1 — admin-only
