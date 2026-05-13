import { LRUCache } from 'lru-cache'
import { createHash } from 'crypto'
import { resolveIp } from '@/lib/connectors/ipEnrichment'
import { findAccountByDomain, findOpenOpportunity, normaliseDealStage } from '@/lib/connectors/salesforce'
import { classifyIcpTier, industryMap } from '@/lib/config/segments'

export interface VisitorSignal {
  ip: string
  userAgent?: string
  utmSource?: string
  utmCampaign?: string
  sessionId: string
  referrer?: string
  pageUrl?: string
}

export interface AccountContext {
  resolved: boolean
  companyName: string | null
  domain: string | null
  industry: string | null
  icpTier: number | null
  openOpportunity: boolean
  opportunityId: string | null
  opportunityValue: number | null
  dealStage: string | null
  aeOwner: string | null
  salesforceAccountId: string | null
  resolvedAt: number
  latencyMs: number
}

// Layer 1: in-memory LRU, 1000 entries, 5min TTL
const lruCache = new LRUCache<string, AccountContext>({
  max: 1000,
  ttl: 5 * 60 * 1000,
})

/** /24 CIDR normalisation — strip last octet so the cache covers the whole subnet. */
function cacheKey(ip: string): string {
  const subnet = ip.split('.').slice(0, 3).join('.')
  return createHash('md5').update(subnet).digest('hex')
}

/**
 * Agent 01 — Account Resolution.
 * Resolves an inbound visitor IP to a Salesforce account context.
 * Target: <50ms p95. Uses LRU → Redis → live Salesforce query.
 */
export async function resolveAccount(signal: VisitorSignal): Promise<AccountContext> {
  const start = Date.now()
  const key = cacheKey(signal.ip)

  // Layer 1: LRU
  const cached = lruCache.get(key)
  if (cached) return { ...cached, latencyMs: Date.now() - start }

  // Layer 2: Redis (optional)
  const redis = await tryRedisGet(key)
  if (redis) {
    lruCache.set(key, redis)
    return { ...redis, latencyMs: Date.now() - start }
  }

  // Layer 3: live resolution
  const ipData = await resolveIp(signal.ip)
  const domain = ipData.domain

  let context: AccountContext = {
    resolved: false,
    companyName: ipData.companyName,
    domain,
    industry: ipData.industry ? (industryMap[ipData.industry] ?? ipData.industry) : null,
    icpTier: null,
    openOpportunity: false,
    opportunityId: null,
    opportunityValue: null,
    dealStage: null,
    aeOwner: null,
    salesforceAccountId: null,
    resolvedAt: Date.now(),
    latencyMs: 0,
  }

  if (domain) {
    const account = await findAccountByDomain(domain).catch(() => null)
    if (account) {
      context.resolved = true
      context.companyName = account.name
      context.industry = account.industry ? (industryMap[account.industry] ?? account.industry) : context.industry
      context.icpTier = account.icpTier ?? classifyIcpTier(account.annualRevenue, account.numberOfEmployees)
      context.salesforceAccountId = account.id

      const opp = await findOpenOpportunity(account.id).catch(() => null)
      if (opp) {
        context.openOpportunity = true
        context.opportunityId   = opp.id
        context.opportunityValue = opp.amount
        context.dealStage       = normaliseDealStage(opp.stageName)
        context.aeOwner         = opp.aeOwner
      }
    }
  }

  context.latencyMs = Date.now() - start

  // Populate caches
  lruCache.set(key, context)
  await tryRedisSet(key, context, 15 * 60)

  return context
}

// ── Redis helpers (no-op if REDIS_URL not set) ─────────────────────────────

async function tryRedisGet(key: string): Promise<AccountContext | null> {
  if (!process.env.REDIS_URL) return null
  try {
    const { createClient } = await import('redis')
    const client = createClient({ url: process.env.REDIS_URL })
    await client.connect()
    const val = await client.get(`accountlens:${key}`)
    await client.disconnect()
    return val ? JSON.parse(val) : null
  } catch {
    return null
  }
}

async function tryRedisSet(key: string, value: AccountContext, ttlSeconds: number): Promise<void> {
  if (!process.env.REDIS_URL) return
  try {
    const { createClient } = await import('redis')
    const client = createClient({ url: process.env.REDIS_URL })
    await client.connect()
    await client.setEx(`accountlens:${key}`, ttlSeconds, JSON.stringify(value))
    await client.disconnect()
  } catch {
    // non-fatal
  }
}
