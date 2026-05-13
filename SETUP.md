# AccountLens — Project Setup Guide

> Zero-flicker B2B website personalization. Resolves every inbound visitor to a Salesforce account in real time and injects account-aware content inside the Sitecore SSR pipeline.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Auth + DB | Supabase (PostgreSQL + RLS + Realtime) |
| Background pipeline | Inngest v3 |
| AI content generation | Anthropic Claude (claude-sonnet-4-6) |
| CRM | Salesforce (jsforce) |
| CMS | Sitecore XM Cloud or XM/XP 10.x |
| IP enrichment | Clearbit / 6sense |
| Hosting | Vercel |
| Styling | Tailwind CSS v4, Inter + Playfair Display |

---

## Project Structure

```
accountlens/
├── app/
│   ├── page.tsx                          # Landing page
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx                    # Auth guard
│   │   ├── page.tsx                      # Pipeline dashboard
│   │   └── sessions/[id]/page.tsx        # Session detail
│   ├── settings/page.tsx                 # Connector config reference
│   └── api/
│       ├── resolve/route.ts              # POST: trigger pipeline
│       ├── inngest/route.ts              # Inngest webhook
│       └── auth/callback/route.ts
├── components/
│   └── AppShell.tsx                      # Left sidebar nav
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # Browser client
│   │   ├── server.ts                     # Server + service client
│   │   └── schema.sql                    # Run in Supabase SQL editor
│   ├── inngest/
│   │   ├── client.ts                     # Inngest singleton
│   │   └── pipeline.ts                   # 4-agent pipeline function
│   ├── agents/
│   │   ├── accountResolver.ts            # Agent 01: IP → Salesforce
│   │   ├── audienceIntent.ts             # Agent 02: persona + funnel stage
│   │   ├── contentDecision.ts            # Agent 03: variant scoring + Claude
│   │   ├── deliveryAgent.ts              # Agent 04: holdout + measurement
│   │   └── aeBrief.ts                    # AE pre-call brief (Slack)
│   ├── connectors/
│   │   ├── sitecore.ts                   # XM Cloud + XM/XP variant fetch
│   │   ├── salesforce.ts                 # SOQL: account + opportunity
│   │   └── ipEnrichment.ts              # Clearbit → 6sense → timeout
│   └── config/
│       ├── segments.ts                   # ICP tiers, industry map, funnel rules
│       └── brandGuidelines.ts            # Claude content constraints
```

---

## Services Required

### 1. Supabase

- Sign up at https://supabase.com
- Create a new project
- Go to **SQL Editor** → run the full contents of `lib/supabase/schema.sql`
- Go to **Authentication → Providers** → enable Email
- Go to **Project Settings → API** → copy:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (Service Role section — keep secret)

---

### 2. Inngest

- Sign up at https://inngest.com
- Create a new app
- Go to **Keys** → copy `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`
- After deploying to Vercel, go to Inngest → **Apps → Sync** → paste `https://your-app.vercel.app/api/inngest`

---

### 3. Anthropic

- Get API key at https://console.anthropic.com
- Used for: Agent 03 content generation when no authored Sitecore variant scores ≥ 70

---

### 4. Salesforce

- Create a Connected App with OAuth2
- Required custom field on Account: `AccountLens_ICP_Tier__c` (Number 1-3)
- If field doesn't exist, tier is inferred from AnnualRevenue + NumberOfEmployees

---

### 5. Sitecore

**Before connecting, confirm with design partner:**
- [ ] Sitecore version (XM Cloud / XP 10.x / XM)
- [ ] Rendering host type (Next.js / .NET MVC)
- [ ] Personalisation content template — field names
- [ ] Parent path for variant content items
- [ ] API credentials

**XM Cloud:** OAuth2 client credentials (`SITECORE_CLIENT_ID`, `SITECORE_CLIENT_SECRET`, `SITECORE_AUDIENCE`)

**XM/XP:** API key (`SITECORE_API_KEY`, `SITECORE_DATABASE`)

---

### 6. IP Enrichment

- **Primary:** Clearbit Reveal API (`CLEARBIT_API_KEY`)
- **Fallback:** 6sense (`SIXSENSE_API_KEY`, optional)
- Hard 40ms timeout — never blocks page render

---

## Environment Variables

Create `.env.local` in the project root (never commit):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Inngest
INNGEST_EVENT_KEY=evt_...
INNGEST_SIGNING_KEY=signkey-...

# Sitecore
SITECORE_VERSION=xmcloud
SITECORE_CM_URL=https://tenant.sitecorecloud.io
SITECORE_PARENT_PATH=/sitecore/content/Site/Personalization
SITECORE_CLIENT_ID=...
SITECORE_CLIENT_SECRET=...
SITECORE_AUDIENCE=https://api.sitecorecloud.io

# Salesforce
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_USERNAME=api-user@yourcompany.com
SALESFORCE_PASSWORD=passwordPlusToken

# IP Enrichment
CLEARBIT_API_KEY=sk_...

# Claude
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6

# Pipeline
HOLDOUT_PERCENTAGE=20
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

On Vercel: add under **Project Settings → Environment Variables**.

---

## Running Locally

```bash
# Install dependencies
npm install

# Start Next.js dev server
npm run dev

# In a second terminal: start Inngest dev server
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Then open http://localhost:3000

---

## Deploying to Vercel

```bash
npm i -g vercel
vercel --prod
```

Or connect your GitHub repo to Vercel for auto-deploys.

**After deploying:**
1. Add all env vars in Vercel → Project Settings → Environment Variables
2. Disable **Vercel Authentication** (Settings → Security) so Inngest can reach the webhook
3. Sync Inngest: https://app.inngest.com → Apps → Sync App → `https://your-app.vercel.app/api/inngest`

---

## How the Pipeline Works

```
POST /api/resolve   ←  Sitecore middleware or direct call
       ↓
  Inngest event: accountlens/visitor.arrived
       ↓
  Step 1: resolveAccount   (IP → Clearbit → Salesforce SOQL)
  Step 2: classifyAudience (URL path → persona + funnel stage)
  Step 3: decideContent    (score Sitecore variants → Claude if <70)
  Step 4: deliver          (holdout group → impression event → AE brief)
       ↓
  Supabase: sessions table updated at each step (Realtime)
       ↓
  Dashboard shows live progress
```

**Latency:** Account resolution targets <50ms p95 via LRU → Redis → live Salesforce.
**Holdout:** 20% of sessions deterministically assigned to control group (CRC-32 of sessionId).
**AE Brief:** Fires on Slack when `dealStage === 'proposal' || 'evaluation'`, deduped per account per 24h.

---

## Key Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Pipeline runtime | Inngest | Step retries, durable execution, Vercel-native |
| Event storage | Supabase | Realtime dashboard, RLS, no infra to manage |
| IP enrichment timeout | 40ms | Never block page render |
| Holdout assignment | MD5(sessionId + experimentId) % 100 | Deterministic, no storage |
| Variant threshold | Score ≥ 70 | Below this, generated variants outperform |
| Content model | Claude claude-sonnet-4-6 | Instruction-following at nuance level required |

---

## Color / Brand

- Primary green: `#1D9E75`
- Hover: `#178a63`
- Mint tint (backgrounds): `#e6f5ef`
- Accent border: `#a8dfc9`
- Headings: Playfair Display (serif)
- Body: Inter (sans-serif)

---

## GitHub

```
https://github.com/hirenvp301/accountlens
```

```bash
git add -A
git commit -m "your message"
git push origin main
```

---

## Contact

**Hiren Patel** — Founder, flowmatos
hiren@flowmatos.com | flowmatos.com | github.com/hirenvp301
