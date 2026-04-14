// Upload mode selector component

import type { UploadMode } from './config'

interface ModeSelectorProps {
  mode: UploadMode
  onChange: (mode: UploadMode) => void
}

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="sui-wup__modes">
      <button
        className={`sui-wup__mode ${mode === 'publisher' ? 'sui-wup__mode--active' : ''}`}
        onClick={() => onChange('publisher')}
      >
        <div className="sui-wup__mode-title">📡 Publisher</div>
        <div className="sui-wup__mode-desc">Fast · No signing · No WAL needed</div>
        <div className="sui-wup__mode-note">Publisher owns blob object</div>
      </button>
      <button
        className={`sui-wup__mode ${mode === 'direct' ? 'sui-wup__mode--active' : ''}`}
        onClick={() => onChange('direct')}
      >
        <div className="sui-wup__mode-title">🔐 Direct</div>
        <div className="sui-wup__mode-desc">You own blob · WASM encoding</div>
        <div className="sui-wup__mode-note">Needs WAL + 2 wallet signatures</div>
      </button>
    </div>
  )
}
