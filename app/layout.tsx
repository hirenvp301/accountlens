import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

const inter         = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair      = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

export const metadata: Metadata = {
  title: 'AccountLens — Zero-flicker B2B personalization',
  description: 'Resolve every inbound visitor to a Sitecore account in real time. Inject account-aware content at SSR — no JavaScript overlay, no flicker.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  )
}
