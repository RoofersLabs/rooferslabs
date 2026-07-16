import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerPwaListeners } from '@/state/pwa.store';
import { AppProviders } from '@/providers/AppProviders';
import { App } from '@/App';
import '@/styles/index.css';

// Must run before the browser fires beforeinstallprompt.
registerPwaListeners();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
