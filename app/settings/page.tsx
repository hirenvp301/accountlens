import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <AppShell>
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-playfair), serif' }}>Settings</h1>
        <p className="text-gray-500 text-sm mb-8">Configure your Sitecore and Salesforce connectors.</p>

        <div className="space-y-6">

          {/* Sitecore */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Sitecore Connector</h2>
            <p className="text-sm text-gray-500 mb-4">Set via environment variables. Supports XM Cloud and XM/XP 10.x.</p>
            <div className="space-y-3 text-sm">
              {[
                ['SITECORE_VERSION',       'xmcloud or xmxp'],
                ['SITECORE_CM_URL',        'https://your-tenant.sitecorecloud.io'],
                ['SITECORE_PARENT_PATH',   '/sitecore/content/Site/Personalization'],
                ['SITECORE_CLIENT_ID',     'XM Cloud: OAuth2 client ID'],
                ['SITECORE_CLIENT_SECRET', 'XM Cloud: OAuth2 client secret'],
                ['SITECORE_API_KEY',       'XM/XP: API key GUID'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700 whitespace-nowrap">{k}</code>
                  <span className="text-gray-400 text-xs">{v}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Salesforce */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Salesforce Connector</h2>
            <p className="text-sm text-gray-500 mb-4">Connected App with username-password OAuth2.</p>
            <div className="space-y-3 text-sm">
              {[
                ['SALESFORCE_LOGIN_URL',     'https://login.salesforce.com'],
                ['SALESFORCE_USERNAME',      'api-user@yourcompany.com'],
                ['SALESFORCE_PASSWORD',      'password + security token'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700 whitespace-nowrap">{k}</code>
                  <span className="text-gray-400 text-xs">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: 'var(--mint-tint)', color: 'var(--green)' }}>
              Custom field required on Account object: <code>AccountLens_ICP_Tier__c</code> (Number 1-3)
            </div>
          </section>

          {/* IP Enrichment */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">IP Enrichment</h2>
            <p className="text-sm text-gray-500 mb-4">Primary: Clearbit. Fallback: 6sense. Hard timeout: 40ms.</p>
            <div className="space-y-3">
              {[
                ['CLEARBIT_API_KEY',  'Primary — sk_...'],
                ['SIXSENSE_API_KEY',  'Fallback (optional)'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3 text-sm">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700 whitespace-nowrap">{k}</code>
                  <span className="text-gray-400 text-xs">{v}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Pipeline */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Pipeline</h2>
            <div className="space-y-3">
              {[
                ['HOLDOUT_PERCENTAGE',  '20 (0-100) — % of visitors in control group'],
                ['ANTHROPIC_API_KEY',   'sk-ant-... — for Agent 03 content generation'],
                ['CLAUDE_MODEL',        'claude-sonnet-4-6'],
                ['SLACK_WEBHOOK_URL',   'For AE pre-call briefs'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3 text-sm">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700 whitespace-nowrap">{k}</code>
                  <span className="text-gray-400 text-xs">{v}</span>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </AppShell>
  )
}
