/**
 * Three-Protocol Margin Loop Tab
 * iron_bank → deepbook_margin → predict ranges
 *
 * Demo mode: iron_bank + margin steps are simulated (shown as completed).
 * Predict step executes real on-chain mint_range transactions.
 */

import { useState, useMemo, useCallback } from 'react'
import { Transaction } from '@mysten/sui/transactions'
import { simulateMarginLoop } from '../strategies'
import {
  PRICE_SCALE,
  PREDICT_PACKAGE,
  PREDICT_ID,
  PREDICT_SERVER,
  STRIKE_SCALE,
  DUSDC_DECIMALS,
  DUSDC_TYPE,
} from '../types'
import type { SuiHostAPI } from '../../../src/sui-dashboard/sui-types'
import { CollapsibleNotes, StepTree } from './shared'
import type { TreeStep } from './shared'

interface Props {
  oracleState: any
  sharedHost: SuiHostAPI | null
  walletAddress: string | null
  isConnected: boolean
  selectedOracle: string | null
}

export function MarginLoopTab({
  oracleState,
  sharedHost,
  walletAddress,
  isConnected,
  selectedOracle,
}: Props) {
  const [collateral, setCollateral] = useState('100')
  const [ltv, setLtv] = useState('70')
  const [numRanges, setNumRanges] = useState('3')
  const [rangeWidth, setRangeWidth] = useState('8')
  const [ironAPY, setIronAPY] = useState('5')
  const [borrowRate, setBorrowRate] = useState('8')
  const [predictReturn, setPredictReturn] = useState('30')

  // Execution state
  const [executing, setExecuting] = useState(false)
  const [execSteps, setExecSteps] = useState<TreeStep[]>([])
  const [execDone, setExecDone] = useState(false)

  const spotRaw = oracleState?.latest_price?.spot || 0
  const spot = spotRaw / PRICE_SCALE

  const result = useMemo(() => {
    if (!spotRaw) return null
    return simulateMarginLoop({
      collateral: Number(collateral) || 100,
      ironBankAPY: Number(ironAPY) || 5,
      marginBorrowRate: Number(borrowRate) || 8,
      ltv: (Number(ltv) || 70) / 100,
      numRanges: Number(numRanges) || 3,
      rangeWidthPct: Number(rangeWidth) || 8,
      spotRaw,
      expiryHours: 1,
      predictReturnPct: Number(predictReturn) || 30,
    })
  }, [collateral, ltv, numRanges, rangeWidth, ironAPY, borrowRate, predictReturn, spotRaw])

  // Execute the full loop
  const executeLoop = useCallback(async () => {
    if (!sharedHost || !walletAddress || !selectedOracle || !spot) return

    setExecuting(true)
    setExecDone(false)
    const ltvNum = (Number(ltv) || 70) / 100
    const collateralNum = Number(collateral) || 100
    const borrowAmount = collateralNum * ltvNum
    const nRanges = Number(numRanges) || 3
    const width = (Number(rangeWidth) || 8) / 100
    const capitalPerRange = borrowAmount / nRanges

    const steps: TreeStep[] = [
      {
        protocol: 'iron_bank',
        action: `Deposit ${collateralNum} DUSDC → USDsui shares`,
        status: 'pending',
      },
      {
        protocol: 'deepbook_margin',
        action: `Borrow ${borrowAmount.toFixed(0)} dUSDC at ${(ltvNum * 100).toFixed(0)}% LTV`,
        status: 'pending',
      },
    ]

    // Add predict range steps
    const halfWidth = (width * spot) / 2
    for (let i = 0; i < nRanges; i++) {
      const center = spot + (i - (nRanges - 1) / 2) * ((halfWidth * 2) / nRanges)
      const lower = Math.floor(center - halfWidth / nRanges)
      const upper = Math.ceil(center + halfWidth / nRanges)
      steps.push({
        protocol: 'predict',
        action: `Mint range [$${lower.toLocaleString()}, $${upper.toLocaleString()}] — ${capitalPerRange.toFixed(0)} DUSDC`,
        status: 'pending',
      })
    }

    setExecSteps([...steps])

    // Step 1: iron_bank (simulated)
    steps[0].status = 'executing'
    setExecSteps([...steps])
    await new Promise((r) => setTimeout(r, 1500))
    steps[0].status = 'simulated'
    steps[0].txDigest = '(simulated — iron_bank on mainnet only)'
    setExecSteps([...steps])

    // Step 2: deepbook_margin (simulated)
    steps[1].status = 'executing'
    setExecSteps([...steps])
    await new Promise((r) => setTimeout(r, 1500))
    steps[1].status = 'simulated'
    steps[1].txDigest = '(simulated — deepbook_margin on mainnet only)'
    setExecSteps([...steps])

    // Step 3: Create PredictManager (separate TX — need object ID for PTB)
    let managerObjectId: string | null = null

    const createMgrStep: TreeStep = {
      protocol: 'predict',
      action: 'Create PredictManager (shared object)',
      status: 'executing',
    }
    steps.splice(2, 0, createMgrStep)
    setExecSteps([...steps])

    try {
      const txMgr = new Transaction()
      txMgr.setSender(walletAddress)
      txMgr.moveCall({ target: `${PREDICT_PACKAGE}::predict::create_manager` })
      const mgrResult = await sharedHost.signAndExecuteTransaction(txMgr)
      steps[2].status = 'done'
      steps[2].txDigest = mgrResult.digest

      await new Promise((r) => setTimeout(r, 2000))
      try {
        const mgrsRes = await fetch(`${PREDICT_SERVER}/managers`)
        const mgrs = await mgrsRes.json()
        const myMgr = (mgrs as any[]).find((m: any) => m.owner === walletAddress)
        if (myMgr) managerObjectId = myMgr.manager_id
      } catch {
        /* fallback below */
      }

      if (!managerObjectId) {
        steps[2].error = 'Manager created but ID not found. Try again.'
        steps[2].status = 'error'
        setExecSteps([...steps])
        setExecuting(false)
        return
      }
    } catch (e) {
      steps[2].status = 'error'
      steps[2].error = e instanceof Error ? e.message : String(e)
      setExecSteps([...steps])
      setExecuting(false)
      return
    }
    setExecSteps([...steps])

    // Step 4: Single PTB — deposit + all mint_range calls in one atomic transaction
    const ptbStep: TreeStep = {
      protocol: 'predict',
      action: `PTB: Deposit ${borrowAmount.toFixed(0)} DUSDC + Mint ${nRanges} ranges (atomic)`,
      status: 'executing',
    }
    steps.splice(3, 0, ptbStep)
    // Mark all remaining range steps as part of the PTB
    for (let i = 4; i < steps.length; i++) {
      steps[i].status = 'executing'
    }
    setExecSteps([...steps])

    try {
      // Fetch DUSDC coins
      const coinsRes = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getCoins',
          params: [walletAddress, DUSDC_TYPE, null, 50],
        }),
      })
      const coinsData = (await coinsRes.json()) as {
        result?: { data: { coinObjectId: string; balance: string }[] }
      }
      const dusdc_coins = coinsData.result?.data || []

      if (dusdc_coins.length === 0) {
        steps[3].status = 'error'
        steps[3].error = 'No DUSDC coins in wallet. Request from faucet.'
        setExecSteps([...steps])
        setExecuting(false)
        return
      }

      // Build single PTB: merge coins → split → deposit → mint_range × N
      const tx = new Transaction()
      tx.setSender(walletAddress)

      const totalDepositRaw = Math.floor(borrowAmount * 10 ** DUSDC_DECIMALS)
      const primaryCoin = dusdc_coins[0].coinObjectId
      if (dusdc_coins.length > 1) {
        tx.mergeCoins(
          tx.object(primaryCoin),
          dusdc_coins.slice(1).map((c) => tx.object(c.coinObjectId)),
        )
      }

      // Split exact deposit amount
      const [depositCoin] = tx.splitCoins(tx.object(primaryCoin), [tx.pure.u64(totalDepositRaw)])

      // Command: Deposit into PredictManager
      tx.moveCall({
        target: `${PREDICT_PACKAGE}::predict_manager::deposit`,
        typeArguments: [DUSDC_TYPE],
        arguments: [tx.object(managerObjectId!), depositCoin],
      })

      // Commands: mint_range × N (all chained in same PTB)
      const expiry = oracleState?.oracle?.expiry || 0
      for (let i = 0; i < nRanges; i++) {
        const center = spot + (i - (nRanges - 1) / 2) * ((halfWidth * 2) / nRanges)
        const lower = Math.floor(center - halfWidth / nRanges)
        const upper = Math.ceil(center + halfWidth / nRanges)
        const lowerRaw = Math.floor(lower * STRIKE_SCALE)
        const upperRaw = Math.floor(upper * STRIKE_SCALE)
        const amountRaw = Math.floor(capitalPerRange * 10 ** DUSDC_DECIMALS)

        const [rangeKey] = tx.moveCall({
          target: `${PREDICT_PACKAGE}::range_key::new`,
          arguments: [
            tx.pure.id(selectedOracle),
            tx.pure.u64(expiry),
            tx.pure.u64(lowerRaw),
            tx.pure.u64(upperRaw),
          ],
        })

        tx.moveCall({
          target: `${PREDICT_PACKAGE}::predict::mint_range`,
          typeArguments: [DUSDC_TYPE],
          arguments: [
            tx.object(PREDICT_ID),
            tx.object(managerObjectId!),
            tx.object(selectedOracle),
            rangeKey,
            tx.pure.u64(amountRaw),
            tx.object.clock(),
          ],
        })
      }

      // Execute single atomic PTB
      const ptbResult = await sharedHost.signAndExecuteTransaction(tx)
      steps[3].status = 'done'
      steps[3].txDigest = ptbResult.digest
      // Mark all range steps as done
      for (let i = 4; i < steps.length; i++) {
        steps[i].status = 'done'
        steps[i].txDigest = ptbResult.digest
      }
      setExecSteps([...steps])
    } catch (e) {
      steps[3].status = 'error'
      steps[3].error = e instanceof Error ? e.message : String(e)
      for (let i = 4; i < steps.length; i++) {
        steps[i].status = 'error'
      }
      setExecSteps([...steps])
    }

    setExecuting(false)
    setExecDone(true)
  }, [
    sharedHost,
    walletAddress,
    selectedOracle,
    spot,
    collateral,
    ltv,
    numRanges,
    rangeWidth,
    oracleState,
  ])

  return (
    <div className="sui-predict__grid">
      {/* Config — TOP */}
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">Margin Loop Configuration</h3>
          {spot > 0 && (
            <span className="sui-predict__stat-value--mono">Spot: ${spot.toFixed(0)}</span>
          )}
        </div>
        <div
          className="sui-predict__form"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}
        >
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Collateral (DUSDC)</label>
            <input
              className="sui-predict__input"
              type="number"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">LTV %</label>
            <input
              className="sui-predict__input"
              type="number"
              min="30"
              max="80"
              value={ltv}
              onChange={(e) => setLtv(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Ranges</label>
            <input
              className="sui-predict__input"
              type="number"
              min="1"
              max="10"
              value={numRanges}
              onChange={(e) => setNumRanges(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Width %</label>
            <input
              className="sui-predict__input"
              type="number"
              min="2"
              max="20"
              value={rangeWidth}
              onChange={(e) => setRangeWidth(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">iron_bank APY%</label>
            <input
              className="sui-predict__input"
              type="number"
              value={ironAPY}
              onChange={(e) => setIronAPY(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Borrow Rate%</label>
            <input
              className="sui-predict__input"
              type="number"
              value={borrowRate}
              onChange={(e) => setBorrowRate(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Predict Return%</label>
            <input
              className="sui-predict__input"
              type="number"
              value={predictReturn}
              onChange={(e) => setPredictReturn(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Execute — immediately after config */}
      <div className="sui-predict__card sui-predict__card--wide">
        {!isConnected ? (
          <div className="sui-predict__empty">
            <p>Connect wallet to execute the margin loop</p>
            <button type="button" className="sui-predict__btn" onClick={() => sharedHost?.requestConnect()}>
              Connect Wallet
            </button>
          </div>
        ) : (
          <div>
            <div className="sui-predict__trade-info">
              <span>
                Wallet: {walletAddress?.slice(0, 8)}…{walletAddress?.slice(-4)}
              </span>
              <span>Oracle: {oracleState?.oracle?.underlying_asset || '—'}</span>
              <span>Network: Testnet</span>
            </div>
            <button type="button"
              className="sui-predict__btn sui-predict__btn--full"
              onClick={executeLoop}
              disabled={executing || !selectedOracle}
            >
              {executing
                ? 'Executing…'
                : execDone
                  ? '↻ Execute Again'
                  : '▶ Execute Full Loop (Demo)'}
            </button>
          </div>
        )}
      </div>

      {/* Step Tree — execution progress */}
      <StepTree steps={execSteps} title="Execution Flow" />

      {/* Simulation results */}
      {result && (
        <>
          <div className="sui-predict__card sui-predict__card--wide">
            <div className="sui-predict__card-header">
              <h3 className="sui-predict__card-title">Simulation Metrics</h3>
            </div>
            <div className="sui-predict__stats">
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Leverage</span>
                <span className="sui-predict__stat-value">{result.leverage.toFixed(2)}×</span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Exposure</span>
                <span className="sui-predict__stat-value">${result.totalExposure.toFixed(0)}</span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Best APY</span>
                <span className="sui-predict__stat-value sui-predict__stat-value--green">
                  {result.bestCaseAPY.toFixed(1)}%
                </span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Worst APY</span>
                <span className="sui-predict__stat-value sui-predict__stat-value--red">
                  {result.worstCaseAPY.toFixed(1)}%
                </span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Liq. Price</span>
                <span className="sui-predict__stat-value">
                  ${result.liquidationPrice.toFixed(0)}
                </span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Worst LTV</span>
                <span
                  className={`sui-predict__stat-value ${result.worstCaseLTV > 0.85 ? 'sui-predict__stat-value--red' : ''}`}
                >
                  {(result.worstCaseLTV * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="sui-predict__card sui-predict__card--wide">
            <div className="sui-predict__card-header">
              <h3 className="sui-predict__card-title">PnL & LTV Scenarios</h3>
            </div>
            <div className="sui-predict__table">
              <div className="sui-predict__table-header sui-predict__table-header--4col">
                <span>BTC Move</span>
                <span>PnL</span>
                <span>LTV</span>
                <span>Status</span>
              </div>
              {result.scenarios.map((s, i) => (
                <div key={i} className="sui-predict__table-row sui-predict__table-row--4col">
                  <span>
                    {s.move >= 0 ? '+' : ''}
                    {s.move}%
                  </span>
                  <span
                    className={s.pnl >= 0 ? 'sui-predict__text--green' : 'sui-predict__text--red'}
                  >
                    ${s.pnl.toFixed(0)}
                  </span>
                  <span className={s.ltv > 0.85 ? 'sui-predict__text--red' : ''}>
                    {(s.ltv * 100).toFixed(1)}%
                  </span>
                  <span
                    className={`sui-predict__badge ${s.liquidated ? 'sui-predict__badge--red' : 'sui-predict__badge--green'}`}
                  >
                    {s.liquidated ? 'LIQUIDATED' : 'SAFE'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Notes — BOTTOM, collapsible */}
      <CollapsibleNotes title="How it works">
        <h4>Strategy</h4>
        <p>Stack three Sui DeFi protocols in a single composable flow:</p>
        <ol>
          <li>
            <strong>iron_bank</strong>: Deposit USDC → receive USDsui share token (earn yield)
          </li>
          <li>
            <strong>deepbook_margin</strong>: Collateralize USDsui → borrow dUSDC (leverage)
          </li>
          <li>
            <strong>predict</strong>: Deploy dUSDC into range positions (earn prediction payouts)
          </li>
        </ol>
        <p className="sui-predict__formula">
          PTB = [iron_bank::deposit, margin::borrow, predict::mint_range × N]
        </p>
        <h4>Demo Mode</h4>
        <p>
          Steps 1-2 are <b>simulated</b> (iron_bank + margin are mainnet-only). Step 3 executes{' '}
          <b>real on-chain</b> predict::mint_range transactions on testnet.
        </p>
      </CollapsibleNotes>
    </div>
  )
}
