import { usePredictClub } from './PredictClubContext'
import { formatSigned, labelize } from './shared'

export function RoundHistoryPanel() {
  const { club } = usePredictClub()

  const totalPnl = club.history.reduce((sum, row) => sum + row.pnlDusdc, 0)

  return (
    <>
      <div className="p-xs bg-surface-container-high border-b border-outline-variant px-md flex items-center justify-between">
        <span className="font-label text-label-caps text-on-surface-variant uppercase">
          Club Round History
        </span>
        <span
          className={`font-data text-data-sm tabular-nums ${totalPnl >= 0 ? 'text-primary-fixed-dim' : 'text-error'}`}
        >
          {totalPnl >= 0 ? '+' : ''}
          {totalPnl.toFixed(2)}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-highest font-label text-label-caps text-on-surface-variant uppercase sticky top-0">
              <th className="p-2 font-normal">Round</th>
              <th className="p-2 font-normal">Thesis</th>
              <th className="p-2 font-normal text-center">Members</th>
              <th className="p-2 font-normal text-right">PnL</th>
              <th className="p-2 font-normal text-right">Claim</th>
            </tr>
          </thead>
          <tbody className="font-data text-data-sm">
            {club.history.map((row) => {
              const claim = club.claims.find((c) => c.roundId === row.id)
              return (
                <tr
                  key={row.id}
                  className="border-b border-outline-variant/50 hover:bg-surface-bright transition-colors cursor-pointer"
                >
                  <td className="p-2 text-on-surface-variant">{row.id}</td>
                  <td className="p-2 text-on-surface max-w-[120px] truncate" title={row.thesis}>
                    {row.thesis.length > 30 ? `${row.thesis.slice(0, 30)}…` : row.thesis}
                  </td>
                  <td className="p-2 text-center text-on-surface-variant">{row.participants}</td>
                  <td
                    className={`p-2 text-right tabular-nums ${
                      row.pnlDusdc >= 0 ? 'text-primary-fixed-dim' : 'text-error'
                    }`}
                  >
                    {formatSigned(row.pnlDusdc)}
                  </td>
                  <td className="p-2 text-right">
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded ${
                        row.claimStatus === 'claimed'
                          ? 'bg-primary-fixed-dim/20 text-primary-fixed-dim'
                          : row.claimStatus === 'claimable'
                            ? 'bg-secondary-fixed/20 text-secondary-fixed'
                            : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {labelize(claim?.status ?? row.claimStatus)}
                    </span>
                  </td>
                </tr>
              )
            })}
            {club.history.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-on-surface-variant">
                  No rounds completed yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
