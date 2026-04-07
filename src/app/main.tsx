// if (import.meta.env.DEV) {
//   import("react-grab");
// }

import React from 'react'
import ReactDOM from 'react-dom/client'

function App() {
  return <div>App Page</div>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
