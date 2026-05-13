import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const STAGE_COLORS: Record<string, string> = {
  proposal:      'bg-purple-100 text-purple-700',
  evaluation:    'bg-blue-100 text-blue-700',
  consideration: 'bg-yellow-100 text-yellow-700',
  awareness:     'bg-gray-100 text-gray-600',
  closed:        'bg-green-100 text-green-700',
}

const STATUS_COLORS: Record<string, string> = {
  complete:        'text-green-600',
  content_decided: 'text-blue-600',
  classifying:     'text-yellow-600',
  resolving:       'text-orange-600',
  pending:         'text-gray-400',
  error:           'text-red-600',
}

export default async function DashboardPage() {
  const db = await createClient()

  const [sessionsRes, treatmentRes, controlRes, briefsRes] = await Promise.all([
    db.from('sessions').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('impression_events').select('id', { count: 'exact' }).eq('event_type', 'impression_treatment'),
    db.from('impression_events').select('id', { count: 'exact' }).eq('event_type', 'impression_control'),
    db.from('ae_brief_log').select('id', { count: 'exact' }),
  ])

  const sessions   = sessionsRes.data ?? []
  const treatment  = treatmentRes.count ?? 0
  const control    = controlRes.count   ?? 0
  const briefs     = briefsRes.count    ?? 0
  const total      = treatment + control

  const resolvedSessions = sessions.filter(s => s.resolved).length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: 'var(--font-playfair), serif' }}>Pipeline Dashboard</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Sessions',     value: sessions.length },
          { label: 'Resolved Accounts',  value: resolvedSessions },
          { label: 'Treatment / Control', value: `${treatment} / ${control}` },
          { label: 'AE Briefs Sent',     value: briefs },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border p-4" style={{ borderColor: 'var(--mint-border)', background: 'var(--mint-tint)' }}>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-xs text-gray-500 mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Holdout ratio bar */}
      {total > 0 && (
        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Treatment ({Math.round(treatment / total * 100)}%)</span>
            <span>Control ({Math.round(control / total * 100)}%)</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-2 rounded-full" style={{ width: `${treatment / total * 100}%`, background: 'var(--green)' }} />
          </div>
        </div>
      )}

      {/* Sessions table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Recent Sessions</h2>
          <span className="text-xs text-gray-400">{sessions.length} rows</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                {['Account', 'ICP', 'Deal Stage', 'Persona', 'Variant', 'Holdout', 'Status', 'When'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">No sessions yet. Trigger /api/resolve to start the pipeline.</td></tr>
              )}
              {sessions.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/sessions/${s.session_id}`} className="font-medium text-gray-900 hover:underline">
                      {s.company_name ?? s.domain ?? <span className="text-gray-400">Unresolved</span>}
                    </Link>
                    {s.domain && <div className="text-xs text-gray-400">{s.domain}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.icp_tier ? `T${s.icp_tier}` : '—'}</td>
                  <td className="px-4 py-3">
                    {s.deal_stage
                      ? <span className={`text-xs px-2 py-1 rounded-full font-medium ${STAGE_COLORS[s.deal_stage] ?? 'bg-gray-100 text-gray-600'}`}>{s.deal_stage}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{s.persona?.replace('_', ' ') ?? '—'}</td>
                  <td className="px-4 py-3">
                    {s.content_source === 'authored'  && <span className="text-xs text-green-600 font-medium">Authored</span>}
                    {s.content_source === 'generated' && <span className="text-xs text-blue-600  font-medium">Generated</span>}
                    {s.content_source === 'default'   && <span className="text-xs text-gray-400">Default</span>}
                    {!s.content_source                && <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">{s.holdout ? <span className="text-xs text-orange-500">Control</span> : <span className="text-xs text-green-600">Treatment</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${STATUS_COLORS[s.pipeline_status] ?? 'text-gray-400'}`}>
                      {s.pipeline_progress?.label ?? s.pipeline_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(s.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
