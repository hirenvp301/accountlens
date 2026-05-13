import Link from 'next/link'

const steps = [
  { num: '01', agent: 'Account Resolution', desc: 'IP → Salesforce account match in <50ms. Three-layer cache: LRU → Redis → live SOQL.' },
  { num: '02', agent: 'Audience & Intent',  desc: 'Persona + funnel stage from URL path and Bombora intent signals.' },
  { num: '03', agent: 'Content Decision',   desc: 'Score authored Sitecore variants. Generate via Claude if no match ≥ 70.' },
  { num: '04', agent: 'Delivery & Test',    desc: '20% holdout group. SSR injection. Measurement events. AE pre-call brief.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex justify-between items-center">
        <span className="font-playfair text-xl font-bold" style={{ color: 'var(--green)' }}>AccountLens</span>
        <div className="flex gap-4 items-center">
          <Link href="/login"  className="text-sm text-gray-600 hover:text-gray-900">Log in</Link>
          <Link href="/signup" className="text-sm px-4 py-2 rounded-lg text-white font-medium" style={{ background: 'var(--green)' }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full mb-6" style={{ background: 'var(--mint-tint)', color: 'var(--green)' }}>
          Zero JavaScript overlay · Zero content flicker
        </div>
        <h1 className="text-5xl font-bold leading-tight mb-6 text-gray-900" style={{ fontFamily: 'var(--font-playfair), serif' }}>
          The right content for every B2B account,<br />
          <span style={{ color: 'var(--green)' }}>before the browser gets it.</span>
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          AccountLens resolves every inbound visitor to a Salesforce account in real time, then injects account-aware content inside the Sitecore rendering pipeline — not on top of it.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/signup" className="px-6 py-3 rounded-lg text-white font-medium text-sm" style={{ background: 'var(--green)' }}>
            Start free trial
          </Link>
          <Link href="/dashboard" className="px-6 py-3 rounded-lg text-gray-700 font-medium text-sm border border-gray-200 hover:border-gray-300">
            View dashboard
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12" style={{ fontFamily: 'var(--font-playfair), serif' }}>Four agents. One pipeline.</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps.map(s => (
            <div key={s.num} className="rounded-xl border p-6" style={{ borderColor: 'var(--mint-border)', background: 'var(--mint-tint)' }}>
              <div className="text-xs font-bold mb-2" style={{ color: 'var(--green)' }}>AGENT {s.num}</div>
              <div className="font-semibold text-gray-900 mb-2">{s.agent}</div>
              <div className="text-sm text-gray-600">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Measurement callout */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="rounded-2xl p-10 border" style={{ background: 'var(--mint-tint)', borderColor: 'var(--mint-border)' }}>
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-playfair), serif' }}>Measured in pipeline velocity, not clicks.</h2>
          <p className="text-gray-600 mb-6">A 20% holdout control group is maintained at all times. Attribution connects impression events directly to Salesforce opportunity creation and close events.</p>
          <Link href="/signup" className="inline-block px-6 py-3 rounded-lg text-white font-medium text-sm" style={{ background: 'var(--green)' }}>
            Book a demo
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} AccountLens by{' '}
        <a href="https://flowmatos.com" className="underline" style={{ color: 'var(--green)' }}>flowmatos</a>
        {' '}· Built by Hiren Patel
      </footer>
    </div>
  )
}
