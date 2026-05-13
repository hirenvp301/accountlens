import type { AccountContext } from './accountResolver'
import type { AudienceContext } from './audienceIntent'
import type { ContentPayload } from './contentDecision'

export interface AeBriefPayload {
  accountName: string
  domain: string | null
  aeOwner: string | null
  dealStage: string | null
  opportunityValue: number | null
  visitSummary: {
    sessionDepth: number
    priorVisits: number
    contentConsumed: string[]
    intentScore: number
    topicClusters: string[]
  }
  variantServed: string | null
  talkingPoints: string[]
}

/**
 * AE Pre-Call Brief.
 * Fires when deal stage is evaluation/proposal and account hasn't had a brief in 24h.
 * Delivers via Slack webhook.
 */
export async function sendAeBrief(
  account: AccountContext,
  audience: AudienceContext,
  content: ContentPayload,
  lastBriefSentAt: number | null
): Promise<boolean> {
  // 24h dedup check
  if (lastBriefSentAt && Date.now() - lastBriefSentAt < 24 * 60 * 60 * 1000) {
    return false
  }

  const payload = buildBriefPayload(account, audience, content)
  await postToSlack(payload)
  return true
}

function buildBriefPayload(
  account: AccountContext,
  audience: AudienceContext,
  content: ContentPayload
): AeBriefPayload {
  const talkingPoints: string[] = []

  if (audience.topicClusters.includes('compliance'))
    talkingPoints.push('They\'ve been researching compliance features — lead with audit trail and SOC 2.')
  if (audience.topicClusters.includes('roi') || audience.funnelStage === 'late_stage')
    talkingPoints.push('Pricing page visit detected — be ready to discuss ROI and commercials.')
  if (audience.topicClusters.includes('technical_integration'))
    talkingPoints.push('Technical evaluator signals — have the API docs and integration architecture ready.')
  if (audience.priorVisits >= 3)
    talkingPoints.push(`High-intent account: ${audience.priorVisits} prior visits this month.`)

  return {
    accountName:       account.companyName ?? 'Unknown',
    domain:            account.domain,
    aeOwner:           account.aeOwner,
    dealStage:         account.dealStage,
    opportunityValue:  account.opportunityValue,
    visitSummary: {
      sessionDepth:    audience.sessionDepth,
      priorVisits:     audience.priorVisits,
      contentConsumed: audience.contentConsumed,
      intentScore:     audience.intentScore,
      topicClusters:   audience.topicClusters,
    },
    variantServed:  content.variantId,
    talkingPoints,
  }
}

async function postToSlack(brief: AeBriefPayload): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  const oppValue = brief.opportunityValue
    ? `$${brief.opportunityValue.toLocaleString()}`
    : 'unknown'

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `🔔 AccountLens: ${brief.accountName} is active` } },
    { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Deal Stage:* ${brief.dealStage}` },
        { type: 'mrkdwn', text: `*Opp Value:* ${oppValue}` },
        { type: 'mrkdwn', text: `*Intent Score:* ${brief.visitSummary.intentScore}/100` },
        { type: 'mrkdwn', text: `*Session Depth:* ${brief.visitSummary.sessionDepth} pages` },
      ]
    },
    { type: 'section', text: { type: 'mrkdwn', text: `*Topic Clusters:* ${brief.visitSummary.topicClusters.join(', ') || '—'}` } },
    { type: 'section', text: { type: 'mrkdwn', text: `*Content Consumed:*\n${brief.visitSummary.contentConsumed.map(u => `• ${u}`).join('\n') || '—'}` } },
    ...(brief.talkingPoints.length ? [{
      type: 'section',
      text: { type: 'mrkdwn', text: `*Recommended Talking Points:*\n${brief.talkingPoints.map(p => `• ${p}`).join('\n')}` }
    }] : []),
  ]

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  })
}
