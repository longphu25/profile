import { usePredictClub } from './PredictClubContext'

export function PredictionRoomPanel() {
  const { club } = usePredictClub()
  const round = club.activeRound

  return (
    <>
      <div className="p-md border-b border-outline-variant bg-surface-container-high flex justify-between items-center">
        <h2 className="font-headline text-headline-md text-primary flex items-center gap-2">
          <span className="material-symbols-outlined">analytics</span> Prediction Room
        </h2>
        <div className="flex items-center gap-sm">
          <div className="px-sm py-1 bg-surface-container border border-outline-variant rounded font-label text-label-caps text-on-surface-variant">
            Phase: {round.status.toUpperCase()}
          </div>
          <div className="px-sm py-1 bg-surface-container border border-outline-variant rounded font-label text-label-caps text-tertiary-fixed-dim">
            {round.id}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-md flex flex-col gap-md">
        {/* Thesis */}
        <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl relative overflow-hidden hover-lift cursor-pointer">
          <div className="absolute top-0 left-0 w-1 h-full bg-secondary-fixed" />
          <div className="flex justify-between items-start mb-2 ml-3">
            <span className="font-label text-label-caps text-secondary-fixed uppercase tracking-wider">
              Leader Thesis
            </span>
            <span className="font-data text-data-sm text-on-surface-variant">12m ago</span>
          </div>
          <p className="font-body text-body-base text-on-surface ml-3 leading-relaxed">
            {round.thesis}
          </p>
          <div className="flex gap-md mt-3 ml-3">
            <span className="font-data text-data-sm text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">thumb_up</span> 8
            </span>
            <span className="font-data text-data-sm text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">chat_bubble</span> 3
            </span>
          </div>
        </div>

        {/* Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-outline-variant rounded-xl overflow-hidden border border-outline-variant">
          {round.indicators.slice(0, 4).map((ind) => (
            <div
              key={ind.id}
              className="bg-surface-container p-sm flex flex-col justify-center items-center gap-1 hover:bg-surface-bright transition-colors cursor-pointer"
            >
              <span className="font-label text-label-caps text-on-surface-variant uppercase">
                {ind.name}
              </span>
              <span
                className={`font-data text-data-md font-bold ${
                  ind.state === 'bullish'
                    ? 'text-primary-fixed-dim'
                    : ind.state === 'bearish'
                      ? 'text-error'
                      : 'text-on-surface-variant'
                }`}
              >
                {ind.value}
              </span>
            </div>
          ))}
        </div>

        {/* Chart placeholder */}
        <div className="flex-1 min-h-[220px] border border-outline-variant bg-surface-container-lowest rounded-xl flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 chart-grid" />
          <svg
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="none"
            viewBox="0 0 400 200"
          >
            <polyline
              fill="none"
              stroke="#00e0b3"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.6"
              points="0,140 30,135 60,130 90,145 120,120 150,125 180,110 210,115 240,100 270,95 300,105 330,90 360,85 400,80"
            />
            <polygon
              fill="url(#mintGradient)"
              opacity="0.15"
              points="0,140 30,135 60,130 90,145 120,120 150,125 180,110 210,115 240,100 270,95 300,105 330,90 360,85 400,80 400,200 0,200"
            />
            <defs>
              <linearGradient id="mintGradient2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00e0b3" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#00e0b3" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <span className="font-data text-data-sm text-on-surface-variant relative z-10 flex flex-col items-center gap-2 opacity-60">
            <span className="material-symbols-outlined text-3xl">candlestick_chart</span>
            DeepBook Order Flow
          </span>
        </div>
      </div>
    </>
  )
}
