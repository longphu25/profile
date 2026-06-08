import { describe, expect, test } from 'bun:test'
import {
  getSuiScanAccountUrl,
  getSuiScanObjectUrl,
  isFullSuiAddress,
} from '../../plugins/sui-wallet-profile/types'

const FULL_ADDRESS = `0x${'a'.repeat(64)}`
const OBJECT_ID = `0x${'b'.repeat(64)}`

describe('Sui wallet profile helpers', () => {
  test('builds SuiScan testnet account and object URLs', () => {
    expect(getSuiScanAccountUrl(FULL_ADDRESS, 'testnet')).toBe(
      `https://suiscan.xyz/testnet/account/${FULL_ADDRESS}`,
    )
    expect(getSuiScanObjectUrl(OBJECT_ID, 'testnet')).toBe(
      `https://suiscan.xyz/testnet/object/${OBJECT_ID}`,
    )
  })

  test('accepts only full Sui addresses for copy controls', () => {
    expect(isFullSuiAddress(FULL_ADDRESS)).toBe(true)
    expect(isFullSuiAddress('0x1234')).toBe(false)
    expect(isFullSuiAddress('0xA19...74C')).toBe(false)
  })
})
