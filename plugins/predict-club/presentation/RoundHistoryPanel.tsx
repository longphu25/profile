import { Fragment, useState, type ReactNode } from 'react'
import { usePredictClub } from './PredictClubContext'
import { formatSigned, labelize } from './shared'

export function RoundHistoryPanel() {
  const { club } = usePredictClub()
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
              const failedChecks = row.riskChecks?.filter((check) => !check.passed) ?? []
              const passedChecks = row.riskChecks?.filter((check) => check.passed).length ?? 0
              const totalChecks = row.riskChecks?.length ?? 0
              return (
                <Fragment key={row.id}>
                  <tr
                    className="border-b border-outline-variant/50 hover:bg-surface-bright transition-colors cursor-pointer"
                    onClick={() => setExpandedId((current) => (current === row.id ? null : row.id))}
                  >
                    <td className="p-2 text-on-surface-variant">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">
                          {expandedId === row.id ? 'expand_less' : 'expand_more'}
                        </span>
                        {row.id}
                      </div>
                    </td>
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
                  {expandedId === row.id && (
                    <tr key={`${row.id}-evidence`} className="border-b border-outline-variant/50">
                      <td colSpan={5} className="p-2 bg-surface-container-low">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-sm">
                          <EvidenceBlock title="Signal">
                            <span className="text-on-surface">
                              {labelize(row.signalBias ?? row.direction)} ·{' '}
                              {row.confidence ?? 'Unknown'} confidence
                            </span>
                            {(row.indicatorReasons ?? []).slice(0, 3).map((reason) => (
                              <span key={reason}>{reason}</span>
                            ))}
                          </EvidenceBlock>
                          <EvidenceBlock title="Risk">
                            <span
                              className={
                                failedChecks.length ? 'text-error' : 'text-primary-fixed-dim'
                              }
                            >
                              {totalChecks > 0
                                ? `${passedChecks}/${totalChecks} checks passed`
                                : 'No risk snapshot'}
                            </span>
                            {failedChecks.slice(0, 3).map((check) => (
                              <span key={check.id}>{check.message ?? check.label}</span>
                            ))}
                          </EvidenceBlock>
                          <EvidenceBlock title="Settlement">
                            <span className="text-on-surface">
                              {labelize(row.result)} · {row.strike}
                            </span>
                            <span>{row.participants} executed members</span>
                            <span>
                              {row.confirmedAt
                                ? new Date(row.confirmedAt).toLocaleString()
                                : 'No confirmation time'}
                            </span>
                          </EvidenceBlock>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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

function EvidenceBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-outline-variant rounded-lg p-sm bg-surface-container-highest flex flex-col gap-xs">
      <span className="font-label text-label-caps text-on-surface-variant uppercase">{title}</span>
      <div className="font-data text-[11px] leading-4 text-on-surface-variant flex flex-col gap-px">
        {children}
      </div>
    </div>
  )
}
