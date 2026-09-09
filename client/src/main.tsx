import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './landing.css';

// Filter out benign SheetJS ZIP streaming data-descriptor console messages
if (typeof window !== 'undefined' && window.console) {
  const rawConsoleError = console.error;
  console.error = function (...args: unknown[]) {
    const first = typeof args[0] === 'string' ? args[0] : '';
    if (
      first.includes('Bad uncompressed size') ||
      first.includes('Bad compressed size') ||
      first.includes('Bad CRC32 checksum') ||
      first.includes('An empty string ("") was passed to the')
    ) {
      return;
    }
    rawConsoleError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
