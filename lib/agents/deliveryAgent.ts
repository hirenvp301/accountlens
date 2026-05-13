import { createHash } from 'crypto'
import type { AccountContext } from './accountResolver'
import type { AudienceContext } from './audienceIntent'
import type { ContentPayload } from './contentDecision'

export interface DeliveryResult {
  holdout: boolean
  eventType: 'impression_treatment' | 'impression_control'
  sessionId: string
  accountId: string | null
  opportunityId: string | null
  variantId: string | null
  funnelStage: string
  icpTier: number | null
  pageUrl: string
  timestamp: number
  shouldSendAeBrief: boolean
}

const EXPERIMENT_ID = 'accountlens-v1'

/**
 * Agent 04 — Delivery & Test.
 * Deterministic holdout assignment via CRC-32 equivalent, fires measurement events.
 */
export function deliver(
  sessionId: string,
  pageUrl: string,
  account: AccountContext,
  audience: AudienceContext,
  content: ContentPayload
): DeliveryResult {
  const holdoutPct = Number(process.env.HOLDOUT_PERCENTAGE ?? 20)
  const hash = deterministicHash(sessionId + EXPERIMENT_ID)
  const inHoldout = hash < holdoutPct

  const shouldSendAeBrief =
    !inHoldout &&
    account.dealStage !== null &&
    ['proposal', 'evaluation'].includes(account.dealStage)

  return {
    holdout:       inHoldout,
    eventType:     inHoldout ? 'impression_control' : 'impression_treatment',
    sessionId,
    accountId:     account.salesforceAccountId,
    opportunityId: account.opportunityId,
    variantId:     inHoldout ? null : content.variantId,
    funnelStage:   audience.funnelStage,
    icpTier:       account.icpTier,
    pageUrl,
    timestamp:     Date.now(),
    shouldSendAeBrief,
  }
}

/** Deterministic 0-99 bucket from a string — same input always same bucket. */
function deterministicHash(input: string): number {
  const hex = createHash('md5').update(input).digest('hex')
  return parseInt(hex.slice(0, 8), 16) % 100
}
