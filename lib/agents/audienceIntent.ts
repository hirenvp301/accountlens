import { funnelStageFromPath } from '@/lib/config/segments'
import type { AccountContext } from './accountResolver'

export interface SessionSignals {
  pageUrl: string
  contentConsumed?: string[]
  sessionDepth?: number
  priorVisits?: number
}

export interface AudienceContext {
  persona: string
  funnelStage: string
  intentScore: number
  topicClusters: string[]
  sessionDepth: number
  priorVisits: number
  contentConsumed: string[]
}

/**
 * Agent 02 — Audience & Intent.
 * Classifies buyer persona and funnel stage from URL path + session signals.
 */
export async function classifyAudience(
  account: AccountContext,
  session: SessionSignals
): Promise<AudienceContext> {
  const path = new URL(session.pageUrl, 'https://x').pathname

  // Classify from URL path
  let persona: string = 'practitioner'
  let funnelStage: string = 'awareness'
  for (const rule of funnelStageFromPath) {
    if (rule.pattern.test(path)) {
      funnelStage = rule.stage
      if (rule.persona) persona = rule.persona
      break
    }
  }

  // Promote funnel stage based on deal context
  if (account.dealStage === 'proposal' || account.dealStage === 'evaluation') {
    if (funnelStage === 'awareness') funnelStage = 'consideration'
  }

  // Intent score: heuristic (0-100) — Bombora if key present
  const sessionDepth  = session.sessionDepth  ?? 1
  const priorVisits   = session.priorVisits   ?? 0
  const consumed      = session.contentConsumed ?? [session.pageUrl]
  let intentScore = Math.min(100,
    (sessionDepth * 8) + (priorVisits * 12) +
    (funnelStage === 'late_stage' ? 30 : funnelStage === 'evaluation' ? 20 : 10) +
    (account.openOpportunity ? 20 : 0)
  )

  if (process.env.BOMBORA_API_KEY) {
    const bomboraScore = await fetchBomboraScore(account.domain)
    if (bomboraScore !== null) intentScore = bomboraScore
  }

  // Infer topic clusters from consumed content
  const topicClusters = inferTopics(consumed, account.industry)

  return { persona, funnelStage, intentScore, topicClusters, sessionDepth, priorVisits, contentConsumed: consumed }
}

function inferTopics(consumed: string[], industry: string | null): string[] {
  const clusters = new Set<string>()
  for (const url of consumed) {
    if (/compliance|audit|regulation/i.test(url)) clusters.add('compliance')
    if (/security|soc2|fedramp/i.test(url))       clusters.add('enterprise_security')
    if (/pricing|roi|cost/i.test(url))             clusters.add('roi')
    if (/api|developer|docs/i.test(url))           clusters.add('technical_integration')
    if (/case-stud|customer|success/i.test(url))   clusters.add('social_proof')
  }
  if (industry === 'financial_services') {
    clusters.add('compliance')
    clusters.add('enterprise_security')
  }
  return Array.from(clusters)
}

async function fetchBomboraScore(domain: string | null): Promise<number | null> {
  if (!domain) return null
  try {
    const res = await fetch(
      `https://api.bombora.com/company-surge/v2/companies?domain=${domain}`,
      { headers: { Authorization: `Bearer ${process.env.BOMBORA_API_KEY}` } }
    )
    if (!res.ok) return null
    const data = await res.json() as { score?: number }
    return data.score ?? null
  } catch {
    return null
  }
}
