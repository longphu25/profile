/**
 * Shared UI components for the Predict plugin:
 * - CollapsibleNotes: expandable footer for documentation/formulas
 * - StepTree: visual tree map for execution steps
 */

import { useState } from 'react'

// ── CollapsibleNotes ─────────────────────────────────────────────────────────

interface CollapsibleNotesProps {
  title?: string
  children: React.ReactNode
}

export function CollapsibleNotes({ title = 'Documentation', children }: CollapsibleNotesProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="sui-predict__card sui-predict__card--wide sui-predict__notes">
      <button className="sui-predict__notes-toggle" onClick={() => setOpen(!open)} type="button">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`sui-predict__notes-arrow ${open ? 'sui-predict__notes-arrow--open' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
        <span className="sui-predict__notes-title">{title}</span>
      </button>
      <div className={`sui-predict__notes-body ${open ? 'sui-predict__notes-body--open' : ''}`}>
        <div className="sui-predict__info-text">{children}</div>
      </div>
    </div>
  )
}

// ── StepTree ─────────────────────────────────────────────────────────────────

export interface TreeStep {
  protocol: string
  action: string
  status: 'pending' | 'executing' | 'done' | 'error' | 'simulated'
  txDigest?: string
  error?: string
}

interface StepTreeProps {
  steps: TreeStep[]
  title?: string
}

export function StepTree({ steps, title = 'Execution Flow' }: StepTreeProps) {
  if (steps.length === 0) return null

  const doneCount = steps.filter((s) => s.status === 'done' || s.status === 'simulated').length
  const hasError = steps.some((s) => s.status === 'error')
  const isRunning = steps.some((s) => s.status === 'executing')

  return (
    <div className="sui-predict__card sui-predict__card--wide">
      <div className="sui-predict__card-header">
        <h3 className="sui-predict__card-title">{title}</h3>
        <span
          className={`sui-predict__badge ${hasError ? 'sui-predict__badge--red' : doneCount === steps.length ? 'sui-predict__badge--green' : isRunning ? 'sui-predict__badge--yellow' : 'sui-predict__badge--gray'}`}
        >
          {hasError
            ? 'ERROR'
            : doneCount === steps.length
              ? 'COMPLETE'
              : isRunning
                ? 'RUNNING'
                : `${doneCount}/${steps.length}`}
        </span>
      </div>
      <div className="sui-predict__step-tree">
        {steps.map((step, i) => (
          <div key={i} className="sui-predict__step-tree-item">
            {/* Connector line */}
            <div className="sui-predict__step-tree-rail">
              <div
                className={`sui-predict__step-tree-dot sui-predict__step-tree-dot--${step.status}`}
              >
                {step.status === 'done'
                  ? '✓'
                  : step.status === 'simulated'
                    ? '◐'
                    : step.status === 'error'
                      ? '✕'
                      : step.status === 'executing'
                        ? '◌'
                        : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`sui-predict__step-tree-line ${steps[i + 1].status !== 'pending' ? 'sui-predict__step-tree-line--active' : ''}`}
                />
              )}
            </div>
            {/* Content */}
            <div className="sui-predict__step-tree-content">
              <div className="sui-predict__step-tree-header">
                <span className="sui-predict__step-tree-protocol">{step.protocol}</span>
                <span
                  className={`sui-predict__step-tree-status sui-predict__step-tree-status--${step.status}`}
                >
                  {step.status}
                </span>
              </div>
              <div className="sui-predict__step-tree-action">{step.action}</div>
              {step.txDigest && (
                <div className="sui-predict__step-tree-tx">
                  {step.status === 'simulated'
                    ? step.txDigest
                    : `TX: ${step.txDigest.slice(0, 20)}…`}
                </div>
              )}
              {step.error && <div className="sui-predict__step-tree-error">{step.error}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
