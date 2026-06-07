import { useState, useEffect } from 'react'
import { createScallopGateway } from '../infrastructure/scallopGateway'
import { MIN_HEALTH_FACTOR } from '../domain/policies'

interface Props {
  walletAddress: string
  className?: string
}

export function ScallopHealthBadge({ walletAddress, className = '' }: Props) {
  const [health, setHealth] = useState<number | null>(null)

  useEffect(() => {
    if (!walletAddress) return
    createScallopGateway().getHealthFactor(walletAddress).then(setHealth).catch(() => {})
  }, [walletAddress])

  if (health === null) return null

  const color =
    health < 1.1 ? 'text-error' : health < MIN_HEALTH_FACTOR ? 'text-tertiary-fixed' : 'text-primary-fixed-dim'

  return (
    <span className={`font-data text-data-sm tabular-nums ${color} ${className}`} title="Scallop health factor">
      ⬡ {health.toFixed(2)}
    </span>
  )
}
