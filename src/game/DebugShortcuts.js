import { GameState } from './Engine.js';

/**
 * DebugShortcuts — Handles developer keybindings and navigation hotkeys.
 *
 * Hotkeys:
 * - Esc: Close active modal or return to menu
 * - Space / Enter: Start or restart game from Menu / Dead screen
 * - 0..5: Jump directly to stage (with stage lock enabled)
 * - G: Toggle God Mode
 * - L: Toggle Stage Lock
 * - F2 / ~: Toggle Debug modal panel
 * - M: Toggle audio mute
 */
export class DebugShortcuts {
  /**
   * @param {object} params
   * @param {import('./Engine.js').Engine} params.engine
   * @param {import('../ui/HUD.js').HUD} params.hud
   * @param {import('../audio/SoundFx.js').SoundFx} params.soundFx
   */
  constructor({ engine, hud, soundFx }) {
    this.engine = engine;
    this.hud = hud;
    this.soundFx = soundFx;

    this._onKeyDown = (e) => this._handleKeyDown(e);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._onKeyDown);
    }
  }

  _handleKeyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      return;
    }

    const key = e.key;

    // Escape: Close modals or return to main menu during gameplay
    if (key === 'Escape') {
      if (this.hud?.isAnyModalOpen()) {
        this.hud.closeAllModals();
      } else if (this.engine.state === GameState.PLAYING) {
        this.engine.goToMenu();
      }
      return;
    }

    // Space or Enter: Start game from Menu or Restart from Dead screen
    if (e.code === 'Space' || e.code === 'Enter') {
      if (!this.hud?.isAnyModalOpen()) {
        if (this.engine.state === GameState.MENU || this.engine.state === GameState.DEAD) {
          e.preventDefault();
          this.engine.startGame(0, false, this.engine.godMode);
          return;
        }
      }
    }

    // Keys 0-5: instant stage select & launch (from Menu / Dead) or live switch (during Play)
    if (key >= '0' && key <= '5') {
      const stageNum = parseInt(key, 10);
      this.hud?.closeAllModals();
      if (this.engine.state === GameState.MENU || this.engine.state === GameState.DEAD) {
        this.engine.startGame(stageNum, true, this.engine.godMode);
      } else {
        this.engine.setDebugStage(stageNum, true);
      }
      return;
    }

    // G: God Mode
    if (e.code === 'KeyG' || key === 'g' || key === 'G') {
      this.engine.toggleGodMode();
      return;
    }

    // L: Stage lock
    if (e.code === 'KeyL' || key === 'L' || key === 'l') {
      this.engine.toggleStageLock();
      return;
    }

    // F2 / ` / ~: Debug panel
    if (e.code === 'Backquote' || key === '`' || key === '~' || key === 'F2') {
      e.preventDefault();
      this.hud?.toggleDebugModal();
      return;
    }

    // M: Toggle audio mute
    if (e.code === 'KeyM' || key === 'm' || key === 'M') {
      if (this.soundFx) {
        const isMuted = this.soundFx.toggleMute();
        this.hud?.updateSoundState(isMuted);
      }
      return;
    }
  }

  /**
   * Cleans up keydown listener.
   */
  dispose() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._onKeyDown);
    }
  }
}
