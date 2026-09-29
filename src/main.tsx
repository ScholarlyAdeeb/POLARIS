import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { PolarisDataProvider } from './context/PolarisDataContext.tsx';
import { AuthProvider } from './lib/auth.tsx';
import { LanguageProvider } from './lib/i18n.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <LanguageProvider>
      <AuthProvider>
        <PolarisDataProvider>
          <App />
        </PolarisDataProvider>
      </AuthProvider>
    </LanguageProvider>
  </BrowserRouter>
);

// Offline support (PWA): cache the app shell and recent API reads. Production builds only.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
