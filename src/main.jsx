import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { FloorProvider } from './store/floorStore'
import ErrorBoundary from './ErrorBoundary.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <FloorProvider>
        <App />
      </FloorProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
