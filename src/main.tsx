import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Bump this constant whenever you want ALL devices to reset to fresh seed data.
// Any client with a different stored version will have its localStorage cleared on next load.
const DATA_VERSION = '20260427-1';
const VERSION_KEY  = 'mf-data-version';
const STORE_KEY    = 'marketflow-store';

if (localStorage.getItem(VERSION_KEY) !== DATA_VERSION) {
  localStorage.removeItem(STORE_KEY);
  localStorage.setItem(VERSION_KEY, DATA_VERSION);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
