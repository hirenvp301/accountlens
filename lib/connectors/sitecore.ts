export interface SitecoreVariant {
  variantId: string
  industry: string | null
  funnelStage: string | null
  icpTier: number | null
  persona: string | null
  hero: {
    headline: string
    subheadline: string
    ctaText: string
    ctaUrl: string
  }
  socialProof: { logos: string[]; featuredCaseStudy: string | null }
  trustSignals: string[]
}

let _bearerToken: string | null = null
let _tokenExpiry = 0

/** Get a valid bearer token for XM Cloud (OAuth2 client credentials). */
async function getXmCloudToken(): Promise<string> {
  if (_bearerToken && Date.now() < _tokenExpiry) return _bearerToken

  const res = await fetch(
    `${process.env.SITECORE_CM_URL}/oauth/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     process.env.SITECORE_CLIENT_ID!,
        client_secret: process.env.SITECORE_CLIENT_SECRET!,
        audience:      process.env.SITECORE_AUDIENCE!,
      }),
    }
  )
  if (!res.ok) throw new Error(`Sitecore auth failed: ${res.status}`)
  const data = await res.json() as { access_token: string; expires_in: number }
  _bearerToken = data.access_token
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return _bearerToken
}

/** Fetch all authored personalisation variants from Sitecore. */
export async function fetchVariants(): Promise<SitecoreVariant[]> {
  const version = process.env.SITECORE_VERSION ?? 'xmcloud'

  if (version === 'xmcloud') {
    return fetchVariantsXmCloud()
  } else {
    return fetchVariantsXmXp()
  }
}

async function fetchVariantsXmCloud(): Promise<SitecoreVariant[]> {
  const token = await getXmCloudToken()
  const res = await fetch(
    `${process.env.SITECORE_CM_URL}/sitecore/api/graph/edge`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query GetVariants($path: String!) {
            item(path: $path, language: "${process.env.SITECORE_LANGUAGE ?? 'en'}") {
              children(first: 50) {
                nodes {
                  id name
                  field(name: "industry")    { value }
                  field(name: "funnelStage") { value }
                  field(name: "icpTier")     { value }
                  field(name: "persona")     { value }
                  field(name: "headline")    { value }
                  field(name: "subheadline") { value }
                  field(name: "ctaText")     { value }
                  field(name: "ctaUrl")      { value }
                  field(name: "logos")       { value }
                  field(name: "caseStudy")   { value }
                  field(name: "trust")       { value }
                }
              }
            }
          }
        `,
        variables: { path: process.env.SITECORE_PARENT_PATH },
      }),
    }
  )
  if (!res.ok) return []
  const json = await res.json() as { data: { item: { children: { nodes: Record<string, unknown>[] } } } }
  return (json.data?.item?.children?.nodes ?? []).map(mapNode)
}

async function fetchVariantsXmXp(): Promise<SitecoreVariant[]> {
  const res = await fetch(
    `${process.env.SITECORE_CM_URL}/sitecore/api/ssc/item/?path=${process.env.SITECORE_PARENT_PATH}&sc_apikey=${process.env.SITECORE_API_KEY}&database=${process.env.SITECORE_DATABASE ?? 'master'}`,
    { headers: { Accept: 'application/json' } }
  )
  if (!res.ok) return []
  const data = await res.json() as { Items?: Record<string, unknown>[] }
  return (data.Items ?? []).map(mapNode)
}

function mapNode(n: Record<string, unknown>): SitecoreVariant {
  const f = (name: string) => {
    const field = n[name] as { value?: string } | string | null
    if (!field) return ''
    return typeof field === 'string' ? field : (field.value ?? '')
  }
  return {
    variantId:   String(n['id'] ?? n['Id'] ?? n['name'] ?? ''),
    industry:    f('industry')    || null,
    funnelStage: f('funnelStage') || null,
    icpTier:     f('icpTier')     ? Number(f('icpTier')) : null,
    persona:     f('persona')     || null,
    hero: {
      headline:    f('headline'),
      subheadline: f('subheadline'),
      ctaText:     f('ctaText'),
      ctaUrl:      f('ctaUrl'),
    },
    socialProof: {
      logos:            f('logos') ? f('logos').split(',').map(s => s.trim()) : [],
      featuredCaseStudy: f('caseStudy') || null,
    },
    trustSignals: f('trust') ? f('trust').split(',').map(s => s.trim()) : [],
  }
}
