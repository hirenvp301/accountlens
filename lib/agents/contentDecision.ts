import Anthropic from '@anthropic-ai/sdk'
import { fetchVariants } from '@/lib/connectors/sitecore'
import { brandGuidelines } from '@/lib/config/brandGuidelines'
import type { AccountContext } from './accountResolver'
import type { AudienceContext } from './audienceIntent'

export interface ContentPayload {
  source: 'authored' | 'generated' | 'default'
  variantId: string | null
  confidence: number
  hero: { headline: string; subheadline: string; ctaText: string; ctaUrl: string }
  socialProof: { logos: string[]; featuredCaseStudy: string | null }
  productMessaging: { featureEmphasis: string[]; messagingAngle: string }
  resources: Array<{ title: string; url: string }>
  trustSignals: string[]
  generatedAt: number
}

const DEFAULT_PAYLOAD: ContentPayload = {
  source: 'default', variantId: null, confidence: 0,
  hero: { headline: 'Enterprise personalization, delivered', subheadline: 'The right message for every account, at server render time.', ctaText: 'See how it works', ctaUrl: '/demo' },
  socialProof: { logos: [], featuredCaseStudy: null },
  productMessaging: { featureEmphasis: ['personalization', 'analytics'], messagingAngle: 'efficiency' },
  resources: [],
  trustSignals: [],
  generatedAt: Date.now(),
}

/**
 * Agent 03 — Content Decision.
 * Scores authored Sitecore variants; generates via Claude if no match ≥ 70.
 */
export async function decideContent(
  account: AccountContext,
  audience: AudienceContext
): Promise<ContentPayload> {
  const variants = await fetchVariants().catch(() => [])

  let bestScore = 0
  let bestVariant = null

  for (const v of variants) {
    let score = 0
    if (v.industry    && v.industry    === account.industry)    score += 35
    if (v.funnelStage && v.funnelStage === audience.funnelStage) score += 30
    if (v.icpTier     && v.icpTier     === account.icpTier)      score += 20
    if (v.persona     && v.persona     === audience.persona)     score += 15
    if (score > bestScore) { bestScore = score; bestVariant = v }
  }

  if (bestVariant && bestScore >= 70) {
    return {
      source:    'authored',
      variantId: bestVariant.variantId,
      confidence: bestScore,
      hero:          bestVariant.hero,
      socialProof:   bestVariant.socialProof,
      productMessaging: {
        featureEmphasis: [],
        messagingAngle: audience.funnelStage,
      },
      resources:    [],
      trustSignals: bestVariant.trustSignals,
      generatedAt:  Date.now(),
    }
  }

  // Score < 70 — generate via Claude
  return generateVariant(account, audience)
}

async function generateVariant(
  account: AccountContext,
  audience: AudienceContext
): Promise<ContentPayload> {
  const client = new Anthropic()
  const bg = JSON.stringify(brandGuidelines, null, 2)
  const claims = brandGuidelines.approvedIndustryClaims[account.industry ?? ''] ?? []

  const prompt = `You are generating website copy for a B2B SaaS company.

Context:
- Visitor industry: ${account.industry ?? 'unknown'}
- Buyer persona: ${audience.persona}
- Funnel stage: ${audience.funnelStage}
- Deal stage: ${account.dealStage ?? 'unknown'}
- Open opportunity value: ${account.opportunityValue ? `$${account.opportunityValue.toLocaleString()}` : 'unknown'}
- Topic clusters: ${audience.topicClusters.join(', ') || 'general'}

Brand constraints:
${bg}

Approved industry claims: ${claims.join(', ') || 'none'}

Return ONLY valid JSON (no markdown, no explanation) matching exactly this schema:
{
  "headline": "<max ${brandGuidelines.maxHeadlineWords} words, industry pain-led>",
  "subheadline": "<max ${brandGuidelines.maxSubheadlineWords} words, outcome-focused>",
  "ctaText": "<max ${brandGuidelines.maxCtaWords} words, action verb first>",
  "ctaUrl": "<relevant path like /demo or /case-studies/industry>",
  "logos": ["<company1>", "<company2>"],
  "featuredCaseStudy": "<url or null>",
  "featureEmphasis": ["<feature1>", "<feature2>", "<feature3>"],
  "messagingAngle": "<risk_reduction|efficiency|growth|compliance>",
  "resources": [{"title": "<title>", "url": "<url>"}],
  "trustSignals": ["<signal1>"]
}`

  try {
    const msg = await client.messages.create({
      model:      process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: Number(process.env.CLAUDE_MAX_TOKENS ?? 1000),
      messages:   [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const json = JSON.parse(text.trim()) as Record<string, unknown>

    return {
      source:    'generated',
      variantId: null,
      confidence: 65,
      hero: {
        headline:    String(json['headline']    ?? ''),
        subheadline: String(json['subheadline'] ?? ''),
        ctaText:     String(json['ctaText']     ?? ''),
        ctaUrl:      String(json['ctaUrl']      ?? '/demo'),
      },
      socialProof: {
        logos:             (json['logos'] as string[] | null) ?? [],
        featuredCaseStudy: (json['featuredCaseStudy'] as string | null) ?? null,
      },
      productMessaging: {
        featureEmphasis: (json['featureEmphasis'] as string[] | null) ?? [],
        messagingAngle:  String(json['messagingAngle'] ?? 'efficiency'),
      },
      resources:    (json['resources'] as Array<{ title: string; url: string }> | null) ?? [],
      trustSignals: (json['trustSignals'] as string[] | null) ?? [],
      generatedAt:  Date.now(),
    }
  } catch {
    return { ...DEFAULT_PAYLOAD, source: 'default' }
  }
}
