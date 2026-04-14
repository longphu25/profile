// Publisher list component — shows available publishers for selected network

import { useState } from 'react'
import { type NetworkKey, TESTNET_PUBLISHERS, MAINNET_PUBLISHERS } from './config'

interface PublisherListProps {
  network: NetworkKey
  selected: string
  onSelect: (url: string) => void
}

export function PublisherList({ network, selected, onSelect }: PublisherListProps) {
  const [expanded, setExpanded] = useState(false)
  const publishers = network === 'testnet' ? TESTNET_PUBLISHERS : MAINNET_PUBLISHERS

  if (publishers.length === 0) {
    return (
      <div className="sui-wup__pub-empty">No public publishers on {network}. Use Direct mode.</div>
    )
  }

  const current = publishers.find((p) => p.url === selected)
  const displayList = expanded ? publishers : publishers.slice(0, 3)

  return (
    <div className="sui-wup__pub">
      <div className="sui-wup__pub-header">
        <span className="sui-wup__pub-title">Publisher ({publishers.length})</span>
        {publishers.length > 3 && (
          <button className="sui-wup__pub-toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show less' : `Show all ${publishers.length}`}
          </button>
        )}
      </div>
      <div className="sui-wup__pub-list">
        {displayList.map((p) => (
          <button
            key={p.url}
            className={`sui-wup__pub-item ${selected === p.url ? 'sui-wup__pub-item--active' : ''}`}
            onClick={() => onSelect(p.url)}
          >
            <span className="sui-wup__pub-name">{p.operator}</span>
            <span className="sui-wup__pub-url">
              {p.url.replace('https://', '').slice(0, 35)}...
            </span>
          </button>
        ))}
      </div>
      {current && (
        <div className="sui-wup__pub-selected">
          Using: <strong>{current.operator}</strong>
        </div>
      )}
    </div>
  )
}
