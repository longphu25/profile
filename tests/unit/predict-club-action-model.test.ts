import { describe, it, expect } from 'bun:test'
import {
  currentStep,
  isExecuteLabel,
  FLOW_STEPS,
} from '../../plugins/predict-club/presentation/next/useActionModel'
import type { RoundStatus } from '../../plugins/predict-club/domain/types'

describe('currentStep', () => {
  it('returns Connect when disconnected, regardless of status', () => {
    for (const s of ['draft', 'executed', 'claimed'] as RoundStatus[]) {
      expect(currentStep(false, s, true)).toBe('Connect')
    }
  })

  it('returns Manager when connected but no predict manager yet', () => {
    expect(currentStep(true, 'draft', false)).toBe('Manager')
    expect(currentStep(true, 'executed', false)).toBe('Manager')
  })

  it('maps setup statuses (draft/open) to Review', () => {
    for (const s of ['draft', 'open'] as RoundStatus[]) {
      expect(currentStep(true, s, true)).toBe('Review')
    }
  })

  it('maps funding statuses (confirmed/funding) to Fund', () => {
    for (const s of ['confirmed', 'funding'] as RoundStatus[]) {
      expect(currentStep(true, s, true)).toBe('Fund')
    }
  })

  it('maps executed to Execute', () => {
    expect(currentStep(true, 'executed', true)).toBe('Execute')
  })

  it('maps settled/claimed to Claim', () => {
    for (const s of ['settled', 'claimed'] as RoundStatus[]) {
      expect(currentStep(true, s, true)).toBe('Claim')
    }
  })

  it('falls back to Review for cancelled', () => {
    expect(currentStep(true, 'cancelled', true)).toBe('Review')
  })

  it('only ever returns members of FLOW_STEPS', () => {
    const statuses: RoundStatus[] = [
      'draft',
      'open',
      'confirmed',
      'funding',
      'executed',
      'settled',
      'claimed',
      'cancelled',
    ]
    for (const connected of [true, false]) {
      for (const managerReady of [true, false]) {
        for (const s of statuses) {
          expect(FLOW_STEPS).toContain(currentStep(connected, s, managerReady))
        }
      }
    }
  })
})

describe('isExecuteLabel', () => {
  it('is true only for the Execute Trade label', () => {
    expect(isExecuteLabel('Execute Trade')).toBe(true)
  })

  it('is false for every other phase label', () => {
    for (const label of [
      'Connect Wallet',
      'Create Manager',
      'Fund to Join',
      'Review Round',
      'Claim Winnings',
      '',
    ]) {
      expect(isExecuteLabel(label)).toBe(false)
    }
  })
})
