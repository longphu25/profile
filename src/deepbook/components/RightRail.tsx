interface RightRailProps {
  activePlugin: string
  address: string | null
  network: string
  isConnected: boolean
  questsDone: number
  questTotal: number
  onConnect: () => void
  onSelectPlugin: (id: string) => void
  onShowRewards: () => void
}

const fmtAddr = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

export function RightRail({
  activePlugin,
  address,
  network,
  isConnected,
  questsDone,
  questTotal,
  onConnect,
  onSelectPlugin,
  onShowRewards,
}: RightRailProps) {
  return (
    <aside className="hidden xl:flex flex-col gap-3 w-52 shrink-0 pt-1">
      <div
        className="rounded-xl p-3"
        style={{ background: 'rgba(8,24,25,0.82)', border: '1px solid var(--color-line)' }}
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-widest mb-2"
          style={{ color: 'var(--color-muted)' }}
        >
          Wallet
        </p>
        {isConnected && address ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-mono" style={{ color: 'var(--color-mint)' }}>
              {fmtAddr(address)}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
              {network} · Connected
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="w-full py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            style={{ background: 'var(--color-mint)', color: 'var(--color-ink)' }}
          >
            Connect Wallet
          </button>
        )}
      </div>

      <div
        className="rounded-xl p-3"
        style={{ background: 'rgba(8,24,25,0.82)', border: '1px solid var(--color-line)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--color-muted)' }}
          >
            Daily Quests
          </p>
          <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
            {questsDone}/{questTotal}
          </span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden mb-2"
          style={{ background: 'rgba(190,255,234,0.1)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(questsDone / questTotal) * 100}%`,
              background: 'var(--color-mint)',
            }}
          />
        </div>
        <button
          type="button"
          onClick={onShowRewards}
          className="text-[10px] cursor-pointer transition-all"
          style={{ color: 'var(--color-teal)' }}
        >
          View quests →
        </button>
      </div>

      <div
        className="rounded-xl p-3"
        style={{ background: 'rgba(8,24,25,0.82)', border: '1px solid var(--color-line)' }}
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-widest mb-2"
          style={{ color: 'var(--color-muted)' }}
        >
          Quick Links
        </p>
        <div className="flex flex-col gap-1">
          {[
            { label: 'Predict', id: 'predict' },
            { label: 'Portfolio', id: 'portfolio' },
            { label: 'Swap', id: 'swap' },
          ].map((link) => (
            <button
              type="button"
              key={link.id}
              onClick={() => onSelectPlugin(link.id)}
              className="text-left text-xs py-1 cursor-pointer transition-all"
              style={{
                color: activePlugin === link.id ? 'var(--color-mint)' : 'var(--color-muted)',
              }}
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
