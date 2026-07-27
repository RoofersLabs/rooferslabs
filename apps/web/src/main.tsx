import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '@/providers/AppProviders';
import { registerPwaListeners } from '@/state/pwa.store';
import { App } from '@/App';
import '@/styles/index.css';

// Before render, not inside an effect: Chrome fires `beforeinstallprompt`
// early, and React would not have mounted in time to hear it.
registerPwaListeners();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
