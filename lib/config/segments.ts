export const icpTierRules = {
  tier1: { minRevenue: 1_000_000_000, minEmployees: 5000 },
  tier2: { minRevenue: 100_000_000,   minEmployees: 500  },
  tier3: { minRevenue: 0,             minEmployees: 0    },
}

export const industryMap: Record<string, string> = {
  'Financial Services': 'financial_services',
  'Banking':            'financial_services',
  'Insurance':          'financial_services',
  'Healthcare':         'healthcare',
  'Technology':         'technology',
  'Manufacturing':      'manufacturing',
  'Retail':             'retail',
}

export const funnelStageFromPath: Array<{
  pattern: RegExp
  stage: string
  persona: string | null
}> = [
  { pattern: /\/pricing|\/plans/,       stage: 'late_stage',    persona: 'economic_buyer'       },
  { pattern: /\/demo|\/contact-sales/,  stage: 'late_stage',    persona: 'economic_buyer'       },
  { pattern: /\/docs|\/api|\/developers/, stage: 'evaluation',  persona: 'technical_evaluator'  },
  { pattern: /\/case-studies|\/customers/, stage: 'consideration', persona: null               },
  { pattern: /\/blog|\/resources/,      stage: 'awareness',     persona: null                   },
]

export function classifyIcpTier(
  annualRevenue: number | null,
  numberOfEmployees: number | null
): number | null {
  const rev = annualRevenue ?? 0
  const emp = numberOfEmployees ?? 0
  if (rev >= icpTierRules.tier1.minRevenue || emp >= icpTierRules.tier1.minEmployees) return 1
  if (rev >= icpTierRules.tier2.minRevenue || emp >= icpTierRules.tier2.minEmployees) return 2
  if (rev > 0 || emp > 0) return 3
  return null
}
