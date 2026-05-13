export const brandGuidelines = {
  voicePrinciples: [
    'Direct and confident, never arrogant',
    'Outcome-focused — lead with business results not features',
    'Technical depth available on demand — don\'t front-load jargon',
  ],
  forbiddenPhrases: [
    'synergy', 'leverage', 'robust', 'seamless', 'cutting-edge',
    'world-class', 'best-in-class', 'revolutionary',
  ],
  maxHeadlineWords: 8,
  maxSubheadlineWords: 20,
  maxCtaWords: 4,
  approvedIndustryClaims: {
    financial_services: ['SOC 2 Type II certified', 'FedRAMP Authorized'],
    healthcare:         ['HIPAA compliant', 'HITRUST certified'],
  } as Record<string, string[]>,
  competitorNames: [] as string[],
}

export type BrandGuidelines = typeof brandGuidelines
