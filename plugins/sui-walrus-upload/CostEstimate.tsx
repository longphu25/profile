// Cost estimate display component

import { estimateCost, formatSize, PRICE_PER_UNIT_EPOCH, type UploadMode } from './config'

interface CostEstimateProps {
  fileSize: number
  epochs: number
  mode: UploadMode
  publisher?: string
}

export function CostEstimate({ fileSize, epochs, mode, publisher }: CostEstimateProps) {
  const c = estimateCost(fileSize, epochs)

  return (
    <div className="sui-wup__cost">
      {mode === 'direct' ? (
        <>
          <div className="sui-wup__cost-row">
            <span className="sui-wup__cost-label">Storage Units</span>
            <span className="sui-wup__cost-val">
              {c.units} (⌈{formatSize(fileSize)} / 1MiB⌉)
            </span>
          </div>
          <div className="sui-wup__cost-row">
            <span className="sui-wup__cost-label">Est. Cost</span>
            <span className="sui-wup__cost-val">~{c.total.toFixed(4)} WAL</span>
          </div>
          <div className="sui-wup__cost-row">
            <span className="sui-wup__cost-label">Formula</span>
            <span className="sui-wup__cost-val" style={{ fontSize: 10 }}>
              {c.units} × {PRICE_PER_UNIT_EPOCH} × {epochs} + 0.01
            </span>
          </div>
          <div className="sui-wup__cost-row">
            <span className="sui-wup__cost-label">Blob Owner</span>
            <span className="sui-wup__cost-val" style={{ color: '#34d399' }}>
              You (wallet)
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="sui-wup__cost-row">
            <span className="sui-wup__cost-label">Cost</span>
            <span className="sui-wup__cost-val" style={{ color: '#34d399' }}>
              Free (publisher pays)
            </span>
          </div>
          <div className="sui-wup__cost-row">
            <span className="sui-wup__cost-label">Blob Owner</span>
            <span className="sui-wup__cost-val" style={{ color: '#fbbf24' }}>
              Publisher
            </span>
          </div>
          {publisher && (
            <div className="sui-wup__cost-row">
              <span className="sui-wup__cost-label">Publisher</span>
              <span className="sui-wup__cost-val" style={{ fontSize: 10 }}>
                {publisher.replace('https://', '').slice(0, 40)}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
