import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { accountlensPipeline } from '@/lib/inngest/pipeline'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [accountlensPipeline],
})
