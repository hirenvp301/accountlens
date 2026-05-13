import jsforce from 'jsforce'

export interface SalesforceAccount {
  id: string
  name: string
  industry: string | null
  icpTier: number | null
  annualRevenue: number | null
  numberOfEmployees: number | null
}

export interface SalesforceOpportunity {
  id: string
  name: string
  amount: number
  stageName: string
  closeDate: string
  aeOwner: string
  accountId: string
}

let _conn: jsforce.Connection | null = null

async function getConnection(): Promise<jsforce.Connection> {
  if (_conn) return _conn
  _conn = new jsforce.Connection({ loginUrl: process.env.SALESFORCE_LOGIN_URL })
  await _conn.login(
    process.env.SALESFORCE_USERNAME!,
    process.env.SALESFORCE_PASSWORD!
  )
  return _conn
}

/** Look up a Salesforce account by company domain. */
export async function findAccountByDomain(domain: string): Promise<SalesforceAccount | null> {
  const conn = await getConnection()
  const escaped = domain.replace(/'/g, "\\'")
  const result = await conn.query<Record<string, unknown>>(
    `SELECT Id, Name, Industry, AccountLens_ICP_Tier__c,
            AnnualRevenue, NumberOfEmployees
     FROM Account
     WHERE Website LIKE '%${escaped}%'
     LIMIT 1`
  )
  if (!result.records.length) return null
  const r = result.records[0]
  return {
    id:                String(r['Id']),
    name:              String(r['Name']),
    industry:          (r['Industry'] as string | null) ?? null,
    icpTier:           (r['AccountLens_ICP_Tier__c'] as number | null) ?? null,
    annualRevenue:     (r['AnnualRevenue'] as number | null) ?? null,
    numberOfEmployees: (r['NumberOfEmployees'] as number | null) ?? null,
  }
}

/** Find the largest open opportunity for an account. */
export async function findOpenOpportunity(accountId: string): Promise<SalesforceOpportunity | null> {
  const conn = await getConnection()
  const result = await conn.query<Record<string, unknown>>(
    `SELECT Id, Name, Amount, StageName, CloseDate,
            OwnerId, Owner.Email, AccountId
     FROM Opportunity
     WHERE AccountId = '${accountId}'
       AND IsClosed = false
     ORDER BY Amount DESC
     LIMIT 1`
  )
  if (!result.records.length) return null
  const r = result.records[0]
  const owner = r['Owner'] as Record<string, unknown> | null
  return {
    id:        String(r['Id']),
    name:      String(r['Name']),
    amount:    (r['Amount'] as number) ?? 0,
    stageName: String(r['StageName']),
    closeDate: String(r['CloseDate']),
    aeOwner:   (owner?.['Email'] as string) ?? '',
    accountId: String(r['AccountId']),
  }
}

/** Normalise Salesforce StageName → AccountLens dealStage enum. */
export function normaliseDealStage(stageName: string): string {
  const s = stageName.toLowerCase()
  if (s.includes('proposal') || s.includes('quote'))   return 'proposal'
  if (s.includes('evaluation') || s.includes('poc'))   return 'evaluation'
  if (s.includes('prospect') || s.includes('aware'))   return 'awareness'
  if (s.includes('demo') || s.includes('consider'))    return 'consideration'
  if (s.includes('closed') || s.includes('won'))       return 'closed'
  return 'consideration'
}
