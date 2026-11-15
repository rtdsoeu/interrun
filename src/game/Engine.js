import * as THREE from 'three';
import { CameraRig } from './CameraRig.js';
import { Runner, PlayerState } from './Runner.js';
import { Track } from './Track.js';
import { ObstacleManager } from './ObstacleManager.js';
import { ScoreSystem } from './ScoreSystem.js';
import { ControlManager } from '../controls/ControlManager.js';
import { KeyboardControl } from '../controls/KeyboardControl.js';
import { PointerControl } from '../controls/PointerControl.js';
import { FaceZoneControl } from '../controls/FaceZoneControl.js';
import { HandZoneControl } from '../controls/HandZoneControl.js';
import { FingerGestureControl } from '../controls/FingerGestureControl.js';
import { HandSwipeControl } from '../controls/HandSwipeControl.js';
import { TouchButtonControl } from '../controls/TouchButtonControl.js';
import { VisionManager } from '../vision/VisionManager.js';
import { SkinManager } from '../skins/SkinManager.js';
import { SoundFx } from '../audio/SoundFx.js';
import { Hud } from '../ui/Hud.js';
import { i18n } from '../i18n/I18n.js';
import { TelemetryManager } from '../analytics/TelemetryManager.js';
import { GestureBenchmark } from '../analytics/GestureBenchmark.js';
import { SurveyManager } from '../analytics/SurveyManager.js';
import { WakeLockManager } from './WakeLockManager.js';
import { ViewportManager } from './ViewportManager.js';
import { StageTransitionCoordinator } from './StageTransitionCoordinator.js';
import { DebugShortcuts } from './DebugShortcuts.js';
import { AdaptiveDifficultyManager } from './AdaptiveDifficultyManager.js';

export const GameState = {
  MENU: 'menu',
  PLAYING: 'playing',
  DEAD: 'dead'
};

/**
 * Engine — InterRun main game orchestrator.
 * Coordinates 3D rendering, gameplay state machine, control schemes, audio, and UI.
 *
 * Control stages:
 *   0 — KeyboardControl (WASD / Arrows) / TouchButtonControl (mobile D-pad)
 *   1 — PointerControl (Mouse + Touch swipes)
 *   2 — FaceZoneControl (Face Zone CV 3×3 grid)
 *   3 — HandZoneControl (Zone 3×3, hand only)
 *   4 — FingerGestureControl (finger gestures: 1/2/3 fingers, palm, fist)
 *   5 — HandSwipeControl (contactless air swipes)
 */
export class Engine {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;

    this.state = GameState.MENU;
    this.coins = 0;
    this.lives = 3;
    this.godMode = false;
    this.invulnerableTimer = 0;
    this._rafId = null;

    // 1. Audio, computer vision, and skin initialization
    this.soundFx = new SoundFx();
    this.soundFx.startBGM('menu');
    this.skinManager = new SkinManager();
    this.visionManager = new VisionManager();
    this.visionManager.preloadModels();

    // 2. Initialize Three.js scene & renderer
    this._initThree();

    // 3. Viewport and render scale management
    this.viewportManager = new ViewportManager({
      camera: this.camera,
      renderer: this.renderer
    });

    // 4. Game world components
    this.cameraRig = new CameraRig(this.camera);
    this.runner = new Runner(this.scene, this.soundFx);
    this.track = new Track(this.scene, this.skinManager);
    this.obstacleManager = new ObstacleManager(this.scene, this.skinManager, this.soundFx);
    this.obstacleManager.onHazardLanded = () => {
      if (this.cameraRig) this.cameraRig.addTrauma(0.25);
    };
    this.scoreSystem = new ScoreSystem();

    // 5. Control plugins
    this._initControls();

    // 6. HUD, UI and HCI Analytics
    this.telemetry = new TelemetryManager();
    this.adaptiveDifficulty = new AdaptiveDifficultyManager();
    this.telemetry.onReactionRecorded = ({ stage, ttcMs, actionType, currentSpeed, distAhead }) => {
      const res = this.adaptiveDifficulty.recordReaction(ttcMs, stage, currentSpeed || this.scoreSystem?.speed, actionType, distAhead);
      if (res?.isNearMiss) {
        this.soundFx?.playNearMiss?.();
        this.cameraRig?.addTrauma?.(0.12);
        this.scoreSystem?.addNearMiss?.();
        this.telemetry?.recordNearMiss?.();
        this.hud?.showToast?.(`🔥 NEAR-MISS! +150 (${res.distanceMeters}m)`, '#00e5ff');
      }
    };
    this.telemetry.onCollisionRecorded = ({ stage }) => {
      this.adaptiveDifficulty.recordCollision(stage);
    };

    this.gestureBenchmark = new GestureBenchmark();
    this.surveyManager = new SurveyManager();
    this.hud = new Hud(this.uiRoot, this.skinManager, this.soundFx, this.visionManager);
    this.hud.setAnalytics({
      telemetry: this.telemetry,
      benchmark: this.gestureBenchmark,
      survey: this.surveyManager
    });
    this._bindHUD();
    this.visionManager.onFpsUpdate = (cvFps, frametime, camFps) => this.hud.updateCvFPS(cvFps, frametime, camFps);
    this.visionManager.onSettingsCalibrated = (settings) => this.hud.syncVisionSettings(settings);
    this.visionManager.onPreloadProgress = (progress, stage) => this.hud.updateAiPreloadProgress(progress, stage);
    this.visionManager.onAllModelsReady = () => this.hud.onAiModelsReady();

    // 7. Stage transition coordinator
    this.transitionCoordinator = new StageTransitionCoordinator({
      scoreSystem: this.scoreSystem,
      obstacleManager: this.obstacleManager,
      soundFx: this.soundFx,
      hud: this.hud,
      onApplyStageSwitch: (stage) => this._applyStageSwitch(stage),
      checkStageReady: (stage) => this.visionManager.hasValidDetection(stage),
      onCalibrateAtEnd: (stage) => {
        // Only zone control stages (Stage 2: FaceZone, Stage 3: HandZone) perform zone calibration
        if (stage === 2 || stage === 3) {
          this.visionManager.recalibrate();
        }
      }
    });

    // 8. Debug hotkeys and keyboard shortcuts
    this.debugShortcuts = new DebugShortcuts({
      engine: this,
      hud: this.hud,
      soundFx: this.soundFx
    });

    // 9. Subscribe to theme and skin changes
    this._bindSkinManager();

    // 10. Language switch -> HUD rerender
    i18n.onLangChange = () => this.hud.rerender();

    // 11. Game loop timer and FPS counter
    this.timer = new THREE.Timer();
    this._frameCount = 0;
    this._fpsTimer = 0;
    this._prewarmedCam = false;

    // 12. Screen Wake Lock
    this.wakeLock = new WakeLockManager();

    // Initial theme application
    this._applySceneTheme(this.skinManager.activeTheme);
    this.runner.applySkin(this.skinManager.activeCharSkin);

    // Pre-bound callbacks to eliminate per-frame closure allocations in RAF
    this._boundAnimate = () => this._animate();
    this._boundOnPlayerHit = (hitObs) => this._onPlayerHit(hitObs);
    this._boundOnCoinCollected = () => { this.coins++; };

    // Start render loop
    this._animate();
  }

  get viewportFrame() {
    return this.viewportManager.viewportFrame;
  }

  get renderScale() {
    return this.viewportManager.renderScale;
  }

  get _transitioning() {
    return this.transitionCoordinator.isTransitioning;
  }

  _initThree() {
    this.scene = new THREE.Scene();

    const container = typeof document !== 'undefined' ? document.getElementById('game-container') : null;
    const w = container?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const h = container?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 720);

    this.camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 300);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(w, h, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // Scene lighting
    this.ambientLight = new THREE.AmbientLight(0x334466, 1.2);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0x88ccff, 1.8);
    this.dirLight.position.set(10, 20, 15);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 60;
    this.dirLight.shadow.camera.left = -10;
    this.dirLight.shadow.camera.right = 10;
    this.dirLight.shadow.camera.top = 10;
    this.dirLight.shadow.camera.bottom = -10;
    this.scene.add(this.dirLight);

    // Horizon fog
    this.scene.fog = new THREE.Fog(0x070b19, 25, 140);
  }

  _initControls() {
    this.controlManager = new ControlManager();

    // Stage 0: Keyboard (WASD / Arrows)
    const kb = new KeyboardControl();
    kb.onKeyPress = () => this.telemetry?.recordButtonPress();
    this.controlManager.register(0, kb);

    // Stage 1: Pointer swipes (mouse & touch)
    const pointer = new PointerControl();
    pointer.onPointerAction = () => this.telemetry?.recordButtonPress();
    this.controlManager.register(1, pointer);

    // Stage 2: Face Zone CV — 3×3 grid (face nose landmark)
    const faceZone = new FaceZoneControl(this.visionManager);
    faceZone.onZoneAction = ({ axis }) => {
      if (axis === 'lr') {
        this.telemetry?.recordHeadTilt('lr');
      } else if (axis === 'ud') {
        this.telemetry?.recordHeadTilt('ud');
      }
    };
    this.controlManager.register(2, faceZone);

    // Stage 3: HandZone — 3×3 grid (hand palm centroid)
    const handZone = new HandZoneControl(this.visionManager);
    handZone.onZoneAction = () => {
      this.telemetry?.recordHandGesture();
    };
    this.controlManager.register(3, handZone);

    // Stage 4: FingerGesture — finger gestures (1/2/3 fingers, palm, fist)
    const finger = new FingerGestureControl(this.visionManager);
    finger.onGesture = () => {
      this.telemetry?.recordHandGesture();
    };
    this.controlManager.register(4, finger);

    // Stage 5: HandSwipe — contactless air swipes (left, right, up, down)
    const handSwipe = new HandSwipeControl(this.visionManager);
    handSwipe.onSwipe = () => {
      this.telemetry?.recordHandGesture();
    };
    handSwipe.onFallbackPress = () => {
      this.telemetry?.recordButtonPress();
    };
    this.controlManager.register(5, handSwipe);

    // On touch devices Stage 0 is replaced by virtual D-pad
    if (this._isTouchDevice()) {
      this._touchButtons = new TouchButtonControl();
      this._touchButtons.onButtonPress = () => this.telemetry?.recordButtonPress();
      this.controlManager.register(0, this._touchButtons);
    }

    this.scoreSystem.onStageChange = (newStage) => {
      // If debug locked or not playing, switch stage immediately without countdown
      if (this.scoreSystem.lockedStage !== null || this.state !== GameState.PLAYING) {
        this.transitionCoordinator.cancelTransition();
        this._applyStageSwitch(newStage);
        return;
      }

      // Check if this is normal forward progression (e.g. 0->1) or looping back to Stage 0 (5->0)
      const currentStage = this.controlManager.stage;
      const isLoop = (currentStage === 5 && newStage === 0);
      const isForward = (newStage === currentStage + 1) || isLoop;

      if (!isForward) {
        this.transitionCoordinator.cancelTransition();
        this._applyStageSwitch(newStage);
        return;
      }

      // Smooth stage transition with top countdown banner and safe runway
      this.transitionCoordinator.startTransition(newStage);
    };
  }

  _applyStageSwitch(stage) {
    this.telemetry?.recordStageTransition(stage, this.scoreSystem.distance);
    const isCvStage = stage >= 2;
    this.hud.showCvFps(isCvStage);
    this.hud.announceStage(stage, this.scoreSystem.lockedStage !== null, this.scoreSystem.cycle);

    if (isCvStage && this.visionManager.hasCameraError) {
      this.hud.showWebcamPip(false, stage);
      // Seamless fallback to Stage 1 PointerControl (touch swipes / mouse)
      this.controlManager.setStage(1);
      this.hud.setWebcamStatus(i18n.t('hud.cam.offline_fallback'), '#ff6b35');
      this.hud.showCameraErrorModal(this.visionManager.lastError);
      return;
    }

    if (isCvStage) {
      this.wakeLock?.request();
      if (!this.visionManager.isReady && !this.visionManager.hasCameraError) {
        this.visionManager.initWebcam(this.hud.elWebcamCanvas).catch(() => {});
      }
      if (this.visionManager.settings?.pipMode !== 'off') {
        this.hud.showWebcamPip(true, stage);
      }

      const stageMode = stage === 2 ? 'zone'
                      : stage === 3 ? 'handzone'
                      : stage === 4 ? 'fingergesture'
                      : stage === 5 ? 'handswipe'
                      : null;
      if (stageMode) {
        this.visionManager.setMode(stageMode);
      }
      if (this.visionManager.isModelReadyForMode(stageMode)) {
        this.hud.setWebcamStatus(i18n.t('hud.cam.active'));
      } else {
        const pct = Math.round((this.visionManager.preloadProgress || 0) * 100);
        this.hud.setWebcamStatus(`${i18n.t('hud.cam.loading_models')} (${pct}%)`, '#ffd700');
      }
    } else {
      this.hud.showWebcamPip(false, stage);
      this.visionManager.setMode(null);
    }

    this.controlManager.setStage(stage);
  }

  /** Detect touch device */
  _isTouchDevice() {
    return ('ontouchstart' in window) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
  }

  _bindHUD() {
    const warmUpCameraOnGesture = () => {
      // iOS Safari requires getUserMedia to be directly triggered by an active user touch/click gesture
      if (!this.visionManager.isReady && !this.visionManager.hasCameraError) {
        this.visionManager.initWebcam(this.hud.elWebcamCanvas).catch(() => {});
      }
    };

    this.hud.onStartGame = (stage = 0, isLocked = false, isGod = false, speedMultiplier = 1.0, isDda = true) => {
      warmUpCameraOnGesture();
      this.startGame(stage, isLocked, isGod, speedMultiplier, isDda);
    };

    this.hud.onRestartGame = (speedMultiplier = 1.0) => {
      warmUpCameraOnGesture();
      this.startGame(0, false, false, speedMultiplier);
    };

    this.hud.onStartDebug = (stage, isLocked, isGod, speedMultiplier, isDda = true) => {
      warmUpCameraOnGesture();
      this.startGame(stage, isLocked, isGod, speedMultiplier, isDda);
    };

    this.hud.onApplyLiveDebug = (stage, isLocked, isGod, speedMultiplier, isDda = true) => {
      this.godMode = isGod;
      if (this.adaptiveDifficulty) this.adaptiveDifficulty.setEnabled(isDda);
      this.setDebugStage(stage, isLocked, speedMultiplier, isDda);
    };

    this.hud.onRetryCamera = async () => {
      this.hud.closeCameraErrorModal();
      const ok = await this.visionManager.initWebcam(this.hud.elWebcamCanvas);
      if (ok && this.scoreSystem.stage >= 2) {
        this._applyStageSwitch(this.scoreSystem.stage);
      }
    };

    this.visionManager.onCameraError = (errorInfo) => {
      console.warn('[Engine] VisionManager camera error:', errorInfo);
      const isCvStage = this.scoreSystem.stage >= 2;
      if (isCvStage || this.transitionCoordinator.isTransitioning) {
        this.hud.showCameraErrorModal(errorInfo);
        this.controlManager.setStage(1);
        this.hud.setWebcamStatus(i18n.t('hud.cam.offline_fallback'), '#ff6b35');
      }
    };

    this.hud.onToggleCamera = async () => {
      // Disallow camera preview on non-CV stages (keyboard & mouse)
      if (this.scoreSystem.stage < 2) {
        return;
      }
      if (!this.visionManager.isReady) {
        const ok = await this.visionManager.initWebcam(this.hud.elWebcamCanvas);
        if (!ok && this.visionManager.lastError) {
          this.hud.showCameraErrorModal(this.visionManager.lastError);
        }
      }
      const pip = this.hud.elWebcamPip;
      const isHidden = !pip || pip.classList.contains('hidden');
      this.hud.showWebcamPip(isHidden);
      this.hud.showCvFps(true);
    };

    this.hud.onGoToMenu = () => this.goToMenu();

    this.hud.onToggleSound = () => {
      const isMuted = this.soundFx.toggleMute();
      this.hud.updateSoundState(isMuted);
    };

    this.hud.onUpdateAudioSettings = (settings) => {
      if (settings.sfxVolume !== undefined) this.soundFx.setSfxVolume(settings.sfxVolume);
      if (settings.bgmVolume !== undefined) this.soundFx.setBgmVolume(settings.bgmVolume);
      if (settings.muted !== undefined) this.soundFx.setMuted(settings.muted);
      this.hud.updateSoundState(this.soundFx.muted);
    };

    this.hud.onApplyDisplaySettings = (settings) => {
      if (settings.viewportFrame !== undefined) {
        this.setViewportFrame(settings.viewportFrame);
      }
      if (settings.renderScale !== undefined) {
        this.setRenderScale(settings.renderScale);
      }
    };

    this.hud.onApplySettings = (settings) => {
      if (settings?.speedMultiplier !== undefined) {
        this.scoreSystem.setSpeedMultiplier(settings.speedMultiplier);
      }
    };
  }

  goToMenu() {
    this.state = GameState.MENU;
    this.wakeLock?.release();
    this.transitionCoordinator.cancelTransition();
    this.scoreSystem.stop();
    this.controlManager.setStage(-1);
    this.soundFx?.setBgmMode('menu');
    this.hud.showMenu();
  }

  setDebugStage(stageNum, lock = true, speedMultiplier = null, isDda = null) {
    if (stageNum < 0 || stageNum > 5) return;

    if (this.state === GameState.MENU || this.state === GameState.DEAD) {
      this.hud.closeAllModals();
      this.startGame(stageNum, lock, this.godMode, speedMultiplier || this.scoreSystem.speedMultiplier, isDda ?? true);
      return;
    }

    this.transitionCoordinator.cancelTransition();
    if (isDda !== null && this.adaptiveDifficulty) {
      this.adaptiveDifficulty.setEnabled(isDda);
    }

    // Fast-forward distance to stage threshold so subsequent update() calls do not downgrade stage
    const threshold = this.scoreSystem.STAGE_THRESHOLDS[stageNum] || 0;
    if (this.scoreSystem.distance < threshold) {
      this.scoreSystem.distance = threshold;
    }

    if (speedMultiplier !== null && speedMultiplier !== undefined) {
      this.scoreSystem.setSpeedMultiplier(speedMultiplier);
    }

    this.scoreSystem.setLockedStage(lock ? stageNum : null);
    this._applyStageSwitch(stageNum);
  }

  toggleGodMode() {
    this.godMode = !this.godMode;
    console.log(`[InterRun] God Mode: ${this.godMode ? 'ON' : 'OFF'}`);
    if (this.hud?.elOptGod) this.hud.elOptGod.checked = this.godMode;
    this.hud.updateHUD(this.scoreSystem.distance, this.scoreSystem.speedNorm, this.coins, this.lives, this.godMode, this.scoreSystem.lockedStage !== null);
  }

  toggleStageLock() {
    const isLocked = this.scoreSystem.toggleLock();
    if (this.hud?.elOptLock) this.hud.elOptLock.checked = isLocked;
    this.hud.announceStage(this.scoreSystem.stage, isLocked, this.scoreSystem.cycle);
  }

  _bindSkinManager() {
    this.skinManager.onChange((type, data) => {
      if (type === 'theme') {
        this._applySceneTheme(data);
        this.track.applyTheme(data);
        this.obstacleManager.applyTheme(data);
      } else if (type === 'character') {
        this.runner.applySkin(data);
      }
    });
  }

  _applySceneTheme(theme) {
    if (!theme) return;
    this.scene.background = new THREE.Color(theme.skyColor);
    if (this.scene.fog) {
      this.scene.fog.color.setHex(theme.fogColor);
      this.scene.fog.near = theme.fogNear;
      this.scene.fog.far = theme.fogFar;
    }
    this.ambientLight.color.setHex(theme.ambientLight);
    this.dirLight.color.setHex(theme.directionalLight);
  }

  _handleResize() {
    this.viewportManager.handleResize();
  }

  setViewportFrame(frame) {
    this.viewportManager.applyViewportFrame(frame);
  }

  setRenderScale(scale) {
    this.viewportManager.applyRenderScale(scale);
  }

  startGame(stage = 0, isLocked = false, isGodMode = false, speedMultiplier = 1.0, isDda = true) {
    this.telemetry?.startSession(stage, isLocked, speedMultiplier);
    this.adaptiveDifficulty?.reset();
    if (this.adaptiveDifficulty) {
      this.adaptiveDifficulty.setEnabled(isDda);
    }
    this.coins = 0;
    this.lives = 3;
    this.godMode = isGodMode;
    this.invulnerableTimer = 0;
    this._prewarmedCam = false;

    this.runner.reset();
    this.track.reset();
    this.obstacleManager.reset();
    this.transitionCoordinator.cancelTransition();

    this.scoreSystem.start(stage, isLocked, speedMultiplier);
    this._applyStageSwitch(stage);

    this.soundFx?.unlock();
    this.soundFx?.setBgmMode('game');

    this.cameraRig.reset(this.runner.pos);

    this.wakeLock?.request();
    this.state = GameState.PLAYING;
    this.hud.showGame();
  }

  gameOver() {
    this.state = GameState.DEAD;
    this.wakeLock?.release();
    this.transitionCoordinator.cancelTransition();
    this.scoreSystem.stop();
    const ddaMetrics = this.adaptiveDifficulty?.getMetrics();
    const kinSummary = this.telemetry?.getKinematicSummary();
    const actionCounters = this.telemetry?.getActionCounters() || {
      buttonPresses: 0,
      headTiltsLeftRight: 0,
      headTiltsUpDown: 0,
      totalHeadTilts: 0,
      handGestures: 0,
      nearMisses: this.scoreSystem.nearMisses || 0,
      totalActions: 0
    };
    if (this.scoreSystem?.nearMisses && !actionCounters.nearMisses) {
      actionCounters.nearMisses = this.scoreSystem.nearMisses;
    }
    this.telemetry?.endSession(this.scoreSystem.distance, this.scoreSystem.bestScore, this.coins, ddaMetrics);
    this.controlManager.setStage(-1);
    this.soundFx?.setBgmMode('dead');

    this.runner.crash();
    this.cameraRig.addTrauma(0.9);

    setTimeout(() => {
      this.hud.showGameOver(this.scoreSystem.distance, this.scoreSystem.bestScore, this.coins, {
        actions: actionCounters,
        dda: ddaMetrics,
        kinematics: kinSummary
      });
    }, 900);
  }

  _onPlayerHit(obstacle) {
    if (this.invulnerableTimer > 0) return;
    if (this.hud?.elCamErrorModal && !this.hud.elCamErrorModal.classList.contains('hidden')) return;

    this.telemetry?.recordCollision(this.scoreSystem.stage, this.scoreSystem.distance, obstacle?.type || '');

    if (this.godMode) {
      this.cameraRig.addTrauma(0.4);
      this.invulnerableTimer = 0.8;
      if (this.soundFx) this.soundFx.playCrash();
      return;
    }

    this.lives--;
    this.cameraRig.addTrauma(0.6);

    if (this.lives <= 0) {
      this.gameOver();
    } else {
      this.invulnerableTimer = 1.3;
      if (this.soundFx) this.soundFx.playCrash();
    }
  }

  _animate() {
    this._rafId = requestAnimationFrame(this._boundAnimate);

    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.08);

    // FPS counter
    this._frameCount++;
    this._fpsTimer += dt;
    if (this._fpsTimer >= 0.25) {
      const fps = Math.round(this._frameCount / this._fpsTimer);
      this._frameCount = 0;
      this._fpsTimer = 0;
      this.hud.updateFPS(fps);
      this.telemetry?.sampleFps(fps, this.visionManager?.cvFps || 0, this.scoreSystem.stage);
    }

    if (this.state === GameState.PLAYING) {
      // Early background camera pre-warm as soon as player reaches Stage 1 (Mouse/Pointer stage)
      if (!this._prewarmedCam && (this.scoreSystem.stage >= 1 || this.scoreSystem.distance >= 300)) {
        this._prewarmedCam = true;
        if (!this.visionManager.isReady && !this.visionManager.hasCameraError) {
          this.visionManager.initWebcam(this.hud.elWebcamCanvas).catch(() => {});
        }
      }

      // Transition countdown update
      this.transitionCoordinator.update(dt);

      // Adaptive DDA loop: update flow metrics and modulate speed & spacing
      this.adaptiveDifficulty?.update(dt, this.scoreSystem.stage);
      this.scoreSystem.setAdaptiveMultiplier(this.adaptiveDifficulty?.speedMultiplier ?? 1.0);
      this.obstacleManager.setAdaptiveParameters(
        this.adaptiveDifficulty?.spacingMultiplier ?? 1.0,
        this.adaptiveDifficulty?.doubleFactor ?? 1.0
      );

      this.scoreSystem.update(dt);
      const speed = this.scoreSystem.speed;
      const speedNorm = this.scoreSystem.speedNorm;
      const difficulty = this.scoreSystem.difficulty;

      this.visionManager.update();
      if (this.visionManager.currentState?.kinematics) {
        this.telemetry.recordKinematics(this.visionManager.currentState.kinematics);
      }
      this.controlManager.update(dt);
      const input = this.controlManager.consume();

      // Execute runner gameplay actions immediately (zero latency, immune to telemetry/audio exceptions)
      this.runner.handleInput(input);

      // Async/non-blocking telemetry & DDA reaction recording
      if (input.laneDelta !== 0 || input.targetLane !== undefined || input.jump || input.slide || input.isDucking) {
        try {
          // Find nearest oncoming obstacle in front of runner to calculate physical Time-To-Collision (TTC)
          let nearestObsZ = null;
          let minAhead = Infinity;
          if (this.obstacleManager?.activeObstacles) {
            for (let i = 0; i < this.obstacleManager.activeObstacles.length; i++) {
              const obs = this.obstacleManager.activeObstacles[i];
              if (!obs?.mesh) continue;
              const distAhead = this.runner.pos.z - obs.mesh.position.z;
              if (distAhead > 0 && distAhead < minAhead) {
                minAhead = distAhead;
                nearestObsZ = obs.mesh.position.z;
              }
            }
          }
          this.telemetry?.recordPlayerAction(
            input.jump ? 'jump' : (input.slide || input.isDucking ? 'slide' : 'lane'),
            speed,
            this.runner.pos.z,
            nearestObsZ
          );
        } catch (telemetryErr) {
          console.warn('[Engine] Telemetry recordPlayerAction failed:', telemetryErr);
        }
      }

      this.runner.update(dt, speed);

      if (this.invulnerableTimer > 0) {
        this.invulnerableTimer -= dt;
        const blink = Math.floor(this.invulnerableTimer * 14) % 2 === 0;
        this.runner.meshGroup.visible = blink;
      } else {
        this.runner.meshGroup.visible = true;
      }

      this.track.update(dt, speed);

      this.obstacleManager.update(
        dt, speed, difficulty,
        this.runner.hitbox,
        this._boundOnPlayerHit,
        this._boundOnCoinCollected,
        this.scoreSystem.distance
      );

      if (this.obstacleManager?.activeObstacles) {
        for (let i = 0; i < this.obstacleManager.activeObstacles.length; i++) {
          const obs = this.obstacleManager.activeObstacles[i];
          if (!obs?.mesh) continue;
          const relZ = obs.mesh.position.z - this.runner.pos.z;
          if (relZ <= -18 && relZ >= -28) {
            this.telemetry?.recordObstacleHorizon(obs.mesh.uuid || i, this.scoreSystem.distance, obs.lane, obs.type, obs.mesh.position.z);
          }
        }
      }

      this.cameraRig.update(dt, this.runner.pos, this.runner.xVelocity, speedNorm,
        this.runner.state === PlayerState.SLIDING);

      this.hud.updateHUD(
        this.scoreSystem.distance, speedNorm, this.coins, this.lives,
        this.godMode, this.scoreSystem.lockedStage !== null
      );

    } else if (this.state === GameState.MENU) {
      if (this.visionManager?.isReady) this.visionManager.update();
      this.track.update(dt, 7);
      this.runner.update(dt, 7);
      this.cameraRig.update(dt, this.runner.pos, 0, 0.1, false);

    } else if (this.state === GameState.DEAD) {
      if (this.visionManager?.isReady) this.visionManager.update();
      this.runner.update(dt, 0);
      this.cameraRig.update(dt, this.runner.pos, 0, 0, false);
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Disposes of Engine resources, animation loops, and event listeners.
   */
  dispose() {
    if (this._rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    this.viewportManager?.dispose();
    this.debugShortcuts?.dispose();
    this.wakeLock?.release();
    this.controlManager?.setStage(-1);
    this.soundFx?.stopBGM();

    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
