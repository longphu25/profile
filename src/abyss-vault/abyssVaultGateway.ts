// Abyss Vault Gateway - Interface + Factory
// Builds PTBs for:
// - Mainnet: deposit/withdraw against Abyss Protocol vaults
// - Testnet: DeepBook v3 place_limit_order on SUI/DBUSDC pool

import { Transaction } from '@mysten/sui/transactions'
import {
  ABYSS_PACKAGE_ID,
  ABYSS_SUPPLIER_CAP_ID,
  CLOCK_ID,
  DEEPBOOK_PACKAGE_ID,
  POOLS,
  VAULT_REGISTRY_ID,
  VAULTS,
  type AbyssNetwork,
  type PoolInfo,
  type VaultInfo,
} from './constants'

// --- Vault (mainnet) ---

export interface DepositParams {
  asset: string
  amount: bigint
  coinIds?: string[]
}

export interface WithdrawParams {
  asset: string
  atokenAmount: bigint
  atokenCoinIds: string[]
}

// --- DeepBook trading (testnet) ---

export interface PlaceLimitOrderParams {
  poolName: string
  balanceManagerId: string
  tradeCapId: string
  price: bigint
  quantity: bigint
  isBid: boolean
  selfMatchingOption: number
  expiration: bigint
}

export interface AbyssVaultGateway {
  network: AbyssNetwork
  getVaults(): VaultInfo[]
  getPools(): PoolInfo[]
  buildDepositTx(params: DepositParams, sender: string): Transaction
  buildWithdrawTx(params: WithdrawParams, sender: string): Transaction
  buildPlaceLimitOrderTx(params: PlaceLimitOrderParams): Transaction
}

export function createAbyssVaultGateway(network: AbyssNetwork): AbyssVaultGateway {
  const vaults = VAULTS[network]
  const pools = POOLS[network]

  function findVault(asset: string): VaultInfo {
    const v = vaults.find((v) => v.asset === asset)
    if (!v) throw new Error(`No Abyss vault for asset: ${asset}`)
    return v
  }

  function findPool(name: string): PoolInfo {
    const p = pools.find((p) => p.name === name)
    if (!p) throw new Error(`No pool: ${name}`)
    return p
  }

  return {
    network,
    getVaults: () => vaults,
    getPools: () => pools,

    buildDepositTx(params, sender) {
      const packageId = ABYSS_PACKAGE_ID[network]
      const vaultRegistryId = VAULT_REGISTRY_ID[network]
      const supplierCapId = ABYSS_SUPPLIER_CAP_ID[network]
      if (!packageId) throw new Error(`Abyss vaults not available on ${network}`)

      const vault = findVault(params.asset)
      const tx = new Transaction()

      let depositCoin: ReturnType<typeof tx.splitCoins>[0]
      const isSui = vault.assetType === '0x2::sui::SUI'

      if (isSui) {
        ;[depositCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(params.amount)])
      } else {
        if (!params.coinIds?.length) throw new Error('coinIds required for non-SUI deposits')
        if (params.coinIds.length > 1) {
          tx.mergeCoins(
            tx.object(params.coinIds[0]),
            params.coinIds.slice(1).map((id) => tx.object(id)),
          )
        }
        ;[depositCoin] = tx.splitCoins(tx.object(params.coinIds[0]), [tx.pure.u64(params.amount)])
      }

      const [aTokenCoin] = tx.moveCall({
        target: `${packageId}::abyss_vault::supply`,
        arguments: [
          tx.object(vault.vaultId),
          tx.object(vault.marginPoolId),
          tx.object(vaultRegistryId),
          tx.object('0x0'), // marginRegistryId - TODO
          depositCoin,
          tx.object(supplierCapId),
          tx.pure.option('id', vault.referralId),
          tx.object(CLOCK_ID),
        ],
        typeArguments: [vault.assetType, vault.atokenType],
      })

      tx.transferObjects([aTokenCoin], sender)
      return tx
    },

    buildWithdrawTx(params, sender) {
      const packageId = ABYSS_PACKAGE_ID[network]
      const vaultRegistryId = VAULT_REGISTRY_ID[network]
      const supplierCapId = ABYSS_SUPPLIER_CAP_ID[network]
      if (!packageId) throw new Error(`Abyss vaults not available on ${network}`)

      const vault = findVault(params.asset)
      const tx = new Transaction()

      if (params.atokenCoinIds.length > 1) {
        tx.mergeCoins(
          tx.object(params.atokenCoinIds[0]),
          params.atokenCoinIds.slice(1).map((id) => tx.object(id)),
        )
      }

      const [withdrawCoin] = tx.splitCoins(tx.object(params.atokenCoinIds[0]), [
        tx.pure.u64(params.atokenAmount),
      ])

      const [assetCoin] = tx.moveCall({
        target: `${packageId}::abyss_vault::withdraw`,
        arguments: [
          tx.object(vault.vaultId),
          tx.object(vault.marginPoolId),
          tx.object(vaultRegistryId),
          tx.object('0x0'), // marginRegistryId - TODO
          withdrawCoin,
          tx.object(supplierCapId),
          tx.object(CLOCK_ID),
        ],
        typeArguments: [vault.assetType, vault.atokenType],
      })

      tx.transferObjects([assetCoin], sender)
      return tx
    },

    buildPlaceLimitOrderTx(params) {
      const packageId = DEEPBOOK_PACKAGE_ID[network]
      if (!packageId) throw new Error(`DeepBook not available on ${network}`)

      const pool = findPool(params.poolName)
      const tx = new Transaction()

      // Step 1: generate_proof_as_trader
      const [tradeProof] = tx.moveCall({
        target: `${packageId}::balance_manager::generate_proof_as_trader`,
        arguments: [tx.object(params.balanceManagerId), tx.object(params.tradeCapId)],
      })

      // Step 2: place_limit_order
      tx.moveCall({
        target: `${packageId}::pool::place_limit_order`,
        typeArguments: [pool.baseType, pool.quoteType],
        arguments: [
          tx.object(pool.poolId),
          tx.object(params.balanceManagerId),
          tradeProof,
          tx.pure.u64(params.price),
          tx.pure.u8(params.isBid ? 0 : 1), // order_type: bid=0, ask=1
          tx.pure.u8(params.selfMatchingOption),
          tx.pure.u64(params.quantity),
          tx.pure.u64(0), // lot size
          tx.pure.bool(false), // pay with deep
          tx.pure.bool(false), // immediate or cancel
          tx.pure.u64(params.expiration),
          tx.object(CLOCK_ID),
        ],
      })

      return tx
    },
  }
}
