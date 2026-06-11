import { describe, expect, test } from 'bun:test'
import { transition, validEvents } from '../../plugins/predict-club/domain/roundLifecycle'

describe('Predict Club round lifecycle', () => {
  test('advances through the publish-to-claim path', () => {
    expect(transition('draft', 'publish')).toEqual({ ok: true, newStatus: 'open' })
    expect(transition('open', 'confirm')).toEqual({ ok: true, newStatus: 'confirmed' })
    expect(transition('confirmed', 'fund')).toEqual({ ok: true, newStatus: 'funding' })
    expect(transition('funding', 'execute')).toEqual({ ok: true, newStatus: 'executed' })
    expect(transition('executed', 'settle')).toEqual({ ok: true, newStatus: 'settled' })
    expect(transition('settled', 'claim')).toEqual({ ok: true, newStatus: 'claimed' })
  })

  test('rejects invalid transitions with a clear error', () => {
    const result = transition('open', 'execute')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Cannot execute from open')
  })

  test('exposes the valid event list for each state', () => {
    expect(validEvents('open').sort()).toEqual(['cancel', 'confirm'])
    expect(validEvents('settled')).toEqual(['claim'])
  })
})
