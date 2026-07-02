import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

/** Refresh default btc-chart symbols every 5 minutes (shared cache for free tier). */
crons.interval(
  'btc-chart refresh market snapshots',
  { minutes: 5 },
  internal.btcChart.actions.refreshDefaultSymbols,
)

export default crons
