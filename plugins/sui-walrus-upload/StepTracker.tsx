// Step progress tracker component

interface StepTrackerProps {
  steps: string[]
  currentStep: string
  detail: string
}

const LABELS: Record<string, string> = {
  'check-wal': 'Check WAL balance',
  'acquire-wal': 'Acquire WAL',
  encode: 'Encode file',
  register: 'Register blob (sign)',
  upload: 'Upload slivers',
  certify: 'Certify blob (sign)',
  uploading: 'Uploading to publisher',
  done: 'Done',
}

export function StepTracker({ steps, currentStep, detail }: StepTrackerProps) {
  const currentIdx = steps.indexOf(currentStep)
  const pct = Math.round(((currentIdx + 1) / steps.length) * 100)

  return (
    <div className="sui-wup__steps">
      {steps.map((sid, i) => {
        const isCurrent = currentStep === sid
        const isDone = i < currentIdx
        return (
          <div
            key={sid}
            className={`sui-wup__step ${isCurrent ? 'sui-wup__step--active' : ''} ${isDone ? 'sui-wup__step--done' : ''}`}
          >
            <span className="sui-wup__step-icon">{isDone ? '✓' : isCurrent ? '⏳' : '○'}</span>
            <span className="sui-wup__step-label">{LABELS[sid] ?? sid}</span>
          </div>
        )
      })}
      {detail && <div className="sui-wup__step-detail">{detail}</div>}
      <div className="sui-wup__progress">
        <div className="sui-wup__progress-bar">
          <div className="sui-wup__progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}
