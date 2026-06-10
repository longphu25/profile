import { usePredictClub } from './usePredictClub'
import { formatUsd, labelize } from './shared'

export function ClubPanel() {
  const { club, currentMember } = usePredictClub()

  const pledgedCount = club.members.filter(
    (m) => m.state === 'pledged' || m.state === 'accepted' || m.state === 'executed',
  ).length

  return (
    <>
      <div className="p-md border-b border-outline-variant bg-surface-container-high">
        <h2 className="font-headline text-headline-md text-primary">{club.name}</h2>
        <div className="flex items-center gap-sm mt-1 text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px]">military_tech</span>
          <span className="font-data text-data-sm">
            Leader: <span className="text-secondary-fixed">{club.leaderName}</span>
          </span>
        </div>
      </div>
      <div className="p-xs bg-surface-container-highest border-b border-outline-variant flex justify-between items-center px-md">
        <span className="font-label text-label-caps text-on-surface-variant">
          Members ({club.members.length})
        </span>
        <span className="font-label text-label-caps text-on-surface-variant">
          {pledgedCount} committed
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="flex flex-col" role="list">
          {club.members.map((member) => {
            const isCurrentMember = member.id === currentMember?.id
            return (
              <li
                key={member.id}
                className={`flex items-center justify-between p-md border-b border-outline-variant/50 hover:bg-surface-bright transition-colors cursor-pointer ${
                  isCurrentMember
                    ? 'bg-primary-fixed-dim/5 border-l-2 border-l-primary-fixed-dim'
                    : ''
                }`}
              >
                <div className="flex items-center gap-sm">
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center font-data text-data-sm border ${
                      isCurrentMember
                        ? 'bg-primary-fixed-dim text-on-primary-fixed border-primary-fixed-dim'
                        : 'bg-surface-container-highest text-on-surface-variant border-outline-variant'
                    }`}
                  >
                    {member.name.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-data text-data-sm flex items-center gap-xs">
                      {member.name}
                      {isCurrentMember && (
                        <span className="font-label text-[9px] uppercase text-primary-fixed-dim">
                          You
                        </span>
                      )}
                    </span>
                    {member.pledgedDusdc > 0 && (
                      <span className="font-data text-[11px] text-on-surface-variant">
                        {formatUsd(member.pledgedDusdc)} DUSDC
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-sm">
                  {member.accepted && (
                    <span className="material-symbols-outlined text-[14px] text-primary-fixed-dim">
                      handshake
                    </span>
                  )}
                  {member.state === 'executed' && (
                    <span className="material-symbols-outlined text-[14px] text-secondary-fixed">
                      done_all
                    </span>
                  )}
                  <span
                    className={`font-data text-data-sm ${
                      member.state === 'pledged' ||
                      member.state === 'accepted' ||
                      member.state === 'executed'
                        ? 'text-primary-fixed-dim'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    {labelize(member.state)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      <div className="p-sm border-t border-outline-variant bg-surface-container-high flex justify-between items-center">
        <span className="font-data text-data-sm text-on-surface-variant">Win Rate</span>
        <span className="font-data text-data-sm text-primary-fixed-dim tabular-nums">68.2%</span>
      </div>
      {/* Leader Thesis */}
      <div className="p-md border-t border-outline-variant">
        <div className="bg-surface-container-lowest border border-outline-variant p-sm rounded-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-secondary-fixed" />
          <div className="flex justify-between items-start mb-1 ml-3">
            <span className="font-label text-label-caps text-secondary-fixed uppercase tracking-wider">
              Leader Thesis
            </span>
            <span className="font-data text-[10px] text-on-surface-variant">12m ago</span>
          </div>
          <p className="font-body text-body-sm text-on-surface ml-3 leading-relaxed m-0">
            {club.activeRound.thesis}
          </p>
        </div>
      </div>
    </>
  )
}
