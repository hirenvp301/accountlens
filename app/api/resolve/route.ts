import { NextRequest, NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/resolve
 * Triggers the 4-agent AccountLens pipeline for an inbound visitor.
 * Returns immediately — pipeline runs async via Inngest.
 */
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    sessionId: string
    ip?: string
    userAgent?: string
    utmSource?: string
    utmCampaign?: string
    referrer?: string
    pageUrl?: string
    contentConsumed?: string[]
    sessionDepth?: number
    priorVisits?: number
  }

  if (!body.sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  // Use forwarded IP if not provided
  const ip = body.ip
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? '0.0.0.0'

  // Create pending session row so the dashboard can show it immediately
  const db = await createClient()
  await db.from('sessions').upsert({
    session_id:       body.sessionId,
    ip,
    user_agent:       body.userAgent ?? req.headers.get('user-agent'),
    page_url:         body.pageUrl,
    utm_source:       body.utmSource,
    utm_campaign:     body.utmCampaign,
    referrer:         body.referrer,
    pipeline_status:  'pending',
    pipeline_progress: { step: 0, label: 'Queued' },
  }, { onConflict: 'session_id' })

  await inngest.send({
    name: 'accountlens/visitor.arrived',
    data: {
      sessionId: body.sessionId,
      signal: {
        ip,
        userAgent:   body.userAgent,
        utmSource:   body.utmSource,
        utmCampaign: body.utmCampaign,
        sessionId:   body.sessionId,
        referrer:    body.referrer,
        pageUrl:     body.pageUrl,
      },
      contentConsumed: body.contentConsumed ?? [],
      sessionDepth:    body.sessionDepth    ?? 1,
      priorVisits:     body.priorVisits     ?? 0,
    },
  })

  return NextResponse.json({ ok: true, sessionId: body.sessionId })
}
