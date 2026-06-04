import type { AssetBalances, FundingRoute, PredictionRound } from '../domain/types'

export interface FundingRecommendation {
  route: FundingRoute
  label: string
  reason: string
  blocked: boolean
}

export function recommendFundingRoute(
  balances: AssetBalances,
  round: PredictionRound,
): FundingRecommendation {
  if (balances.dusdc >= round.suggestedDusdc) {
    return {
      route: 'ready-with-dusdc',
      label: 'Ready with DUSDC',
      reason: 'Wallet has enough DUSDC to accept the round without routing funds.',
      blocked: false,
    }
  }

  if (balances.usdc >= round.suggestedDusdc) {
    return {
      route: 'club-escrow-usdc-to-dusdc',
      label: 'Use escrow USDC -> DUSDC',
      reason: 'Wallet has USDC but needs DUSDC for the DeepBook Predict vault.',
      blocked: false,
    }
  }

  if (balances.sui > 2) {
    return {
      route: 'deepbook-sui-to-usdc',
      label: 'Swap SUI to USDC',
      reason: 'Wallet has SUI. Preserve gas, then route through USDC before DUSDC escrow.',
      blocked: false,
    }
  }

  return {
    route: 'bridge-assets-to-sui',
    label: 'Bridge assets to Sui',
    reason: 'Wallet does not have enough SUI, USDC, or DUSDC to join this round.',
    blocked: true,
  }
}
