import './style.css';
import { Engine } from './game/Engine.js';

// InterRun game entry point
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const uiRoot = document.getElementById('ui-root');

  if (!canvas || !uiRoot) {
    console.error('[InterRun] Required DOM elements canvas or ui-root not found');
    return;
  }

  // Start the game engine
  const engine = new Engine(canvas, uiRoot);
  window.__INTERRUN_ENGINE__ = engine; // for console debugging
});
