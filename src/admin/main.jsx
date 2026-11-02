import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { StoreProvider } from './store.jsx';
import './styles.css';
import '../shared/rv-logo.css';

// Typing /admin//#/x (double slash) loads a blank page. Fix the address before the app starts.
if (/\/{2,}/.test(window.location.pathname)) {
  window.history.replaceState(null, '', window.location.pathname.replace(/\/{2,}/g, '/') + window.location.search + window.location.hash);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>
);
