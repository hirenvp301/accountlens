import { inngest } from './client'
import { resolveAccount, type VisitorSignal } from '@/lib/agents/accountResolver'
import { classifyAudience } from '@/lib/agents/audienceIntent'
import { decideContent } from '@/lib/agents/contentDecision'
import { deliver } from '@/lib/agents/deliveryAgent'
import { sendAeBrief } from '@/lib/agents/aeBrief'

// Supabase service client import — loaded lazily to avoid edge-runtime issues
async function getDb() {
  const { createServiceClient } = await import('@/lib/supabase/server')
  return createServiceClient()
}

/**
 * AccountLens 4-agent pipeline.
 * Triggered by 'accountlens/visitor.arrived' event.
 * Each step retries independently if it fails.
 */
export const accountlensPipeline = inngest.createFunction(
  { id: 'accountlens-pipeline', retries: 3 },
  { event: 'accountlens/visitor.arrived' },

  async ({ event, step }) => {
    const signal: VisitorSignal = event.data.signal
    const sessionId: string     = event.data.sessionId

    // ── Step 1: Account Resolution ─────────────────────────────────────────
    const account = await step.run('resolve-account', async () => {
      return resolveAccount(signal)
    })

    await step.run('persist-resolution', async () => {
      const db = await getDb()
      await (await db).from('sessions').upsert({
        session_id:            sessionId,
        ip:                    signal.ip,
        user_agent:            signal.userAgent,
        page_url:              signal.pageUrl,
        utm_source:            signal.utmSource,
        utm_campaign:          signal.utmCampaign,
        referrer:              signal.referrer,
        resolved:              account.resolved,
        company_name:          account.companyName,
        domain:                account.domain,
        industry:              account.industry,
        icp_tier:              account.icpTier,
        open_opportunity:      account.openOpportunity,
        opportunity_id:        account.opportunityId,
        opportunity_value:     account.opportunityValue,
        deal_stage:            account.dealStage,
        ae_owner:              account.aeOwner,
        salesforce_account_id: account.salesforceAccountId,
        resolution_latency_ms: account.latencyMs,
        resolved_at:           new Date(account.resolvedAt).toISOString(),
        pipeline_status:       'resolving',
        pipeline_progress:     { step: 1, label: 'Account resolved' },
      }, { onConflict: 'session_id' })
    })

    // ── Step 2: Audience & Intent ──────────────────────────────────────────
    const audience = await step.run('classify-audience', async () => {
      return classifyAudience(account, {
        pageUrl:          signal.pageUrl ?? '/',
        contentConsumed:  event.data.contentConsumed,
        sessionDepth:     event.data.sessionDepth,
        priorVisits:      event.data.priorVisits,
      })
    })

    await step.run('persist-audience', async () => {
      const db = await getDb()
      await (await db).from('sessions').update({
        persona:         audience.persona,
        funnel_stage:    audience.funnelStage,
        intent_score:    audience.intentScore,
        session_depth:   audience.sessionDepth,
        prior_visits:    audience.priorVisits,
        content_consumed: audience.contentConsumed,
        pipeline_status: 'classifying',
        pipeline_progress: { step: 2, label: 'Audience classified' },
      }).eq('session_id', sessionId)
    })

    // ── Step 3: Content Decision ───────────────────────────────────────────
    const content = await step.run('decide-content', async () => {
      return decideContent(account, audience)
    })

    await step.run('persist-content', async () => {
      const db = await getDb()
      await (await db).from('sessions').update({
        content_source:   content.source,
        variant_id:       content.variantId,
        content_confidence: content.confidence,
        content_payload:  content,
        pipeline_status:  'content_decided',
        pipeline_progress: { step: 3, label: 'Content decided' },
      }).eq('session_id', sessionId)
    })

    // ── Step 4: Delivery & Holdout ─────────────────────────────────────────
    const delivery = await step.run('deliver', async () => {
      return deliver(sessionId, signal.pageUrl ?? '/', account, audience, content)
    })

    await step.run('persist-delivery', async () => {
      const db = await getDb()

      // Update session
      await (await db).from('sessions').update({
        holdout:         delivery.holdout,
        pipeline_status: 'complete',
        pipeline_progress: { step: 4, label: 'Delivered' },
      }).eq('session_id', sessionId)

      // Write impression event
      await (await db).from('impression_events').insert({
        event_type:     delivery.eventType,
        session_id:     sessionId,
        account_id:     delivery.accountId,
        opportunity_id: delivery.opportunityId,
        variant_id:     delivery.variantId,
        funnel_stage:   delivery.funnelStage,
        icp_tier:       delivery.icpTier,
        page_url:       delivery.pageUrl,
      })
    })

    // ── AE Brief ──────────────────────────────────────────────────────────
    if (delivery.shouldSendAeBrief) {
      await step.run('send-ae-brief', async () => {
        const db = await getDb()

        // Check 24h dedup
        const { data: lastBrief } = await (await db)
          .from('ae_brief_log')
          .select('sent_at')
          .eq('account_id', delivery.accountId ?? '')
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const lastSentAt = lastBrief?.sent_at ? new Date(lastBrief.sent_at).getTime() : null
        const sent = await sendAeBrief(account, audience, content, lastSentAt)

        if (sent) {
          await (await db).from('ae_brief_log').insert({
            account_id:    delivery.accountId,
            ae_owner:      account.aeOwner,
            deal_stage:    account.dealStage,
            brief_payload: { account, audience, variantServed: content.variantId },
          })
        }
      })
    }

    return { sessionId, holdout: delivery.holdout, variantId: delivery.variantId }
  }
)
