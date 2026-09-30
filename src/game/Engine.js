import * as THREE from 'three';
import { CameraRig } from './CameraRig.js';
import { Runner, PlayerState } from './Runner.js';
import { Track } from './Track.js';
import { ObstacleManager } from './Obstacles.js';
import { ScoreSystem } from './ScoreSystem.js';
import { ControlManager } from '../controls/ControlManager.js';
import { KeyboardControl } from '../controls/KeyboardControl.js';
import { PointerControl } from '../controls/PointerControl.js';
import { ZoneControl } from '../controls/ZoneControl.js';
import { HandZoneControl } from '../controls/HandZoneControl.js';
import { FingerGestureControl } from '../controls/FingerGestureControl.js';
import { HandSwipeControl } from '../controls/HandSwipeControl.js';
import { TouchButtonControl } from '../controls/TouchButtonControl.js';
import { VisionManager } from '../vision/VisionManager.js';
import { SkinManager } from '../skins/SkinManager.js';
import { SoundFx } from '../audio/SoundFx.js';
import { HUD } from '../ui/HUD.js';
import { i18n } from '../i18n/i18n.js';

export const GameState = {
  MENU: 'menu',
  PLAYING: 'playing',
  DEAD: 'dead'
};

/**
 * Engine — InterRun main game core.
 * Control stages:
 *   0 — KeyboardControl (WASD / Arrows) / TouchButtonControl (mobile D-pad)
 *   1 — PointerControl (Mouse + Touch swipes)
 *   2 — ZoneControl (Zone CV 3×3 grid, hand priority, face fallback)
 *   3 — HandZoneControl (Zone 3×3, hand only)
 *   4 — FingerGestureControl (finger gestures: 1/2/3 fingers, palm, fist)
 *   5 — HandSwipeControl (air swipes left/right/up/down)
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

    // 1. Audio, computer vision, and skin initialisation
    this.soundFx = new SoundFx();
    this.soundFx.startBGM('menu');
    this.skinManager = new SkinManager();
    this.visionManager = new VisionManager();
    // Start background model preload while the menu is visible — eliminates the
    // loading delay when the player first reaches a CV stage (Stage 2+)
    this.visionManager.preloadModels();

    // Display settings (Viewport Frame & 3D Render Scale)
    const savedFrame = typeof localStorage !== 'undefined' ? localStorage.getItem('interrun_viewport_frame') : null;
    const savedScale = typeof localStorage !== 'undefined' ? localStorage.getItem('interrun_render_scale') : null;
    this.viewportFrame = savedFrame || 'full';
    this.renderScale = savedScale ? parseFloat(savedScale) : 1.0;

    // 2. Initialize Three.js
    this._initThree();

    // 3. Game components
    this.cameraRig = new CameraRig(this.camera);
    this.runner = new Runner(this.scene, this.soundFx);
    this.track = new Track(this.scene, this.skinManager);
    this.obstacleManager = new ObstacleManager(this.scene, this.skinManager, this.soundFx);
    this.scoreSystem = new ScoreSystem();

    // 4. Control plugins
    this._initControls();

    // 5. HUD and UI
    this.hud = new HUD(this.uiRoot, this.skinManager, this.soundFx, this.visionManager);
    this._bindHUD();
    this.visionManager.onFpsUpdate = (cvFps, frametime, camFps) => this.hud.updateCvFPS(cvFps, frametime, camFps);
    this.visionManager.onSettingsCalibrated = (settings) => this.hud.syncVisionSettings(settings);

    // 6. Debug hotkeys
    this._bindDebugShortcuts();

    // 7. Subscribe to theme and skin changes
    this._bindSkinManager();

    // 8. Language switch -> HUD rerender
    i18n.onLangChange = () => this.hud.rerender();

    // 9. Game loop timer and FPS counter (using modern THREE.Timer)
    this.timer = new THREE.Timer();
    this._frameCount = 0;
    this._fpsTimer = 0;
    this._onResize = () => this._handleResize();
    window.addEventListener('resize', this._onResize);
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._onResize);
      window.visualViewport.addEventListener('scroll', this._onResize);
    }

    // 10. Stage transition & early camera pre-warm
    this._transitioning = false;
    this._transitionTimer = 0;
    this._transitionDuration = 3.5;
    this._transitionTargetStage = null;
    this._prewarmedCam = false;

    // Initial theme application
    this._applySceneTheme(this.skinManager.activeTheme);
    this.runner.applySkin(this.skinManager.activeCharSkin);

    // Apply viewport frame & observe container size
    this.setViewportFrame(this.viewportFrame);
    const container = typeof document !== 'undefined' ? document.getElementById('game-container') : null;
    if (container && typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this._handleResize());
      this._resizeObserver.observe(container);
    }

    // Pre-bound callbacks to eliminate per-frame closure allocations in requestAnimationFrame
    this._boundAnimate = () => this._animate();
    this._boundOnPlayerHit = (hitObs) => this._onPlayerHit(hitObs);
    this._boundOnCoinCollected = () => { this.coins++; };

    // Start render loop
    this._animate();
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
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2) * this.renderScale;
    this.renderer.setPixelRatio(dpr);
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
    this.controlManager.register(0, new KeyboardControl());

    // Stage 1: Pointer swipes (mouse & touch)
    this.controlManager.register(1, new PointerControl());

    // Stage 2: Zone CV — 3×3 grid (hand priority, face fallback)
    this.controlManager.register(2, new ZoneControl(this.visionManager));

    // Stage 3: HandZone — 3×3 grid, hand only
    this.controlManager.register(3, new HandZoneControl(this.visionManager));

    // Stage 4: FingerGesture — finger gestures (1/2/3 fingers, palm, fist)
    this.controlManager.register(4, new FingerGestureControl(this.visionManager));

    // Stage 5: HandSwipe — contactless air swipes (left, right, up, down)
    this.controlManager.register(5, new HandSwipeControl(this.visionManager));

    // On touch devices Stage 0 is replaced by virtual D-pad,
    // while Stage 1 remains PointerControl (native swipe gestures on screen)
    if (this._isTouchDevice()) {
      this._touchButtons = new TouchButtonControl();
      this.controlManager.register(0, this._touchButtons);
    }

    this.scoreSystem.onStageChange = (newStage) => {
      // If debug locked or not playing, switch stage immediately without countdown
      if (this.scoreSystem.lockedStage !== null || this.state !== GameState.PLAYING) {
        this._transitioning = false;
        this.hud.hideTransitionCountdown();
        this.obstacleManager.setTransitioning(false);
        this.scoreSystem.setTransitioning(false);
        this._applyStageSwitch(newStage);
        return;
      }

      // Check if this is normal forward progression (e.g. 0->1) or looping back to Stage 0 (5->0)
      const currentStage = this.controlManager.stage;
      const isLoop = (currentStage === 5 && newStage === 0);
      const isForward = (newStage === currentStage + 1) || isLoop;

      if (!isForward) {
        this._transitioning = false;
        this.hud.hideTransitionCountdown();
        this.obstacleManager.setTransitioning(false);
        this.scoreSystem.setTransitioning(false);
        this._applyStageSwitch(newStage);
        return;
      }

      // Smooth stage transition with top countdown banner and safe runway
      this._startStageTransition(newStage);
    };
  }

  _startStageTransition(newStage) {
    this._transitioning = true;
    this._transitionDuration = 3.5;
    this._transitionTimer = 3.5;
    this._transitionTargetStage = newStage;

    this.scoreSystem.setTransitioning(true);
    this.obstacleManager.setTransitioning(true);
    this.soundFx?.setBgmMode('transition');

    // Switch model & controller immediately so cold start / shader compilation
    // finishes during the safe runway, before obstacles resume.
    this._applyStageSwitch(newStage);

    this.hud.showTransitionCountdown(newStage, this._transitionDuration, this._transitionTimer, this.scoreSystem.cycle);
  }

  _applyStageSwitch(stage) {
    const isCvStage = stage >= 2;
    this.hud.showCvFps(isCvStage);
    if (isCvStage) {
      if (!this.visionManager.isReady) {
        this.visionManager.initWebcam(this.hud.elWebcamCanvas);
      }
      if (this.visionManager.settings?.pipMode !== 'off') {
        this.hud.showWebcamPip(true);
      }
      this.hud.setWebcamStatus(i18n.t('hud.cam.active'));
    } else {
      this.hud.showWebcamPip(false);
    }

    this.controlManager.setStage(stage);
    this.hud.announceStage(stage, this.scoreSystem.lockedStage !== null, this.scoreSystem.cycle);
  }

  /** Detect touch device */
  _isTouchDevice() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  _bindHUD() {
    this.hud.onStartGame = () => this.startGame(0, false, false);
    this.hud.onRestartGame = () => this.startGame(0, false, false);

    this.hud.onStartDebug = (stage, isLocked, isGod, speedMultiplier) => {
      this.startGame(stage, isLocked, isGod, speedMultiplier);
    };

    this.hud.onApplyLiveDebug = (stage, isLocked, isGod, speedMultiplier) => {
      this.godMode = isGod;
      this.setDebugStage(stage, isLocked, speedMultiplier);
    };

    this.hud.onToggleCamera = () => {
      if (!this.visionManager.isReady) {
        this.visionManager.initWebcam(this.hud.elWebcamCanvas);
      }
      const pip = this.hud.elWebcamPip;
      const isHidden = !pip || pip.classList.contains('hidden');
      this.hud.showWebcamPip(isHidden);
      // Keep CV FPS visible on CV stages (Stage 2-5) even if the preview window is closed
      const isCvStage = this.scoreSystem.stage >= 2;
      this.hud.showCvFps(isCvStage);
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
  }

  _bindDebugShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key;

      // Escape: Close modals or return to main menu during gameplay
      if (key === 'Escape') {
        if (this.hud.isAnyModalOpen()) {
          this.hud.closeAllModals();
        } else if (this.state === GameState.PLAYING) {
          this.goToMenu();
        }
        return;
      }

      // Keys 0-5: instant stage select & lock
      if (key >= '0' && key <= '5') {
        this.setDebugStage(parseInt(key, 10), true);
        return;
      }

      // G: God Mode
      if (e.code === 'KeyG' || key === 'g' || key === 'G') {
        this.toggleGodMode();
        return;
      }

      // L: Stage lock
      if (e.code === 'KeyL' || key === 'L' || key === 'l') {
        this.toggleStageLock();
        return;
      }

      // F2 / ` / ~: Debug panel
      if (e.code === 'Backquote' || key === '`' || key === '~' || key === 'F2') {
        e.preventDefault();
        this.hud.toggleDebugModal();
        return;
      }

      // M: Toggle audio mute
      if (e.code === 'KeyM' || key === 'm' || key === 'M') {
        const isMuted = this.soundFx.toggleMute();
        this.hud.updateSoundState(isMuted);
        return;
      }
    });
  }

  goToMenu() {
    this.state = GameState.MENU;
    this._transitioning = false;
    this.hud.hideTransitionCountdown();
    this.obstacleManager.setTransitioning(false);
    this.scoreSystem.setTransitioning(false);
    this.scoreSystem.stop();
    this.controlManager.setStage(-1);
    this.soundFx?.setBgmMode('menu');
    this.hud.showMenu();
  }

  setDebugStage(stageNum, lock = true, speedMultiplier = null) {
    if (stageNum < 0 || stageNum > 5) return;

    this._transitioning = false;
    this.hud.hideTransitionCountdown();
    this.obstacleManager.setTransitioning(false);
    this.scoreSystem.setTransitioning(false);

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
  }

  toggleStageLock() {
    const isLocked = this.scoreSystem.toggleLock();
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
    const container = typeof document !== 'undefined' ? (document.getElementById('game-container') || document.body) : null;
    const maxH = typeof window !== 'undefined'
      ? (window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight)
      : 720;
    const maxW = typeof window !== 'undefined'
      ? (window.visualViewport ? Math.round(window.visualViewport.width) : window.innerWidth)
      : 1280;

    let w = container?.clientWidth || maxW;
    let h = container?.clientHeight || maxH;

    // Safety guard: in fullscreen mode on mobile browsers, ensure canvas never exceeds
    // the true visible visual viewport (eliminates bottom 15-20px overflow beneath navigation bar)
    if (this.viewportFrame === 'full') {
      if (h > maxH) h = maxH;
      if (w > maxW) w = maxW;
    }

    if (w <= 0 || h <= 0) return;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  setViewportFrame(frame) {
    this.viewportFrame = frame;
    const container = typeof document !== 'undefined' ? document.getElementById('game-container') : null;
    if (container) {
      container.classList.remove('frame-full', 'frame-16-9', 'frame-mobile', 'frame-4-3');
      container.classList.add(`frame-${frame}`);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('interrun_viewport_frame', frame);
    }
    requestAnimationFrame(() => this._handleResize());
    setTimeout(() => this._handleResize(), 320);
  }

  setRenderScale(scale) {
    this.renderScale = scale;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('interrun_render_scale', String(scale));
    }
    if (this.renderer) {
      const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2) * scale;
      this.renderer.setPixelRatio(dpr);
    }
    this._handleResize();
  }

  startGame(stage = 0, isLocked = false, isGodMode = false, speedMultiplier = 1.0) {
    this.coins = 0;
    this.lives = 3;
    this.godMode = isGodMode;
    this.invulnerableTimer = 0;
    this._transitioning = false;
    this._prewarmedCam = false;

    this.runner.reset();
    this.track.reset();
    this.obstacleManager.reset();
    this.obstacleManager.setTransitioning(false);
    this.scoreSystem.setTransitioning(false);
    this.hud.hideTransitionCountdown();

    this.scoreSystem.start(stage, isLocked, speedMultiplier);
    this._applyStageSwitch(stage);

    this.soundFx?.unlock();
    this.soundFx?.setBgmMode('game');

    this.cameraRig.reset(this.runner.pos);

    this.state = GameState.PLAYING;
    this.hud.showGame();
  }

  gameOver() {
    this.state = GameState.DEAD;
    this._transitioning = false;
    this.hud.hideTransitionCountdown();
    this.obstacleManager.setTransitioning(false);
    this.scoreSystem.setTransitioning(false);
    this.scoreSystem.stop();
    this.controlManager.setStage(-1);
    this.soundFx?.setBgmMode('dead');

    this.runner.crash();
    this.cameraRig.addTrauma(0.9);

    setTimeout(() => {
      this.hud.showGameOver(this.scoreSystem.distance, this.scoreSystem.bestScore, this.coins);
    }, 900);
  }

  _onPlayerHit(obstacle) {
    if (this.invulnerableTimer > 0) return;

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
    requestAnimationFrame(this._boundAnimate);

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
    }

    if (this.state === GameState.PLAYING) {
      // Early background camera pre-warm as soon as player reaches Stage 1 (Mouse/Pointer stage)
      if (!this._prewarmedCam && (this.scoreSystem.stage >= 1 || this.scoreSystem.distance >= 300)) {
        this._prewarmedCam = true;
        if (!this.visionManager.isReady) {
          this.visionManager.initWebcam(this.hud.elWebcamCanvas);
        }
      }

      // Transition countdown update
      if (this._transitioning) {
        this._transitionTimer -= dt;
        this.hud.updateTransitionCountdown(this._transitionTimer, this._transitionDuration);

        if (this._transitionTimer <= 0) {
          this._transitioning = false;
          this.hud.hideTransitionCountdown();
          this.obstacleManager.setTransitioning(false);
          this.scoreSystem.setTransitioning(false);
          this.soundFx?.setBgmMode('game');
        }
      }

      this.scoreSystem.update(dt);
      const speed = this.scoreSystem.speed;
      const speedNorm = this.scoreSystem.speedNorm;
      const difficulty = this.scoreSystem.difficulty;

      this.visionManager.update();
      this.controlManager.update(dt);
      const input = this.controlManager.consume();
      this.runner.handleInput(input);

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
        this._boundOnCoinCollected
      );

      this.cameraRig.update(dt, this.runner.pos, this.runner.xVelocity, speedNorm,
        this.runner.state === PlayerState.SLIDING);

      this.hud.updateHUD(
        this.scoreSystem.distance, speedNorm, this.coins, this.lives,
        this.godMode, this.scoreSystem.lockedStage !== null
      );

    } else if (this.state === GameState.MENU) {
      this.track.update(dt, 7);
      this.runner.update(dt, 7);
      this.cameraRig.update(dt, this.runner.pos, 0, 0.1, false);

    } else if (this.state === GameState.DEAD) {
      this.runner.update(dt, 0);
      this.cameraRig.update(dt, this.runner.pos, 0, 0, false);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
