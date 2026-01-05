
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const startApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Erro ao inicializar React:", error);
    rootElement.innerHTML = `<div style="color: white; padding: 20px;">Erro crítico de inicialização. Por favor, recarregue a página.</div>`;
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
