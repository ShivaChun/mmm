import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { FloorProvider } from './store/floorStore'
import PlanAnalysis2D from "./components/PlanAnalysis2D"

import ErrorBoundary from './ErrorBoundary.jsx'

console.log('main.jsx is executing');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <FloorProvider>
        <App />
      </FloorProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
