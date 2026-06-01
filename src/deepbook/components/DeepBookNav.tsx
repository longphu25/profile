import { NAV_GROUPS, type NavGroup } from '../config/nav'

interface DeepBookNavProps {
  activeGroup: NavGroup
  onGroupClick: (group: NavGroup) => void
}

export function DeepBookDesktopNav({ activeGroup, onGroupClick }: DeepBookNavProps) {
  return (
    <nav className="hidden md:flex items-center gap-0.5">
      {NAV_GROUPS.map((group) => (
        <button
          type="button"
          key={group.id}
          onClick={() => onGroupClick(group.id)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
          style={{
            background: activeGroup === group.id ? 'rgba(128,255,213,0.12)' : 'transparent',
            color: activeGroup === group.id ? 'var(--color-mint)' : 'var(--color-muted)',
            border:
              activeGroup === group.id
                ? '1px solid rgba(128,255,213,0.2)'
                : '1px solid transparent',
          }}
        >
          {group.label}
        </button>
      ))}
    </nav>
  )
}

export function DeepBookMobileNav({ activeGroup, onGroupClick }: DeepBookNavProps) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2"
      style={{
        background: 'var(--color-panel)',
        borderTop: '1px solid var(--color-line)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {NAV_GROUPS.slice(0, 6).map((group) => (
        <button
          type="button"
          key={group.id}
          onClick={() => onGroupClick(group.id)}
          className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg cursor-pointer transition-all"
          style={{ color: activeGroup === group.id ? 'var(--color-mint)' : 'var(--color-muted)' }}
        >
          <span className="text-base leading-none">{group.icon}</span>
          <span className="text-[9px] font-medium">{group.label}</span>
        </button>
      ))}
    </nav>
  )
}
