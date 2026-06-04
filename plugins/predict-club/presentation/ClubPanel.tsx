import { usePredictClub } from './PredictClubContext'
import { labelize } from './shared'

export function ClubPanel() {
  const { club } = usePredictClub()

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
        <span className="font-label text-label-caps text-on-surface-variant">Status</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="flex flex-col" role="list">
          {club.members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between p-md border-b border-outline-variant/50 hover:bg-surface-bright transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-sm">
                <div className="w-6 h-6 rounded bg-surface-container-highest flex items-center justify-center font-data text-data-sm text-on-surface-variant border border-outline-variant">
                  {member.name.charAt(0)}
                </div>
                <span className="font-data text-data-sm">{member.name}</span>
              </div>
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
            </li>
          ))}
        </ul>
      </div>
      <div className="p-sm border-t border-outline-variant bg-surface-container-high flex justify-between items-center">
        <span className="font-data text-data-sm text-on-surface-variant">Win Rate</span>
        <span className="font-data text-data-sm text-primary-fixed-dim tabular-nums">68.2%</span>
      </div>
    </>
  )
}
