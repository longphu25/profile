import { useState } from 'react'
import type { Direction } from '../../domain/types'
import { formatCompactDusdc } from '../shared'
import { FLOW_STEPS, useActionModel } from './useActionModel'

/**
 * Docked action rail (C2): the single action path, docked beside the king chart.
 *
 * Exactly one element is ever the primary CTA (decision 6 of plan 22). The dock
 * reads its entire model from `useActionModel` (the shared seam) so a future
 * casual "lite mode" reuses the same phase logic. On the execute phase it shows
 * two distinct-color one-tap UP / DOWN buttons (color + icon + text, never color
 * alone); every other phase shows the single phase CTA from context.
 */

function DirectionButton({
  dir,
  submitting,
  disabled,
  onClick,
}: {
  dir: Direction
  submitting: boolean
  disabled: boolean
  onClick: () => void
}) {
  const up = dir === 'UP'
  return (
    <button
      type="button"
      data-pc-action={up ? 'submit-up' : 'submit-down'}
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex h-16 flex-col items-center justify-center gap-0.5 rounded-lg font-headline transition-transform active:scale-[0.97]',
        disabled && !submitting
          ? 'cursor-not-allowed bg-surface-variant text-on-surface-variant opacity-60'
          : up
            ? 'bg-primary-fixed-dim text-on-primary-fixed hover:bg-primary-container'
            : 'bg-[#ff5d73] text-[#2a0008] hover:brightness-110',
      ].join(' ')}
      aria-label={up ? 'Predict up, execute now' : 'Predict down, execute now'}
    >
      <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
        {submitting ? 'progress_activity' : up ? 'trending_up' : 'trending_down'}
      </span>
      <span className="text-headline-md font-black leading-none">{up ? 'UP' : 'DOWN'}</span>
    </button>
  )
}

export function ActionDock({ className = '' }: { className?: string }) {
  const model = useActionModel()
  const [submitting, setSubmitting] = useState<Direction | null>(null)

  async function submit(dir: Direction) {
    if (submitting) return
    setSubmitting(dir)
    try {
      await model.execute(dir)
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <section
      data-pc-rail
      aria-label="Next action"
      className={`flex min-h-0 flex-col gap-sm overflow-y-auto bg-surface-container p-md ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-sm">
        <span
          className="material-symbols-outlined text-[18px] text-primary-fixed-dim"
          aria-hidden="true"
        >
          bolt
        </span>
        <h2 className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
          Next Action
        </h2>
      </div>

      {/* Guided flow breadcrumb */}
      <ol className="flex flex-wrap items-center gap-1" aria-label="Round flow">
        {FLOW_STEPS.map((s, i) => {
          const active = i === model.stepIndex
          const done = i < model.stepIndex
          return (
            <li key={s} className="flex shrink-0 items-center gap-1">
              <span
                className={[
                  'rounded-sm px-xs py-[2px] font-label text-label-caps uppercase tracking-wider transition-colors',
                  active
                    ? 'bg-primary-fixed-dim text-on-primary-fixed'
                    : done
                      ? 'text-primary-fixed-dim'
                      : 'text-on-surface-variant/50',
                ].join(' ')}
              >
                {s}
              </span>
              {i < FLOW_STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={done ? 'text-primary-fixed-dim' : 'text-outline-variant'}
                >
                  ›
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {/* Economics readout (real round numbers) */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-outline-variant">
        <div className="flex flex-col gap-0.5 bg-surface-container-low px-md py-sm">
          <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant/70">
            Suggested
          </dt>
          <dd className="font-data text-data-md font-bold tabular-nums text-on-surface">
            {formatCompactDusdc(model.suggestedDusdc)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 bg-surface-container-low px-md py-sm">
          <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant/70">
            Pledged
          </dt>
          <dd className="font-data text-data-md font-bold tabular-nums text-primary-fixed-dim">
            {formatCompactDusdc(model.pledgedDusdc)}
          </dd>
        </div>
      </dl>

      {/* The action surface */}
      {model.isExecute ? (
        <div className="flex flex-col gap-sm">
          <div className="grid grid-cols-2 gap-sm">
            <DirectionButton
              dir="UP"
              submitting={submitting === 'UP'}
              disabled={submitting !== null || model.blocked}
              onClick={() => submit('UP')}
            />
            <DirectionButton
              dir="DOWN"
              submitting={submitting === 'DOWN'}
              disabled={submitting !== null || model.blocked}
              onClick={() => submit('DOWN')}
            />
          </div>
          {model.blocked && model.reasons.length > 0 && (
            <ul className="flex flex-col gap-1" aria-label="Blocking reasons">
              {model.reasons.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start gap-1 font-data text-data-sm text-on-surface-variant"
                >
                  <span
                    className={[
                      'material-symbols-outlined mt-[1px] text-[14px]',
                      r.severity === 'blocking' ? 'text-error' : 'text-tertiary-fixed-dim',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {r.severity === 'blocking' ? 'error' : 'warning'}
                  </span>
                  <span>{r.message ?? r.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button
          type="button"
          data-pc-action={model.step === 'Connect' ? 'connect' : 'primary'}
          onClick={model.action}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary-fixed-dim font-headline text-headline-md text-on-primary-fixed transition-colors hover:bg-primary-container active:scale-[0.98]"
        >
          {model.label}
        </button>
      )}
    </section>
  )
}
