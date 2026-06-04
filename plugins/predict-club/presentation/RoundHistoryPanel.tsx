import { usePredictClub } from './PredictClubContext'
import { formatSigned } from './shared'

export function RoundHistoryPanel() {
  const { club } = usePredictClub()

  return (
    <>
      <div className="p-xs bg-surface-container-high border-b border-outline-variant px-md flex items-center justify-between">
        <span className="font-label text-label-caps text-on-surface-variant uppercase">
          Club Round History
        </span>
        <span className="font-data text-data-sm text-primary-fixed-dim tabular-nums">
          +1,219.75
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-highest font-label text-label-caps text-on-surface-variant uppercase sticky top-0">
              <th className="p-2 font-normal">Round</th>
              <th className="p-2 font-normal">Asset</th>
              <th className="p-2 font-normal text-right">PnL</th>
            </tr>
          </thead>
          <tbody className="font-data text-data-sm">
            {club.history.map((row) => (
              <tr
                key={row.id}
                className="border-b border-outline-variant/50 hover:bg-surface-bright transition-colors cursor-pointer"
              >
                <td className="p-2 text-on-surface-variant">{row.id}</td>
                <td className="p-2 font-bold text-on-surface">BTC/USDC</td>
                <td
                  className={`p-2 text-right tabular-nums ${
                    row.pnlDusdc >= 0 ? 'text-primary-fixed-dim' : 'text-error'
                  }`}
                >
                  {formatSigned(row.pnlDusdc)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
