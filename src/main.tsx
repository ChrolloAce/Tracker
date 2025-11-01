import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'

// Disable all console.log statements globally for cleaner console
// Keep errors and warnings for debugging
// TEMPORARILY DISABLED FOR PRELAUNCH DEBUGGING
// const noop = () => {};
// console.log = noop;
// console.info = noop;
// console.debug = noop;
// Keep console.warn and console.error for important messages

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
