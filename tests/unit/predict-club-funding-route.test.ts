import { describe, expect, test } from 'bun:test'
import { recommendFundingRoute } from '../../plugins/predict-club/application/recommendFundingRoute'
import type { AssetBalances, PredictionRound } from '../../plugins/predict-club/domain/types'

const round: PredictionRound = {
  id: 'round-1',
  market: 'BTC/USDC',
  btcSpot: 64_000,
  direction: 'UP',
  strike: 65_000,
  expiryLabel: '16h',
  expiryMinutes: 16,
  totalPledgedDusdc: 0,
  fundingDusdc: 0,
  fundingTargetDusdc: 500,
  risk: 'ready',
  status: 'open',
  thesis: 'BTC should break out',
  oracle: 'oracle-1',
  suggestedDusdc: 100,
  signalBias: 'bullish',
  confidence: 'High',
  indicators: [],
}

describe('Predict Club funding route recommendation', () => {
  test('prefers direct DUSDC when the wallet is already funded', () => {
    const balances: AssetBalances = { sui: 0, usdc: 0, dusdc: 150 }
    const recommendation = recommendFundingRoute(balances, round)

    expect(recommendation.route).toBe('ready-with-dusdc')
    expect(recommendation.blocked).toBe(false)
  })

  test('falls back to escrow USDC when DUSDC is missing', () => {
    const balances: AssetBalances = { sui: 0, usdc: 150, dusdc: 0 }
    const recommendation = recommendFundingRoute(balances, round)

    expect(recommendation.route).toBe('club-escrow-usdc-to-dusdc')
    expect(recommendation.blocked).toBe(false)
  })

  test('blocks the route when the wallet has no usable source asset', () => {
    const balances: AssetBalances = { sui: 1, usdc: 0, dusdc: 0 }
    const recommendation = recommendFundingRoute(balances, round)

    expect(recommendation.route).toBe('bridge-assets-to-sui')
    expect(recommendation.blocked).toBe(true)
  })
})
