// Abyss Protocol Vault addresses
// Source: https://docs.abyssprotocol.xyz/developer-reference
// Testnet DeepBook addresses from TX E9cvEtm3guJUjtGYqv8fdiHuXFvpUuBud8uoyN3Easab

export type AbyssNetwork = 'mainnet' | 'testnet'

export const ABYSS_PACKAGE_ID: Record<AbyssNetwork, string> = {
  mainnet: '0x90a75f641859f4d77a4349d67e518e1dd9ecb4fac079e220fa46b7a7f164e0a5',
  testnet: '', // Abyss vaults not yet on testnet
}

export const VAULT_REGISTRY_ID: Record<AbyssNetwork, string> = {
  mainnet: '0xfac1800074e8ed8eb2baf1e631e8199ccce6b0f6bfd50b5143e1ff47c438aecf',
  testnet: '',
}

export const ABYSS_SUPPLIER_CAP_ID: Record<AbyssNetwork, string> = {
  mainnet: '0x3d0faab3953525d243275b39cbed465cb310fe2d4dd2c15428b8f7cf5962c2c0',
  testnet: '',
}

// DeepBook v3 testnet addresses (confirmed from on-chain TX)
export const DEEPBOOK_PACKAGE_ID: Record<AbyssNetwork, string> = {
  mainnet: '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270',
  testnet: '0x22be4cade64bf2d02412c7e8d0e8beea2f78828b948118d46735315409371a3c',
}

export const DEEPBOOK_ORIGINAL_ID: Record<AbyssNetwork, string> = {
  mainnet: '',
  testnet: '0xfb28c4cbc6865bd1c897d26aecbe1f8792d1509a20ffec692c800660cbec6982',
}

export const CLOCK_ID = '0x6'

// Testnet token types
export const DBUSDC_TYPE_TESTNET =
  '0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC'

export interface PoolInfo {
  name: string
  baseType: string
  quoteType: string
  poolId: string
}

export const POOLS: Record<AbyssNetwork, PoolInfo[]> = {
  mainnet: [],
  testnet: [
    {
      name: 'SUI/DBUSDC',
      baseType: '0x2::sui::SUI',
      quoteType: DBUSDC_TYPE_TESTNET,
      poolId: '0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5',
    },
  ],
}

export interface VaultInfo {
  asset: string
  assetType: string
  atokenType: string
  vaultId: string
  marginPoolId: string
  referralId: string
}

export const VAULTS: Record<AbyssNetwork, VaultInfo[]> = {
  mainnet: [
    {
      asset: 'SUI',
      assetType: '0x2::sui::SUI',
      atokenType:
        '0x90a75f641859f4d77a4349d67e518e1dd9ecb4fac079e220fa46b7a7f164e0a5::abyss_vault::AToken<0x2::sui::SUI>',
      vaultId: '0x670c12c8ea3981be65b8b11915c2ba1832b4ebde160b03cd7790021920a8ce68',
      marginPoolId: '0x53041c6f86c4782aabbfc1d4fe234a6d37160310c7ee740c915f0a01b7127344',
      referralId: '0x695b391423801750827e0b99792a7cd5e41bee3d90b2af03fc99197938c6c98d',
    },
    {
      asset: 'USDC',
      assetType: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
      atokenType:
        '0x90a75f641859f4d77a4349d67e518e1dd9ecb4fac079e220fa46b7a7f164e0a5::abyss_vault::AToken<0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC>',
      vaultId: '0x86cd17116a5c1bc95c25296a901eb5ea91531cb8ba59d01f64ee2018a14d6fa5',
      marginPoolId: '0xba473d9ae278f10af75c50a8fa341e9c6a1c087dc91a3f23e8048baf67d0754f',
      referralId: '0xba436b3f0e57600e9318c2e03c51b940612d8b0d4df18ad9f31c203f95cad122',
    },
    {
      asset: 'DEEP',
      assetType: '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP',
      atokenType:
        '0x90a75f641859f4d77a4349d67e518e1dd9ecb4fac079e220fa46b7a7f164e0a5::abyss_vault::AToken<0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP>',
      vaultId: '0xec54bde40cf2261e0c5d9c545f51c67a9ae5a8add9969c7e4cdfe1d15d4ad92e',
      marginPoolId: '0x1d723c5cd113296868b55208f2ab5a905184950dd59c48eb7345607d6b5e6af7',
      referralId: '0x434c4d10328fe29206ae4c7a42869b07a4eb4619a48b8e502604287417fea220',
    },
    {
      asset: 'WAL',
      assetType: '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL',
      atokenType:
        '0x90a75f641859f4d77a4349d67e518e1dd9ecb4fac079e220fa46b7a7f164e0a5::abyss_vault::AToken<0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL>',
      vaultId: '0x09b367346a0fc3709e32495e8d522093746ddd294806beff7e841c9414281456',
      marginPoolId: '0x38decd3dbb62bd4723144349bf57bc403b393aee86a51596846a824a1e0c2c01',
      referralId: '0xb29d0f48cacbee7be4dab1524a0f995f41f33bd5fdb05492f69af85738dc6c56',
    },
  ],
  testnet: [],
}
