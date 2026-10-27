import { ErrorBoundary } from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initErrorReporting } from './lib/sentry';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@drawmyplace/ui/tokens.css';
import './index.css';

initErrorReporting();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-slate-200">
          <h1 className="text-2xl font-semibold">
            Something went wrong / Щось пішло не так
          </h1>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-slate-950"
          >
            Reload / Перезавантажити
          </button>
        </main>
      }
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
