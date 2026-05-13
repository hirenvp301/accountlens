export interface IpCompany {
  domain: string | null
  companyName: string | null
  industry: string | null
  annualRevenue: number | null
  numberOfEmployees: number | null
  country: string | null
}

/**
 * Resolve an IP address to company firmographics.
 * Primary: Clearbit. Fallback: 6sense. Hard timeout: 40ms.
 * Returns null fields on any failure — never blocks render.
 */
export async function resolveIp(ip: string): Promise<IpCompany> {
  const empty: IpCompany = {
    domain: null, companyName: null, industry: null,
    annualRevenue: null, numberOfEmployees: null, country: null,
  }

  const timeout = new Promise<IpCompany>((resolve) =>
    setTimeout(() => resolve(empty), 40)
  )

  const lookup = (async (): Promise<IpCompany> => {
    try {
      if (process.env.CLEARBIT_API_KEY) return await clearbitLookup(ip)
      if (process.env.SIXSENSE_API_KEY)  return await sixsenseLookup(ip)
      return empty
    } catch {
      return empty
    }
  })()

  return Promise.race([lookup, timeout])
}

async function clearbitLookup(ip: string): Promise<IpCompany> {
  const res = await fetch(`https://reveal.clearbit.com/v1/companies/find?ip=${ip}`, {
    headers: { Authorization: `Bearer ${process.env.CLEARBIT_API_KEY}` },
  })
  if (!res.ok) return { domain: null, companyName: null, industry: null, annualRevenue: null, numberOfEmployees: null, country: null }
  const data = await res.json() as Record<string, unknown>
  const company = (data.company ?? data) as Record<string, unknown>
  const metrics = (company.metrics ?? {}) as Record<string, unknown>
  return {
    domain:            (company.domain as string) ?? null,
    companyName:       (company.name  as string) ?? null,
    industry:          (company.category as Record<string, string> | null)?.industry ?? null,
    annualRevenue:     (metrics.annualRevenue as number) ?? null,
    numberOfEmployees: (metrics.employees    as number) ?? null,
    country:           (company.geo as Record<string, string> | null)?.country ?? null,
  }
}

async function sixsenseLookup(ip: string): Promise<IpCompany> {
  const res = await fetch(`https://epsilon.6sense.com/v3/company/details`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${process.env.SIXSENSE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ip }),
  })
  if (!res.ok) return { domain: null, companyName: null, industry: null, annualRevenue: null, numberOfEmployees: null, country: null }
  const data = await res.json() as Record<string, unknown>
  const c = (data.company ?? {}) as Record<string, unknown>
  return {
    domain:            (c.domain  as string) ?? null,
    companyName:       (c.name    as string) ?? null,
    industry:          (c.industry as string) ?? null,
    annualRevenue:     (c.annual_revenue as number) ?? null,
    numberOfEmployees: (c.employee_count as number) ?? null,
    country:           (c.country as string) ?? null,
  }
}
