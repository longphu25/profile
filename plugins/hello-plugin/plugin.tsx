// Hello Plugin - A minimal example plugin
// Demonstrates how to register a component with the host API

import type { Plugin, HostAPI } from '../../src/plugins/types'

const HelloPlugin: Plugin = {
  name: 'HelloPlugin',
  version: '1.0.0',
  styleUrls: ['/plugins/hello-plugin/style.css'],

  init(host: HostAPI) {
    host.registerComponent('Hello', () => (
      <div className="hello-plugin">
        <h3>👋 Hello from Plugin!</h3>
        <p>
          This component was registered by <code>HelloPlugin</code> via the Host API.
        </p>
      </div>
    ))
    host.log('HelloPlugin initialized successfully')
  },

  mount() {
    console.log('[HelloPlugin] mounted')
  },

  unmount() {
    console.log('[HelloPlugin] unmounted')
  },
}

export default HelloPlugin
