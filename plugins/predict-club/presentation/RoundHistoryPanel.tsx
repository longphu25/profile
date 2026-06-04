import { usePredictClub } from './PredictClubContext'
import { formatSigned } from './shared'

export function RoundHistoryPanel() {
  const { club } = usePredictClub()

  return (
    <>
      <header>
        <span>Club Round History</span>
      </header>
      <table>
        <thead>
          <tr>
            <th>Round</th>
            <th>Asset</th>
            <th>PnL</th>
          </tr>
        </thead>
        <tbody>
          {club.history.map((row) => (
            <tr key={row.id}>
              <td>{row.id}</td>
              <td>BTC/USDC</td>
              <td className={row.pnlDusdc >= 0 ? 'pc-positive' : 'pc-negative'}>
                {formatSigned(row.pnlDusdc)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
