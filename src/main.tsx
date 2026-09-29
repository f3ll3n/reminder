import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { IconsProvider } from './iconsContext';
import './styles.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    /* без service worker уведомления работают, просто без кнопки «Отложить» */
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IconsProvider>
      <App />
    </IconsProvider>
  </StrictMode>,
);
