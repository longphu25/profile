// ShadowContainer - Renders children inside a Shadow DOM with scoped CSS
// Each plugin gets its own shadow root so styles never leak in or out

import { useRef, useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ShadowContainerProps {
  /** URL(s) to CSS files to inject into the shadow root */
  styleUrls?: string[]
  children: ReactNode
}

export function ShadowContainer({ styleUrls, children }: ShadowContainerProps) {
  const initializedRef = useRef(false)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)

  const hostCallbackRef = useCallback(
    (host: HTMLDivElement | null) => {
      if (!host || initializedRef.current) return
      initializedRef.current = true

      const shadow = host.attachShadow({ mode: 'open' })

      // Inject plugin CSS into shadow root
      if (styleUrls?.length) {
        const base = import.meta.env.BASE_URL
        for (const url of styleUrls) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          // Prepend base path for production (e.g. /profile/plugins/...)
          const resolved = url.startsWith('/') ? `${base}${url.slice(1)}` : url
          link.href = `${resolved}?t=${Date.now()}`
          shadow.appendChild(link)
        }
      }

      // Mount point for React portal
      const mountPoint = document.createElement('div')
      shadow.appendChild(mountPoint)
      setContainer(mountPoint)
    },
    [styleUrls],
  )

  return <div ref={hostCallbackRef}>{container && createPortal(children, container)}</div>
}
