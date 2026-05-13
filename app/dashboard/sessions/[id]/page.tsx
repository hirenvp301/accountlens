import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { ContentPayload } from '@/lib/agents/contentDecision'

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()
  const { data: session } = await db
    .from('sessions').select('*').eq('session_id', id).maybeSingle()

  if (!session) notFound()

  const content = session.content_payload as ContentPayload | null

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/dashboard" className="text-sm mb-6 inline-block" style={{ color: 'var(--green)' }}>← Back to dashboard</Link>

      <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-playfair), serif' }}>
        {session.company_name ?? session.domain ?? 'Unresolved visitor'}
      </h1>
      <p className="text-gray-500 text-sm mb-8">Session {session.session_id}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Account */}
        <Card title="Account Resolution">
          <Row label="Domain"       value={session.domain} />
          <Row label="Industry"     value={session.industry} />
          <Row label="ICP Tier"     value={session.icp_tier ? `Tier ${session.icp_tier}` : null} />
          <Row label="Deal Stage"   value={session.deal_stage} />
          <Row label="Opp Value"    value={session.opportunity_value ? `$${Number(session.opportunity_value).toLocaleString()}` : null} />
          <Row label="AE Owner"     value={session.ae_owner} />
          <Row label="Latency"      value={session.resolution_latency_ms ? `${session.resolution_latency_ms}ms` : null} />
        </Card>

        {/* Audience */}
        <Card title="Audience & Intent">
          <Row label="Persona"      value={session.persona} />
          <Row label="Funnel Stage" value={session.funnel_stage} />
          <Row label="Intent Score" value={session.intent_score != null ? `${session.intent_score}/100` : null} />
          <Row label="Session Depth" value={session.session_depth} />
          <Row label="Prior Visits" value={session.prior_visits} />
        </Card>

        {/* Content */}
        <Card title="Content Decision">
          <Row label="Source"     value={session.content_source} />
          <Row label="Variant ID" value={session.variant_id} />
          <Row label="Confidence" value={session.content_confidence ? `${session.content_confidence}%` : null} />
          {content?.hero && (
            <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-100 text-sm">
              <div className="font-medium text-gray-900 mb-1">{content.hero.headline}</div>
              <div className="text-gray-600 text-xs mb-1">{content.hero.subheadline}</div>
              <div className="text-xs font-medium" style={{ color: 'var(--green)' }}>{content.hero.ctaText} →</div>
            </div>
          )}
        </Card>

        {/* Delivery */}
        <Card title="Delivery">
          <Row label="Group"          value={session.holdout ? 'Control (holdout)' : 'Treatment'} />
          <Row label="Pipeline Status" value={session.pipeline_status} />
          {session.pipeline_error && <Row label="Error" value={session.pipeline_error} />}
        </Card>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4 text-sm uppercase tracking-wide" style={{ color: 'var(--green)' }}>{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value ?? '—'}</span>
    </div>
  )
}
