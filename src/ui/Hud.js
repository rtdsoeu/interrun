/**
 * HUD — User interface with i18n support (en / uk).
 * - Distance, coins, lives, speed, FPS display
 * - Current control stage badge and hints
 * - Stage Announce banner & transition countdown
 * - Game Over screen & main menu transitions
 * - Scene themes and character skins modal
 * - Debug launcher and settings modal controllers
 * - Telemetry & HCI evaluation modal controller
 * - Language switcher (EN / UA)
 */
import { i18n } from '../i18n/I18n.js';
import { getHUDHtml } from './HudTemplates.js';
import { BenchmarkUI } from '../analytics/BenchmarkUI.js';
import { TelemetryUI } from '../analytics/TelemetryUI.js';
import { TransitionBanner } from './components/TransitionBanner.js';
import { DebugModal } from './modals/DebugModal.js';
import { SettingsModal } from './modals/SettingsModal.js';
import { TelemetryModal } from './modals/TelemetryModal.js';

/**
 * Fast and responsive tap/click binder (eliminates 300ms touch delay and dropped clicks).
 */
export function bindFastTap(idOrEl, handler) {
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
}

export class Hud {
  constructor(rootElement, skinManager, soundFx, visionManager = null) {
    this.root = rootElement;
    this.skinManager = skinManager;
    this.soundFx = soundFx;
    this.visionManager = visionManager;
    if (this.visionManager) {
      this.visionManager.onPreloadProgress = (progress, stage) => this.updateAiPreloadProgress(progress, stage);
      this.visionManager.onAllModelsReady = () => this.onAiModelsReady();
    }

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
    this.onRetryCamera = null;

    this._isGodMode = false;
    this._isStageLocked = false;

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

    // Sub-components
    this.transitionBanner = new TransitionBanner();
    this.debugModal = new DebugModal({
      onStartDebug: (...args) => this.onStartDebug?.(...args),
      onApplyLiveDebug: (...args) => this.onApplyLiveDebug?.(...args),
      soundFx: this.soundFx
    });
    this.settingsModal = new SettingsModal({
      onApplySettings: (s) => this.onApplySettings?.(s),
      onUpdateAudioSettings: (a) => this.onUpdateAudioSettings?.(a),
      onApplyDisplaySettings: (d) => this.onApplyDisplaySettings?.(d)
    });
    this.telemetryUI = new TelemetryUI();
    this.benchmarkUI = new BenchmarkUI({
      benchmark: null,
      visionManager: this.visionManager,
      onShowPip: (show) => this.showWebcamPip(show)
    });
    this.telemetryModal = new TelemetryModal({
      telemetryManager: null,
      gestureBenchmark: null,
      surveyManager: null,
      telemetryUI: this.telemetryUI,
      benchmarkUI: this.benchmarkUI
    });

    this._render();
    this._bindElements();
  }

  // Debug stage and speed accessors
  get _selectedDebugStage() {
    return this.debugModal.selectedStage;
  }

  set _selectedDebugStage(val) {
    this.debugModal.selectedStage = val;
  }

  get _selectedDebugSpeed() {
    return this.debugModal.selectedSpeed;
  }

  set _selectedDebugSpeed(val) {
    this.debugModal.selectedSpeed = val;
  }

  get _currentTelemTab() {
    return this.telemetryModal.currentTab;
  }

  set _currentTelemTab(val) {
    this.telemetryModal.currentTab = val;
  }

  get telemetryManager() {
    return this.telemetryModal.telemetryManager;
  }

  set telemetryManager(val) {
    this.telemetryModal.telemetryManager = val;
  }

  get gestureBenchmark() {
    return this.telemetryModal.gestureBenchmark;
  }

  set gestureBenchmark(val) {
    this.telemetryModal.gestureBenchmark = val;
    this.benchmarkUI?.setBenchmark(val);
  }

  get surveyManager() {
    return this.telemetryModal.surveyManager;
  }

  set surveyManager(val) {
    this.telemetryModal.surveyManager = val;
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
      currentTrackTitle: this.soundFx?.currentTrackTitle || 'Bgm',
      isAiReady: !!this.visionManager?.modelsReady
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
    const debugOpen = !this.elDebugModal?.classList.contains('hidden');
    const skinOpen = !this.elSkinModal?.classList.contains('hidden');
    const settingsOpen = !this.elSettingsModal?.classList.contains('hidden');
    const camErrorOpen = !this.elCamErrorModal?.classList.contains('hidden');
    const pipVisible = !this.elWebcamPip?.classList.contains('hidden');
    const cvVisible = this.elCvPanel && this.elCvPanel.style.display !== 'none';
    const lowLightOpen = !this.elLowLightBadge?.classList.contains('hidden');
    const selectedStage = this._selectedDebugStage;
    const selectedSpeed = this._selectedDebugSpeed;

    this._render();
    this._bindElements();

    this._selectedDebugStage = selectedStage;
    this._selectedDebugSpeed = selectedSpeed;
    this._updateDebugStageButtons();
    this._updateDebugSpeedButtons();
    if (debugOpen) this.elDebugModal?.classList.remove('hidden');
    if (skinOpen) this.elSkinModal?.classList.remove('hidden');
    if (settingsOpen) this.elSettingsModal?.classList.remove('hidden');
    if (camErrorOpen) this.elCamErrorModal?.classList.remove('hidden');
    if (pipVisible) this.elWebcamPip?.classList.remove('hidden');
    if (cvVisible && this.elCvPanel) this.elCvPanel.style.display = 'inline-flex';
    if (lowLightOpen) this.elLowLightBadge?.classList.remove('hidden');

    if (!isMenuVisible) this.elMenu?.classList.add('hidden');
    if (isHudVisible) this.elHud?.classList.remove('hidden');
    if (isDeathVisible) this.elDeath?.classList.add('show');

    this._updateActiveButtons();
    this._updateSettingsButtons();

    if (this._lastStageNumber !== undefined) {
      this.announceStage(this._lastStageNumber, this._lastIsLocked, this._lastCycle);
      const announce = document.getElementById('stage-announce');
      announce?.classList.remove('show');
      this.elStageTransition?.classList.remove('flash');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BIND
  // ─────────────────────────────────────────────────────────────────────────

  _bindElements() {
    this.elHud = document.getElementById('hud');
    this.elDist = document.getElementById('hud-dist');
    this.elCoins = document.getElementById('hud-coins');
    this.elStageBadge = document.getElementById('stage-badge');
    this.elFps = document.getElementById('hud-fps');
    this.elCvFps = document.getElementById('hud-cv-fps');
    this.elCvMs = document.getElementById('hud-cv-ms');
    this.elCamFps = document.getElementById('hud-cam-fps');
    this.elCvPanel = document.getElementById('hud-cv-panel');
    this.elLowLightBadge = document.getElementById('hud-cam-lowlight-badge');
    this.elControlHint = document.getElementById('control-hint');
    this.elSpeedBar = document.getElementById('speed-bar-fill');
    this.elLivesRow = document.getElementById('lives-row');
    this.elGodBadge = document.getElementById('god-badge');

    this.elMenu = document.getElementById('menu');
    this.elDeath = document.getElementById('death-screen');
    this.elDeathDist = document.getElementById('death-dist');
    this.elDeathBest = document.getElementById('death-best');
    this.elDeathCoins = document.getElementById('death-coins');

    this.elStageTransition = document.getElementById('stage-transition');
    this.elStageTitle = document.getElementById('stage-title');
    this.elStageDesc = document.getElementById('stage-desc');

    this.elSkinModal = document.getElementById('skin-modal');
    this.elDebugModal = document.getElementById('debug-modal');
    this.elSettingsModal = document.getElementById('settings-modal');
    this.elCamErrorModal = document.getElementById('camera-error-modal');
    this.elCamErrorBody = document.getElementById('cam-error-body');
    this.elTelemetryModal = document.getElementById('telemetry-modal');

    this.benchmarkUI.setVisionManager(this.visionManager);
    if (this.gestureBenchmark) {
      this.benchmarkUI.setBenchmark(this.gestureBenchmark);
    }

    this.elCountdownBanner = document.getElementById('stage-countdown-banner');
    this.elWebcamPip = document.getElementById('webcam-pip');
    this.elWebcamCanvas = document.getElementById('webcam-canvas');
    if (this.visionManager && this.elWebcamCanvas) {
      this.visionManager.setPreviewCanvas(this.elWebcamCanvas);
    }
    this.elWebcamStatus = document.getElementById('webcam-status');

    // Pre-cache life DOM elements
    this._lifeEls = [
      document.getElementById('life-1'),
      document.getElementById('life-2'),
      document.getElementById('life-3')
    ];
    this._lastDistInt = -1;
    this._lastCoins = -1;
    this._lastSpeedPct = -1;
    this._lastLives = -1;
    this._lastGodMode = null;
    this._lastFps = -1;
    this._lastCvFps = -1;
    this._lastCvMs = -1;
    this._lastCamFps = -1;

    this.elOptLock = document.getElementById('debug-opt-lock');
    this.elOptGod = document.getElementById('debug-opt-god');

    // Language switcher
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

    // Backdrop click dismiss for modals
    [this.elDebugModal, this.elSkinModal, this.elSettingsModal, this.elCamErrorModal].forEach(modal => {
      if (!modal) return;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    });

    // Camera error modal actions
    bindFastTap('btn-close-cam-error', () => this.closeCameraErrorModal());
    bindFastTap('btn-cam-error-continue', () => this.closeCameraErrorModal());
    bindFastTap('btn-cam-error-retry', () => {
      if (this.onRetryCamera) this.onRetryCamera();
    });

    // Webcam PIP toggle
    bindFastTap('btn-toggle-cam', () => {
      if (this.onToggleCamera) this.onToggleCamera();
    });

    // Start game
    bindFastTap('btn-play', () => {
      this.soundFx?.init();
      if (this.onStartGame) this.onStartGame(0, false, false);
    });

    // Menu stage chips
    document.querySelectorAll('.menu-stages .stage-chip').forEach(chip => {
      bindFastTap(chip, () => {
        const stage = parseInt(chip.getAttribute('data-stage') || '0', 10);
        this.soundFx?.init();
        if (this.onStartDebug) this.onStartDebug(stage, true, this._isGodMode, 1.0);
        else if (this.onStartGame) this.onStartGame(stage, true, false);
      });
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

    // Delegate DebugModal UI
    this.debugModal.bindUI(bindFastTap);

    // Delegate SettingsModal UI
    this.settingsModal.bindUI(this._settings, this.soundFx, this.visionManager, bindFastTap);

    // Delegate TelemetryModal UI
    this.telemetryModal.bindUI(bindFastTap);

    // Initialize & bind benchmark UI
    this.benchmarkUI.bindUI();

    // Return to main menu from HUD
    bindFastTap('btn-hud-menu', () => {
      if (this.onGoToMenu) this.onGoToMenu();
    });

    // Toggle sound & music
    bindFastTap('btn-toggle-sound', () => {
      if (this.onToggleSound) this.onToggleSound();
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
  // STATE UPDATES & MODAL DELEGATION
  // ─────────────────────────────────────────────────────────────────────────

  _updateDebugStageButtons() {
    this.debugModal.updateStageButtons();
  }

  _updateDebugSpeedButtons() {
    this.debugModal.updateSpeedButtons();
  }

  openSettingsModal() {
    this.settingsModal.open(this._settings, this.soundFx, this.visionManager);
  }

  closeSettingsModal() {
    this.settingsModal.close();
  }

  toggleSettingsModal() {
    this.settingsModal.toggle(this._settings, this.soundFx, this.visionManager);
  }

  _updateSettingsButtons() {
    this.settingsModal.updateButtons(this._settings);
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

  showCameraErrorModal(errorInfo) {
    if (this.elCamErrorBody) {
      let msgKey = 'modal.cam_error.general';
      if (errorInfo?.type === 'permission_denied') msgKey = 'modal.cam_error.permission';
      else if (errorInfo?.type === 'insecure_context') msgKey = 'modal.cam_error.insecure';
      else if (errorInfo?.type === 'not_found') msgKey = 'modal.cam_error.not_found';
      else if (errorInfo?.type === 'in_use') msgKey = 'modal.cam_error.in_use';
      this.elCamErrorBody.innerHTML = i18n.t(msgKey);
    }
    this.elCamErrorModal?.classList.remove('hidden');
  }

  closeCameraErrorModal() {
    this.elCamErrorModal?.classList.add('hidden');
  }

  isAnyModalOpen() {
    return (!this.elDebugModal?.classList.contains('hidden')) ||
      (!this.elSkinModal?.classList.contains('hidden')) ||
      (!this.elSettingsModal?.classList.contains('hidden')) ||
      (!this.elTelemetryModal?.classList.contains('hidden')) ||
      (!this.elCamErrorModal?.classList.contains('hidden'));
  }

  closeAllModals() {
    this.closeDebugModal();
    this.elSkinModal?.classList.add('hidden');
    this.closeSettingsModal();
    this.closeCameraErrorModal();
    this.closeTelemetryModal();
  }

  openDebugModal() {
    this.debugModal.open();
  }

  closeDebugModal() {
    this.debugModal.close();
  }

  toggleDebugModal() {
    this.debugModal.toggle();
  }

  setAnalytics({ telemetry, benchmark, survey } = {}) {
    if (telemetry) this.telemetryManager = telemetry;
    if (benchmark) {
      this.gestureBenchmark = benchmark;
    }
    if (survey) this.surveyManager = survey;
  }

  openTelemetryModal() {
    this.telemetryModal.open();
  }

  closeTelemetryModal() {
    this.telemetryModal.close();
  }

  toggleTelemetryModal() {
    this.telemetryModal.toggle();
  }

  switchTelemetryTab(tab) {
    this.telemetryModal.switchTab(tab);
  }

  renderTelemetryStats() {
    this.telemetryModal.renderTelemetryStats();
  }

  exportTelemetryCsv() {
    this.telemetryModal.exportTelemetryCsv();
  }

  exportTelemetryJson() {
    this.telemetryModal.exportTelemetryJson();
  }

  clearTelemetryHistory() {
    this.telemetryModal.clearTelemetryHistory();
  }

  _getBenchmarkClasses(stageKey) {
    return this.benchmarkUI?.getBenchmarkClasses(stageKey) || [];
  }

  _getBenchmarkIcons(stageKey) {
    return this.benchmarkUI?.getBenchmarkIcons(stageKey) || {};
  }

  _getBenchmarkHints(stageKey) {
    return this.benchmarkUI?.getBenchmarkHints(stageKey) || '';
  }

  _onBenchmarkTargetChanged() {
    this.benchmarkUI?.onTargetChanged();
  }

  get _benchmarkRunning() {
    return this.benchmarkUI?.isRunning || false;
  }

  set _benchmarkRunning(val) {
    if (!val && this.benchmarkUI) {
      this.benchmarkUI.stopGestureBenchmark();
    }
  }

  _stopGestureBenchmark() {
    this.benchmarkUI?.stopGestureBenchmark();
  }

  async runGestureBenchmark() {
    await this.benchmarkUI?.runGestureBenchmark();
  }

  _renderBenchmarkResults(classList) {
    if (this.gestureBenchmark) {
      const report = this.gestureBenchmark.calculateReport(classList);
      this.benchmarkUI?._renderBenchmarkResults(report, classList);
    }
  }

  exportBenchmarkCsv() {
    this.benchmarkUI?.exportCsv();
  }

  exportBenchmarkJson() {
    this.benchmarkUI?.exportJson();
  }

  renderSurveySummary() {
    this.telemetryModal.renderSurveySummary();
  }

  saveSurveyResponse() {
    this.telemetryModal.saveSurveyResponse();
  }

  exportSurveyCsv() {
    this.telemetryModal.exportSurveyCsv();
  }

  _downloadFile(filename, content, mimeType) {
    this.telemetryUI?._downloadFile(filename, content, mimeType);
  }

  _updateActiveButtons() {
    document.querySelectorAll('.theme-select-btn').forEach(btn => {
      const match = btn.getAttribute('data-theme') === this.skinManager.currentThemeId;
      btn.style.borderColor = match ? 'var(--accent)' : 'rgba(255,255,255,0.12)';
      btn.style.background = match ? 'var(--glass-b)' : 'var(--glass)';
    });

    document.querySelectorAll('.skin-select-btn').forEach(btn => {
      const match = btn.getAttribute('data-skin') === this.skinManager.currentCharSkinId;
      btn.style.borderColor = match ? 'var(--accent2)' : 'rgba(255,255,255,0.12)';
      btn.style.background = match ? 'rgba(255,107,53,0.15)' : 'var(--glass)';
    });

    // Highlight active language
    document.querySelectorAll('.lang-btn').forEach(btn => {
      const active = btn.getAttribute('data-lang') === i18n.lang;
      btn.style.borderColor = active ? 'var(--accent)' : 'rgba(255,255,255,0.2)';
      btn.style.background = active ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.05)';
      btn.style.color = active ? 'var(--accent)' : 'rgba(255,255,255,0.7)';
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
    if (this.elDeathDist) this.elDeathDist.textContent = Math.floor(distance);
    if (this.elDeathBest) this.elDeathBest.textContent = Math.floor(bestScore);
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
      this.elCamFps.textContent = isLowLight ? `📹${camFps} ⚡` : `📹${camFps}`;
      this.elCamFps.style.color = isLowLight ? '#ffd700' : 'rgba(255,255,255,0.65)';
      this.elCamFps.title = isLowLight ? i18n.t('hud.cam.lowlight') : 'Camera FPS';
      if (this.elLowLightBadge) {
        if (isLowLight) this.elLowLightBadge.classList.remove('hidden');
        else this.elLowLightBadge.classList.add('hidden');
      }
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
    else this.elWebcamPip.classList.add('hidden');
  }

  updateAiPreloadProgress(progress, stage) {
    const elText = document.getElementById('menu-ai-text');
    const elIndicator = document.getElementById('menu-ai-indicator');
    const pct = Math.round((progress || 0) * 100);

    if (elText) {
      elText.textContent = `${this._t('menu.ai_loading')} (${pct}%)`;
    }
    if (elIndicator) {
      elIndicator.style.background = '#ffd700';
      elIndicator.style.boxShadow = '0 0 8px #ffd700';
    }

    if (this.elWebcamPip && !this.elWebcamPip.classList.contains('hidden')) {
      const activeMode = this.visionManager?.activeMode;
      if (this.visionManager && !this.visionManager.isModelReadyForMode(activeMode)) {
        this.setWebcamStatus(`${this._t('hud.cam.loading_models')} (${pct}%)`, '#ffd700');
      }
    }
  }

  onAiModelsReady() {
    const elText = document.getElementById('menu-ai-text');
    const elIndicator = document.getElementById('menu-ai-indicator');

    if (elText) {
      elText.textContent = this._t('menu.ai_ready');
      elText.style.color = 'rgba(0, 255, 136, 0.9)';
    }
    if (elIndicator) {
      elIndicator.style.background = '#00ff88';
      elIndicator.style.boxShadow = '0 0 10px #00ff88';
    }

    if (this.elWebcamPip && !this.elWebcamPip.classList.contains('hidden')) {
      this.setWebcamStatus(this._t('hud.cam.active'), '#00e5ff');
    }
  }

  announceStage(stageNumber, isLocked = false, cycle = null) {
    const currentDist = (this.elDist ? parseInt(this.elDist.textContent || '0', 10) : 0);
    this.transitionBanner.announceStage(stageNumber, isLocked, cycle, currentDist, this.soundFx);
    this._lastStageNumber = this.transitionBanner._lastStageNumber;
    this._lastIsLocked = this.transitionBanner._lastIsLocked;
    this._lastCycle = this.transitionBanner._lastCycle;
    this._selectedDebugStage = stageNumber;
    this._updateDebugStageButtons();
  }

  showTransitionCountdown(stageNumber, totalDuration, remainingSec, cycle = 0) {
    this.transitionBanner.showTransitionCountdown(stageNumber, totalDuration, remainingSec, cycle);
  }

  updateTransitionCountdown(remainingSec, totalDuration = 3.5) {
    this.transitionBanner.updateTransitionCountdown(remainingSec, totalDuration);
  }

  hideTransitionCountdown() {
    this.transitionBanner.hideTransitionCountdown();
  }

  _tStage(stageNumber, field) {
    return this.transitionBanner._tStage(stageNumber, field);
  }

  _tTransition(stageNumber) {
    return this.transitionBanner._tTransition(stageNumber);
  }
}
