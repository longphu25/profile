// Embed Loader — Lightweight script (~3KB) for embedding plugins on any website
// Usage: <div data-plugin="sui-wallet" data-config='{"theme":"dark"}'></div>
//        <script src="https://cdn.yourplatform.com/loader.js"></script>

;(function () {
  const CDN_BASE = 'https://cdn.yourplatform.com/plugins'
  const LOADED = new Map<string, boolean>()

  /** Load a plugin script and mount it into a container */
  async function mountPlugin(container: HTMLElement) {
    const pluginId = container.dataset.plugin
    if (!pluginId) return

    let config: Record<string, unknown> = {}
    try {
      config = JSON.parse(container.dataset.config || '{}')
    } catch {
      console.warn(`[PluginLoader] Invalid config for ${pluginId}`)
    }

    // Create shadow root for isolation
    const shadow = container.attachShadow({ mode: 'open' })
    const mountPoint = document.createElement('div')
    shadow.appendChild(mountPoint)

    // Load plugin CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `${CDN_BASE}/${pluginId}/style.css`
    shadow.appendChild(link)

    // Load plugin JS (once per plugin type)
    if (!LOADED.has(pluginId)) {
      const script = document.createElement('script')
      script.src = `${CDN_BASE}/${pluginId}/plugin.js`
      script.async = true
      document.head.appendChild(script)
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Failed to load plugin: ${pluginId}`))
      })
      LOADED.set(pluginId, true)
    }

    // Mount
    const registry = (window as unknown as Record<string, unknown>).__PLUGIN_REGISTRY__ as
      | Map<string, { mount: (el: HTMLElement, config: Record<string, unknown>) => void }>
      | undefined

    const plugin = registry?.get(pluginId)
    if (plugin?.mount) {
      plugin.mount(mountPoint, config)
    } else {
      mountPoint.innerHTML = `<p style="color:#888;font-size:14px;">Plugin "${pluginId}" loaded</p>`
    }
  }

  /** Initialize: find all [data-plugin] elements and mount them */
  function init() {
    const containers = document.querySelectorAll<HTMLElement>('[data-plugin]')
    containers.forEach(mountPlugin)
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  // Observe for dynamically added plugin containers
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          if (node.dataset.plugin) {
            mountPlugin(node)
          }
          // Check children too
          node.querySelectorAll<HTMLElement>('[data-plugin]').forEach(mountPlugin)
        }
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
})()
