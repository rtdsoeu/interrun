import './style.css';
import { Engine } from './game/Engine.js';

// Точка входа в игру InterRun
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const uiRoot = document.getElementById('ui-root');

  if (!canvas || !uiRoot) {
    console.error('[InterRun] Required DOM elements canvas or ui-root not found');
    return;
  }

  // Запуск игрового движка
  const engine = new Engine(canvas, uiRoot);
  window.__INTERRUN_ENGINE__ = engine; // для отладки в консоли
});
