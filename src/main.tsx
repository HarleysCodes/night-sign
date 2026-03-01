// Global polyfills for Web3 compatibility
(window as any).global = window;
(window as any).process = { env: { VITE_PINATA_JWT: import.meta.env.VITE_PINATA_JWT } };

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { VerifySignature } from './components/VerifySignature.tsx'

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/verify" element={<VerifySignature />} />
        </Routes>
      </BrowserRouter>
    </StrictMode>,
  )
} catch (err) {
  console.error('RENDER CRASH:', err);
  document.body.innerHTML = '<div style="min-height:100vh;background:#050a10;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:system-ui;gap:20px;"><h1 style="font-size:24px;">⚠️ App Crashed</h1><p style="color:#666;">Clear cache and try again</p><button onclick="localStorage.clear();sessionStorage.clear();window.location.reload()" style="padding:12px 24px;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;">Reset App & Clear Cache</button></div>';
}
