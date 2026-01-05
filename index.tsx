import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');

if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("LotoExpert AI: Inicializado com sucesso.");
  } catch (error) {
    console.error("Erro ao renderizar App:", error);
    container.innerHTML = `<div style="padding: 20px; color: #f87171; text-align: center;">
      <h3>Erro de Inicialização</h3>
      <p>Falha ao carregar os módulos do sistema. Verifique o console do desenvolvedor.</p>
    </div>`;
  }
} else {
  console.error("Erro crítico: Elemento #root não encontrado no DOM.");
}