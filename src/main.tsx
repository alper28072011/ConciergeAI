import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const _localStorage = window.localStorage;

(window as any).safeStorage = {
  getItem: (key: string) => {
    try { return _localStorage.getItem(key); } catch(e) { return null; }
  },
  setItem: (key: string, value: string) => {
    try { _localStorage.setItem(key, value); } catch(e) {}
  },
  removeItem: (key: string) => {
    try { _localStorage.removeItem(key); } catch(e) {}
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
