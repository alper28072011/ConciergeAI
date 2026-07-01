import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.addEventListener('error', (event) => {
  // Maskelenmiş veya boş Script Error'lerin uygulamayı beyaz ekranda kilitlemesini önler
  if (event.message === 'Script error.') {
    console.warn('CORS kaynaklı Script Error izole edildi, render akışı korunuyor.');
    event.preventDefault();
    return;
  }
  console.error('Küresel Hata Yakalandı:', event.error);
});

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
