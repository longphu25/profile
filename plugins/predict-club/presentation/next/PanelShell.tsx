import { useState, type ReactNode } from 'react'

type PanelShellProps = {
  title?: ReactNode
  icon?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  /** Render the 1px outer border. Off when the parent grid supplies a gutter. */
  bordered?: boolean
  collapsible?: boolean
  defaultCollapsed?: boolean
}

/** Shared panel chrome for the redesigned surface: header (icon + caps title +
 * actions) with a distinct bottom border, plus a scrollable body. Panels never
 * re-implement their own border/header — they compose this. */
export function PanelShell({
  title,
  icon,
  actions,
  children,
  className = '',
  bodyClassName = '',
  bordered = true,
  collapsible = false,
  defaultCollapsed = false,
}: PanelShellProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const hasHeader = title != null || icon != null || actions != null || collapsible

  return (
    <section
      className={`flex flex-col min-h-0 bg-surface-container ${
        bordered ? 'border border-outline-variant' : ''
      } ${className}`}
    >
      {hasHeader && (
        <header className="flex items-center justify-between gap-sm px-md py-sm bg-surface-container-high border-b border-outline-variant shrink-0">
          <div className="flex items-center gap-sm min-w-0">
            {icon && (
              <span
                className="material-symbols-outlined text-[18px] text-primary-fixed-dim"
                aria-hidden="true"
              >
                {icon}
              </span>
            )}
            {title && (
              <h2 className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant truncate">
                {title}
              </h2>
            )}
          </div>
          <div className="flex items-center gap-xs shrink-0">
            {actions}
            {collapsible && (
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-primary-fixed-dim transition-colors cursor-pointer"
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
              >
                {collapsed ? 'expand_more' : 'expand_less'}
              </button>
            )}
          </div>
        </header>
      )}
      {!collapsed && (
        <div className={`flex-1 min-h-0 overflow-auto p-md ${bodyClassName}`}>{children}</div>
      )}
    </section>
  )
}
