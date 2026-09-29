/**
 * HUD — User interface with i18n support (en / uk).
 * - Distance, coins, lives, speed, FPS display
 * - Current control stage badge and hints
 * - Stage Announce banner
 * - Game Over screen
 * - Scene themes and character skins modal
 * - Debug launch panel
 * - Language switcher (EN / UA)
 */
import { i18n } from '../i18n/i18n.js';
import { getHUDHtml } from './templates.js';

export class HUD {
  constructor(rootElement, skinManager, soundFx, visionManager = null) {
    this.root = rootElement;
    this.skinManager = skinManager;
    this.soundFx = soundFx;
    this.visionManager = visionManager;

    this.onStartGame = null;
    this.onRestartGame = null;
    this.onStartDebug = null;
    this.onApplyLiveDebug = null;
    this.onToggleCamera = null;
    this.onGoToMenu = null;
    this.onApplySettings = null;
    this.onToggleSound = null;
    this.onUpdateAudioSettings = null;
    this.onApplyDisplaySettings = null;

    this._isGodMode = false;
    this._isStageLocked = false;
    this._selectedDebugStage = 0;
    this._selectedDebugSpeed = 1.0;

    // Cache settings
    this._settings = {
      resolution: this.visionManager?.settings?.resolution || (typeof localStorage !== 'undefined' ? localStorage.getItem('interrun_cv_res') : null) || 'balanced',
      targetFps: this.visionManager?.settings?.targetFps || (typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem('interrun_cv_fps') || '30', 10) : 30) || 30,
      pipMode: this.visionManager?.settings?.pipMode || (typeof localStorage !== 'undefined' ? localStorage.getItem('interrun_pip_mode') : null) || 'full',
      sfxVolume: this.soundFx?.sfxVolume ?? (typeof localStorage !== 'undefined' ? parseFloat(localStorage.getItem('interrun_sfx_vol') || '0.8') : 0.8),
      bgmVolume: this.soundFx?.bgmVolume ?? (typeof localStorage !== 'undefined' ? parseFloat(localStorage.getItem('interrun_bgm_vol') || '0.7') : 0.7),
      viewportFrame: (typeof localStorage !== 'undefined' ? localStorage.getItem('interrun_viewport_frame') : null) || 'full',
      renderScale: (typeof localStorage !== 'undefined' ? parseFloat(localStorage.getItem('interrun_render_scale') || '1.0') : 1.0)
    };

    this._render();
    this._bindElements();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  _t(key) { return i18n.t(key); }

  _render() {
    const t = (k) => this._t(k);
    this.root.innerHTML = getHUDHtml(t, i18n, {
      soundMuted: this.soundFx?.muted,
      selectedStage: this._selectedDebugStage,
      selectedSpeed: this._selectedDebugSpeed,
      settings: this._settings,
      currentTrackTitle: this.soundFx?.currentTrackTitle || 'Bgm'
    });
  }

  /**
   * Complete rerender on language change.
   * Preserves state (selected stage, modal visibility, active screen).
   */
  rerender() {
    const isMenuVisible = this.elMenu && !this.elMenu.classList.contains('hidden');
    const isHudVisible = this.elHud && !this.elHud.classList.contains('hidden');
    const isDeathVisible = this.elDeath && this.elDeath.classList.contains('show');
    const debugOpen    = !this.elDebugModal?.classList.contains('hidden');
    const skinOpen     = !this.elSkinModal?.classList.contains('hidden');
    const settingsOpen = !this.elSettingsModal?.classList.contains('hidden');
    const pipVisible   = !this.elWebcamPip?.classList.contains('hidden');
    const cvVisible    = this.elCvPanel && this.elCvPanel.style.display !== 'none';
    const selectedStage = this._selectedDebugStage;
    const selectedSpeed = this._selectedDebugSpeed;

    this._render();
    this._bindElements();

    this._selectedDebugStage = selectedStage;
    this._selectedDebugSpeed = selectedSpeed;
    this._updateDebugStageButtons();
    this._updateDebugSpeedButtons();
    if (debugOpen)    this.elDebugModal?.classList.remove('hidden');
    if (skinOpen)     this.elSkinModal?.classList.remove('hidden');
    if (settingsOpen) this.elSettingsModal?.classList.remove('hidden');
    if (pipVisible)   this.elWebcamPip?.classList.remove('hidden');
    if (cvVisible && this.elCvPanel) this.elCvPanel.style.display = 'inline-flex';

    if (!isMenuVisible) this.elMenu?.classList.add('hidden');
    if (isHudVisible) this.elHud?.classList.remove('hidden');
    if (isDeathVisible) this.elDeath?.classList.add('show');

    this._updateActiveButtons();
    this._updateSettingsButtons();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BIND
  // ─────────────────────────────────────────────────────────────────────────

  _bindElements() {
    this.elHud          = document.getElementById('hud');
    this.elDist         = document.getElementById('hud-dist');
    this.elCoins        = document.getElementById('hud-coins');
    this.elStageBadge   = document.getElementById('stage-badge');
    this.elFps          = document.getElementById('hud-fps');
    this.elCvFps        = document.getElementById('hud-cv-fps');
    this.elCvMs         = document.getElementById('hud-cv-ms');
    this.elCamFps       = document.getElementById('hud-cam-fps');
    this.elCvPanel      = document.getElementById('hud-cv-panel');
    this.elControlHint  = document.getElementById('control-hint');
    this.elSpeedBar     = document.getElementById('speed-bar-fill');
    this.elLivesRow     = document.getElementById('lives-row');
    this.elGodBadge     = document.getElementById('god-badge');

    this.elMenu         = document.getElementById('menu');
    this.elDeath        = document.getElementById('death-screen');
    this.elDeathDist    = document.getElementById('death-dist');
    this.elDeathBest    = document.getElementById('death-best');
    this.elDeathCoins   = document.getElementById('death-coins');

    this.elStageTransition = document.getElementById('stage-transition');
    this.elStageTitle      = document.getElementById('stage-title');
    this.elStageDesc       = document.getElementById('stage-desc');

    this.elSkinModal    = document.getElementById('skin-modal');
    this.elDebugModal   = document.getElementById('debug-modal');
    this.elSettingsModal = document.getElementById('settings-modal');
    this.elCountdownBanner = document.getElementById('stage-countdown-banner');
    this.elWebcamPip    = document.getElementById('webcam-pip');
    this.elWebcamCanvas = document.getElementById('webcam-canvas');
    if (this.visionManager && this.elWebcamCanvas) {
      this.visionManager.setPreviewCanvas(this.elWebcamCanvas);
    }
    this.elWebcamStatus   = document.getElementById('webcam-status');

    // Pre-cache life DOM elements to avoid per-frame document.getElementById lookups
    this._lifeEls = [
      document.getElementById('life-1'),
      document.getElementById('life-2'),
      document.getElementById('life-3')
    ];
    this._lastDistInt   = -1;
    this._lastCoins     = -1;
    this._lastSpeedPct  = -1;
    this._lastLives     = -1;
    this._lastGodMode   = null;
    this._lastFps       = -1;
    this._lastCvFps     = -1;
    this._lastCvMs      = -1;
    this._lastCamFps    = -1;

    this.elOptLock = document.getElementById('debug-opt-lock');
    this.elOptGod  = document.getElementById('debug-opt-god');

    // Language switcher (click and touch support)
    document.querySelectorAll('.lang-btn').forEach(btn => {
      let touched = false;
      const handleSelectLang = (e) => {
        if (e && e.type === 'touchend') {
          touched = true;
          e.preventDefault();
        } else if (e && e.type === 'click' && touched) {
          touched = false;
          return;
        }
        const lang = btn.getAttribute('data-lang');
        if (lang) {
          i18n.setLang(lang);
        }
      };

      btn.addEventListener('touchend', handleSelectLang, { passive: false });
      btn.addEventListener('click', handleSelectLang);
    });

    // Fast and responsive tap/click binder (eliminates 300ms touch delay and dropped clicks)
    const bindFastTap = (idOrEl, handler) => {
      const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
      if (!el) return;
      let lastTrigger = 0;
      const trigger = (e) => {
        const now = Date.now();
        if (now - lastTrigger < 300) return;
        lastTrigger = now;
        handler(e);
      };
      el.addEventListener('click', trigger);
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        trigger(e);
      }, { passive: false });
    };

    // Backdrop click dismiss for modals
    [this.elDebugModal, this.elSkinModal, this.elSettingsModal].forEach(modal => {
      if (!modal) return;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    });

    // Webcam PIP: fix double-toggle (only trigger onToggleCamera once)
    bindFastTap('btn-toggle-cam', () => {
      if (this.onToggleCamera) this.onToggleCamera();
    });

    // Start game
    bindFastTap('btn-play', () => {
      this.soundFx?.init();
      if (this.onStartGame) this.onStartGame(0, false, false);
    });

    // Restart game
    bindFastTap('btn-restart', () => {
      if (this.onRestartGame) this.onRestartGame();
    });

    // Skins modal
    bindFastTap('btn-skin-modal', () => this.elSkinModal?.classList.remove('hidden'));
    bindFastTap('btn-open-skins', () => this.elSkinModal?.classList.remove('hidden'));
    bindFastTap('btn-close-modal', () => this.elSkinModal?.classList.add('hidden'));
    bindFastTap('btn-modal-apply', () => this.elSkinModal?.classList.add('hidden'));

    // Debug modal
    bindFastTap('btn-debug-hud', () => this.openDebugModal());
    bindFastTap('btn-debug-menu', () => this.openDebugModal());
    bindFastTap('btn-debug-restart', () => this.openDebugModal());
    bindFastTap('btn-close-debug', () => this.closeDebugModal());

    // Debug stage selector
    document.querySelectorAll('.debug-stage-btn').forEach(btn => {
      bindFastTap(btn, () => {
        this._selectedDebugStage = parseInt(btn.getAttribute('data-stage') || '0', 10);
        this._updateDebugStageButtons();
      });
      btn.addEventListener('dblclick', () => {
        this._selectedDebugStage = parseInt(btn.getAttribute('data-stage') || '0', 10);
        this._updateDebugStageButtons();
        const isLocked = !!this.elOptLock?.checked;
        const isGod    = !!this.elOptGod?.checked;
        this.closeDebugModal();
        if (this.onStartDebug) this.onStartDebug(this._selectedDebugStage, isLocked, isGod, this._selectedDebugSpeed);
      });
    });

    // Debug speed selector
    document.querySelectorAll('.debug-speed-btn').forEach(btn => {
      bindFastTap(btn, () => {
        this._selectedDebugSpeed = parseFloat(btn.getAttribute('data-speed') || '1.0');
        this._updateDebugSpeedButtons();
      });
    });

    // Launch level from debug
    bindFastTap('btn-debug-launch-exec', () => {
      this.soundFx?.init();
      const isLocked = !!this.elOptLock?.checked;
      const isGod    = !!this.elOptGod?.checked;
      this.closeDebugModal();
      if (this.onStartDebug) this.onStartDebug(this._selectedDebugStage, isLocked, isGod, this._selectedDebugSpeed);
    });

    // Apply debug options live
    bindFastTap('btn-debug-live-apply', () => {
      const isLocked = !!this.elOptLock?.checked;
      const isGod    = !!this.elOptGod?.checked;
      this.closeDebugModal();
      if (this.onApplyLiveDebug) this.onApplyLiveDebug(this._selectedDebugStage, isLocked, isGod, this._selectedDebugSpeed);
    });

    // Return to main menu from HUD
    bindFastTap('btn-hud-menu', () => {
      if (this.onGoToMenu) this.onGoToMenu();
    });

    // Toggle sound & music
    bindFastTap('btn-toggle-sound', () => {
      if (this.onToggleSound) this.onToggleSound();
    });

    // Settings modal openers & actions
    bindFastTap('btn-hud-settings', () => this.openSettingsModal());
    bindFastTap('btn-open-settings', () => this.openSettingsModal());
    bindFastTap('btn-close-settings', () => this.closeSettingsModal());
    bindFastTap('btn-settings-save', () => {
      this.closeSettingsModal();
      if (this.visionManager) {
        this.visionManager.applySettings(this._settings);
      }
      if (this.onApplySettings) {
        this.onApplySettings(this._settings);
      }
      if (this.onUpdateAudioSettings) {
        this.onUpdateAudioSettings({
          sfxVolume: this._settings.sfxVolume,
          bgmVolume: this._settings.bgmVolume
        });
      }
      if (this.onApplyDisplaySettings) {
        this.onApplyDisplaySettings({
          viewportFrame: this._settings.viewportFrame,
          renderScale: this._settings.renderScale
        });
      }
    });

    // Audio Sliders
    const sliderBgm = document.getElementById('slider-bgm-vol');
    const valBgm = document.getElementById('settings-bgm-val');
    if (sliderBgm) {
      sliderBgm.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this._settings.bgmVolume = val;
        if (valBgm) valBgm.textContent = `${Math.round(val * 100)}%`;
        if (this.onUpdateAudioSettings) {
          this.onUpdateAudioSettings({ bgmVolume: val });
        }
      });
    }

    const sliderSfx = document.getElementById('slider-sfx-vol');
    const valSfx = document.getElementById('settings-sfx-val');
    if (sliderSfx) {
      sliderSfx.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this._settings.sfxVolume = val;
        if (valSfx) valSfx.textContent = `${Math.round(val * 100)}%`;
        if (this.onUpdateAudioSettings) {
          this.onUpdateAudioSettings({ sfxVolume: val });
        }
      });
    }

    // Track Playlist Switcher
    bindFastTap('btn-track-prev', () => {
      this.soundFx?.prevTrack();
    });
    bindFastTap('btn-track-next', () => {
      this.soundFx?.nextTrack();
    });

    if (this.soundFx?.music) {
      this.soundFx.music.onTrackChange = (title) => {
        const elTrack = document.getElementById('settings-current-track-name');
        if (elTrack) elTrack.textContent = title;
      };
    }

    // Settings options buttons
    document.querySelectorAll('.setting-opt-btn').forEach(btn => {
      bindFastTap(btn, () => {
        const group = btn.getAttribute('data-group');
        const val = btn.getAttribute('data-val');
        if (group && val) {
          if (group === 'targetFps') {
            this._settings[group] = parseInt(val, 10);
          } else if (group === 'sfxVolume' || group === 'bgmVolume') {
            const num = parseFloat(val);
            this._settings[group] = num;
            if (this.onUpdateAudioSettings) {
              this.onUpdateAudioSettings({ [group]: num });
            }
          } else if (group === 'renderScale') {
            const num = parseFloat(val);
            this._settings[group] = num;
            if (this.onApplyDisplaySettings) {
              this.onApplyDisplaySettings({ renderScale: num });
            }
          } else if (group === 'viewportFrame') {
            this._settings[group] = val;
            if (this.onApplyDisplaySettings) {
              this.onApplyDisplaySettings({ viewportFrame: val });
            }
          } else {
            this._settings[group] = val;
          }
          this._updateSettingsButtons();
        }
      });
    });

    // Themes
    document.querySelectorAll('.theme-select-btn').forEach(btn => {
      bindFastTap(btn, () => {
        this.skinManager.setTheme(btn.getAttribute('data-theme'));
        this._updateActiveButtons();
      });
    });

    // Character skins
    document.querySelectorAll('.skin-select-btn').forEach(btn => {
      bindFastTap(btn, () => {
        this.skinManager.setCharacterSkin(btn.getAttribute('data-skin'));
        this._updateActiveButtons();
      });
    });

    this._updateActiveButtons();
    this._updateDebugStageButtons();
    this._updateDebugSpeedButtons();
    this._updateSettingsButtons();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE UPDATES
  // ─────────────────────────────────────────────────────────────────────────

  _updateDebugStageButtons() {
    document.querySelectorAll('.debug-stage-btn').forEach(btn => {
      const stage = parseInt(btn.getAttribute('data-stage') || '0', 10);
      btn.classList.toggle('selected', stage === this._selectedDebugStage);
    });
  }

  _updateDebugSpeedButtons() {
    document.querySelectorAll('.debug-speed-btn').forEach(btn => {
      const speed = parseFloat(btn.getAttribute('data-speed') || '1.0');
      const isSelected = Math.abs(speed - this._selectedDebugSpeed) < 0.05;
      btn.classList.toggle('selected', isSelected);
      btn.style.borderColor = isSelected ? '#00e5ff' : 'rgba(255,255,255,0.12)';
      btn.style.background  = isSelected ? 'rgba(0,229,255,0.18)' : 'rgba(255,255,255,0.04)';
      btn.style.color       = isSelected ? '#00e5ff' : 'rgba(255,255,255,0.8)';
    });
  }

  openSettingsModal() {
    if (this.visionManager) {
      Object.assign(this._settings, this.visionManager.settings);
    }
    if (this.soundFx) {
      this._settings.sfxVolume = this.soundFx.sfxVolume;
      this._settings.bgmVolume = this.soundFx.bgmVolume;
    }
    this.elSettingsModal?.classList.remove('hidden');

    const sliderBgm = document.getElementById('slider-bgm-vol');
    const valBgm = document.getElementById('settings-bgm-val');
    if (sliderBgm) sliderBgm.value = this._settings.bgmVolume;
    if (valBgm) valBgm.textContent = `${Math.round(this._settings.bgmVolume * 100)}%`;

    const sliderSfx = document.getElementById('slider-sfx-vol');
    const valSfx = document.getElementById('settings-sfx-val');
    if (sliderSfx) sliderSfx.value = this._settings.sfxVolume;
    if (valSfx) valSfx.textContent = `${Math.round(this._settings.sfxVolume * 100)}%`;

    const elTrack = document.getElementById('settings-current-track-name');
    if (elTrack && this.soundFx) {
      elTrack.textContent = this.soundFx.currentTrackTitle;
    }

    this._updateSettingsButtons();
  }

  closeSettingsModal() {
    this.elSettingsModal?.classList.add('hidden');
  }

  toggleSettingsModal() {
    if (this.elSettingsModal?.classList.contains('hidden')) this.openSettingsModal();
    else this.closeSettingsModal();
  }

  _updateSettingsButtons() {
    document.querySelectorAll('.setting-opt-btn').forEach(btn => {
      const group = btn.getAttribute('data-group');
      const val = btn.getAttribute('data-val');
      let isSelected = false;
      if (group === 'sfxVolume' || group === 'bgmVolume' || group === 'renderScale') {
        const numVal = parseFloat(val);
        const curVal = this._settings[group];
        isSelected = Math.abs(numVal - curVal) < 0.05;
      } else {
        isSelected = (val === String(this._settings[group]));
      }
      btn.classList.toggle('selected', isSelected);
      btn.style.borderColor = isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.12)';
      btn.style.background  = isSelected ? 'rgba(0,229,255,0.18)' : 'rgba(255,255,255,0.04)';
      btn.style.color       = isSelected ? '#00e5ff' : 'rgba(255,255,255,0.8)';
    });
  }

  syncVisionSettings(settings) {
    if (!settings) return;
    if (settings.targetFps) this._settings.targetFps = settings.targetFps;
    if (settings.resolution) this._settings.resolution = settings.resolution;
    if (settings.pipMode) this._settings.pipMode = settings.pipMode;
    this._updateSettingsButtons();
  }

  updateSoundState(isMuted) {
    const icon = document.getElementById('hud-sound-icon');
    if (icon) {
      icon.textContent = isMuted ? '🔇' : '🔊';
    }
    const btn = document.getElementById('btn-toggle-sound');
    if (btn) {
      btn.style.opacity = isMuted ? '0.6' : '1.0';
      btn.title = isMuted ? 'Unmute (M)' : 'Mute (M)';
    }
  }

  isAnyModalOpen() {
    return (!this.elDebugModal?.classList.contains('hidden')) ||
           (!this.elSkinModal?.classList.contains('hidden')) ||
           (!this.elSettingsModal?.classList.contains('hidden'));
  }

  closeAllModals() {
    this.closeDebugModal();
    this.elSkinModal?.classList.add('hidden');
    this.closeSettingsModal();
  }

  openDebugModal() {
    this.elDebugModal?.classList.remove('hidden');
    this._updateDebugStageButtons();
    this._updateDebugSpeedButtons();
  }

  closeDebugModal() {
    this.elDebugModal?.classList.add('hidden');
  }

  toggleDebugModal() {
    if (this.elDebugModal?.classList.contains('hidden')) this.openDebugModal();
    else this.closeDebugModal();
  }

  _updateActiveButtons() {
    document.querySelectorAll('.theme-select-btn').forEach(btn => {
      const match = btn.getAttribute('data-theme') === this.skinManager.currentThemeId;
      btn.style.borderColor = match ? 'var(--accent)' : 'rgba(255,255,255,0.12)';
      btn.style.background  = match ? 'var(--glass-b)' : 'var(--glass)';
    });

    document.querySelectorAll('.skin-select-btn').forEach(btn => {
      const match = btn.getAttribute('data-skin') === this.skinManager.currentCharSkinId;
      btn.style.borderColor = match ? 'var(--accent2)' : 'rgba(255,255,255,0.12)';
      btn.style.background  = match ? 'rgba(255,107,53,0.15)' : 'var(--glass)';
    });

    // Highlight active language
    document.querySelectorAll('.lang-btn').forEach(btn => {
      const active = btn.getAttribute('data-lang') === i18n.lang;
      btn.style.borderColor  = active ? 'var(--accent)' : 'rgba(255,255,255,0.2)';
      btn.style.background   = active ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.05)';
      btn.style.color        = active ? 'var(--accent)' : 'rgba(255,255,255,0.7)';
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN TRANSITIONS
  // ─────────────────────────────────────────────────────────────────────────

  showMenu() {
    this.hideTransitionCountdown();
    this.elMenu?.classList.remove('hidden');
    this.elHud?.classList.add('hidden');
    this.elDeath?.classList.remove('show');
  }

  showGame() {
    this.hideTransitionCountdown();
    this._lastDistInt = -1;
    this._lastCoins = -1;
    this._lastSpeedPct = -1;
    this._lastLives = -1;
    this._lastGodMode = null;
    this.elMenu?.classList.add('hidden');
    this.elHud?.classList.remove('hidden');
    this.elDeath?.classList.remove('show');
  }

  showGameOver(distance, bestScore, coins) {
    this.hideTransitionCountdown();
    if (this.elDeathDist)  this.elDeathDist.textContent  = Math.floor(distance);
    if (this.elDeathBest)  this.elDeathBest.textContent  = Math.floor(bestScore);
    if (this.elDeathCoins) this.elDeathCoins.textContent = coins;
    this.elDeath?.classList.add('show');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HUD UPDATES
  // ─────────────────────────────────────────────────────────────────────────

  updateHUD(distance, speedNorm, coins, lives, isGodMode = false, isStageLocked = false) {
    const distInt = Math.floor(distance);
    if (this.elDist && distInt !== this._lastDistInt) {
      this._lastDistInt = distInt;
      this.elDist.textContent = distInt;
    }

    if (this.elCoins && coins !== this._lastCoins) {
      this._lastCoins = coins;
      this.elCoins.textContent = coins;
    }

    const speedPct = Math.min(100, Math.floor(speedNorm * 100));
    if (this.elSpeedBar && speedPct !== this._lastSpeedPct) {
      this._lastSpeedPct = speedPct;
      this.elSpeedBar.style.width = `${speedPct}%`;
    }

    this._isStageLocked = isStageLocked;

    if (isGodMode !== this._lastGodMode) {
      this._lastGodMode = isGodMode;
      this._isGodMode = isGodMode;
      if (isGodMode) {
        this.elLivesRow?.classList.add('hidden');
        this.elGodBadge?.classList.remove('hidden');
      } else {
        this.elLivesRow?.classList.remove('hidden');
        this.elGodBadge?.classList.add('hidden');
      }
    }

    if (!isGodMode && lives !== this._lastLives) {
      this._lastLives = lives;
      for (let i = 0; i < 3; i++) {
        this._lifeEls[i]?.classList.toggle('lost', (i + 1) > lives);
      }
    }
  }

  updateFPS(fps) {
    if (!this.elFps || fps === this._lastFps) return;
    this._lastFps = fps;
    this.elFps.textContent = fps;
    this.elFps.style.color = fps >= 55 ? '#00e676' : fps >= 30 ? '#ffd700' : '#ff3d5e';
  }

  updateCvFPS(fps, frametime, camFps = null) {
    if (this.elCvFps && fps !== this._lastCvFps) {
      this._lastCvFps = fps;
      this.elCvFps.textContent = fps;
      this.elCvFps.style.color = fps >= 25 ? '#00e5ff' : fps >= 15 ? '#ffd700' : '#ff3d5e';
    }
    if (this.elCvMs && frametime !== this._lastCvMs) {
      this._lastCvMs = frametime;
      this.elCvMs.textContent = frametime ? `• ${frametime}ms` : '';
      this.elCvMs.style.color = frametime <= 35 ? '#00e5ff' : frametime <= 65 ? '#ffd700' : '#ff3d5e';
    }
    if (this.elCamFps && camFps && camFps !== this._lastCamFps) {
      this._lastCamFps = camFps;
      const isLowLight = camFps < 18;
      this.elCamFps.textContent = isLowLight ? `📹${camFps} 💡` : `📹${camFps}`;
      this.elCamFps.style.color = isLowLight ? '#ffd700' : 'rgba(255,255,255,0.65)';
      this.elCamFps.title = isLowLight ? i18n.t('hud.cam.lowlight') : 'Camera FPS';
    }
  }

  showCvFps(show = true) {
    if (this.elCvPanel) {
      this.elCvPanel.style.display = show ? 'inline-flex' : 'none';
    }
  }

  setWebcamStatus(text, color = '#00e5ff') {
    if (!this.elWebcamStatus) return;
    this.elWebcamStatus.textContent = text;
    this.elWebcamStatus.style.color = color;
  }

  showWebcamPip(show = true) {
    if (!this.elWebcamPip) return;
    if (show) this.elWebcamPip.classList.remove('hidden');
    else      this.elWebcamPip.classList.add('hidden');
  }

  _isTouch() {
    return (typeof window !== 'undefined') && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
  }

  _tStage(stageNumber, field) {
    if (this._isTouch()) {
      const touchKey = `stage.${stageNumber}.${field}.touch`;
      const val = this._t(touchKey);
      if (val !== touchKey) return val;
    }
    return this._t(`stage.${stageNumber}.${field}`);
  }

  _tTransition(stageNumber) {
    if (this._isTouch()) {
      const touchKey = `transition.hint.${stageNumber}.touch`;
      const val = this._t(touchKey);
      if (val !== touchKey) return val;
    }
    return this._t(`transition.hint.${stageNumber}`);
  }

  announceStage(stageNumber, isLocked = false) {
    this._selectedDebugStage = stageNumber;
    this._updateDebugStageButtons();

    const stages = [
      { badge: this._tStage(0, 'badge'), hint: this._tStage(0, 'hint'), title: this._tStage(0, 'title'), desc: this._tStage(0, 'desc') },
      { badge: this._tStage(1, 'badge'), hint: this._tStage(1, 'hint'), title: this._tStage(1, 'title'), desc: this._tStage(1, 'desc') },
      { badge: this._tStage(2, 'badge'), hint: this._tStage(2, 'hint'), title: this._tStage(2, 'title'), desc: this._tStage(2, 'desc') },
      { badge: this._tStage(3, 'badge'), hint: this._tStage(3, 'hint'), title: this._tStage(3, 'title'), desc: this._tStage(3, 'desc') },
      { badge: this._tStage(4, 'badge'), hint: this._tStage(4, 'hint'), title: this._tStage(4, 'title'), desc: this._tStage(4, 'desc') },
      { badge: this._tStage(5, 'badge'), hint: this._tStage(5, 'hint'), title: this._tStage(5, 'title'), desc: this._tStage(5, 'desc') },
    ];

    const info = stages[stageNumber] ?? stages[0];
    const lockSuffix = isLocked ? ' 🔒' : '';
    const currentDist = (this.elDist ? parseInt(this.elDist.textContent || '0', 10) : 0);
    const cycle = Math.floor(currentDist / 1350);
    const loopSuffix = cycle > 0 ? ` [${this._t('stage.loop')} ${cycle + 1}]` : '';

    if (this.elStageBadge)  this.elStageBadge.textContent  = info.badge + loopSuffix + lockSuffix;
    if (this.elControlHint) this.elControlHint.innerHTML    = info.hint;

    const shouldAnnounce = stageNumber > 0 || currentDist > 50;
    if (shouldAnnounce) {
      if (this.elStageTitle) this.elStageTitle.textContent = info.title + loopSuffix + lockSuffix;
      if (this.elStageDesc)  this.elStageDesc.textContent  = info.desc;

      const announce = document.getElementById('stage-announce');
      if (this.elStageTransition && announce) {
        this.elStageTransition.classList.add('flash');
        announce.classList.add('show');
        if (this.soundFx) this.soundFx.playStageUp();
        setTimeout(() => {
          announce.classList.remove('show');
          this.elStageTransition.classList.remove('flash');
        }, 2400);
      }
    }
  }

  showTransitionCountdown(stageNumber, totalDuration, remainingSec) {
    const banner = document.getElementById('stage-countdown-banner');
    if (!banner) return;

    const stageNames = [
      this._tStage(0, 'badge'),
      this._tStage(1, 'badge'),
      this._tStage(2, 'badge'),
      this._tStage(3, 'badge'),
      this._tStage(4, 'badge'),
      this._tStage(5, 'badge')
    ];

    const stageHints = [
      this._tTransition(0),
      this._tTransition(1),
      this._tTransition(2),
      this._tTransition(3),
      this._tTransition(4),
      this._tTransition(5)
    ];

    const badge = document.getElementById('transition-next-badge');
    const hint = document.getElementById('transition-next-hint');

    if (badge) badge.textContent = stageNames[stageNumber] || `STAGE ${stageNumber}`;
    if (hint) hint.innerHTML = stageHints[stageNumber] || '';

    banner.classList.remove('hidden');
    this.updateTransitionCountdown(remainingSec, totalDuration);
  }

  updateTransitionCountdown(remainingSec, totalDuration = 3.5) {
    const numEl = document.getElementById('transition-timer-num');
    const circle = document.getElementById('transition-timer-circle');

    const rem = Math.max(0, remainingSec);
    if (numEl) {
      numEl.textContent = rem > 0.05 ? rem.toFixed(1) : 'GO!';
      numEl.style.color = rem <= 1.0 ? '#00ff88' : '#00e5ff';
    }

    if (circle && totalDuration > 0) {
      const progress = Math.max(0, Math.min(1, rem / totalDuration));
      const offset = 100 * (1 - progress);
      circle.style.strokeDashoffset = `${offset}`;
      circle.style.stroke = rem <= 1.0 ? '#00ff88' : '#00e5ff';
    }
  }

  hideTransitionCountdown() {
    const banner = document.getElementById('stage-countdown-banner');
    if (banner) banner.classList.add('hidden');
  }
}
