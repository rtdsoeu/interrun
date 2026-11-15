import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ViewportManager } from '../src/game/ViewportManager.js';
import { StageTransitionCoordinator } from '../src/game/StageTransitionCoordinator.js';
import { DebugShortcuts } from '../src/game/DebugShortcuts.js';
import { GameState } from '../src/game/Engine.js';

describe('ViewportManager', () => {
  let mockCamera;
  let mockRenderer;
  let mockContainer;

  beforeEach(() => {
    mockCamera = {
      aspect: 1,
      updateProjectionMatrix: vi.fn()
    };
    mockRenderer = {
      setSize: vi.fn(),
      setPixelRatio: vi.fn()
    };
    mockContainer = {
      clientWidth: 1280,
      clientHeight: 720,
      classList: {
        remove: vi.fn(),
        add: vi.fn()
      }
    };
  });

  it('initializes with default or saved frame and scale', () => {
    const vm = new ViewportManager({
      camera: mockCamera,
      renderer: mockRenderer,
      container: mockContainer
    });

    expect(vm.viewportFrame).toBe('full');
    expect(vm.renderScale).toBe(1.0);
    vm.dispose();
  });

  it('updates container classes and localStorage on applyViewportFrame', () => {
    const vm = new ViewportManager({
      camera: mockCamera,
      renderer: mockRenderer,
      container: mockContainer
    });

    vm.applyViewportFrame('16-9');
    expect(vm.viewportFrame).toBe('16-9');
    expect(mockContainer.classList.add).toHaveBeenCalledWith('frame-16-9');
    vm.dispose();
  });

  it('updates renderer pixel ratio and localStorage on applyRenderScale', () => {
    const vm = new ViewportManager({
      camera: mockCamera,
      renderer: mockRenderer,
      container: mockContainer
    });

    vm.applyRenderScale(0.75);
    expect(vm.renderScale).toBe(0.75);
    expect(mockRenderer.setPixelRatio).toHaveBeenCalled();
    vm.dispose();
  });

  it('cleans up listeners cleanly on dispose', () => {
    const vm = new ViewportManager({
      camera: mockCamera,
      renderer: mockRenderer,
      container: mockContainer
    });

    expect(() => vm.dispose()).not.toThrow();
  });
});

describe('StageTransitionCoordinator', () => {
  let mockScoreSystem;
  let mockObstacleManager;
  let mockSoundFx;
  let mockHud;
  let mockOnApplyStageSwitch;
  let coordinator;

  beforeEach(() => {
    mockScoreSystem = {
      cycle: 0,
      setTransitioning: vi.fn()
    };
    mockObstacleManager = {
      setTransitioning: vi.fn()
    };
    mockSoundFx = {
      setBgmMode: vi.fn()
    };
    mockHud = {
      showTransitionCountdown: vi.fn(),
      updateTransitionCountdown: vi.fn(),
      hideTransitionCountdown: vi.fn()
    };
    mockOnApplyStageSwitch = vi.fn();

    coordinator = new StageTransitionCoordinator({
      scoreSystem: mockScoreSystem,
      obstacleManager: mockObstacleManager,
      soundFx: mockSoundFx,
      hud: mockHud,
      onApplyStageSwitch: mockOnApplyStageSwitch
    });
  });

  it('starts transition and orchestrates subsystems immediately', () => {
    coordinator.startTransition(2);

    expect(coordinator.isTransitioning).toBe(true);
    expect(coordinator.targetStage).toBe(2);
    expect(mockScoreSystem.setTransitioning).toHaveBeenCalledWith(true);
    expect(mockObstacleManager.setTransitioning).toHaveBeenCalledWith(true);
    expect(mockSoundFx.setBgmMode).toHaveBeenCalledWith('transition');
    expect(mockOnApplyStageSwitch).toHaveBeenCalledWith(2);
    expect(mockHud.showTransitionCountdown).toHaveBeenCalled();
  });

  it('counts down and completes transition at timer <= 0', () => {
    coordinator.startTransition(3);

    // Update by 1.0s
    coordinator.update(1.0);
    expect(coordinator.isTransitioning).toBe(true);
    expect(mockHud.updateTransitionCountdown).toHaveBeenCalled();

    // Advance past remaining duration (2.5s)
    coordinator.update(3.0);
    expect(coordinator.isTransitioning).toBe(false);
    expect(mockHud.hideTransitionCountdown).toHaveBeenCalled();
    expect(mockObstacleManager.setTransitioning).toHaveBeenCalledWith(false);
    expect(mockScoreSystem.setTransitioning).toHaveBeenCalledWith(false);
    expect(mockSoundFx.setBgmMode).toHaveBeenCalledWith('game');
  });

  it('cancels transition immediately without completing countdown', () => {
    coordinator.startTransition(4);
    coordinator.cancelTransition();

    expect(coordinator.isTransitioning).toBe(false);
    expect(mockHud.hideTransitionCountdown).toHaveBeenCalled();
    expect(mockObstacleManager.setTransitioning).toHaveBeenCalledWith(false);
    expect(mockScoreSystem.setTransitioning).toHaveBeenCalledWith(false);
  });

  it('holds transition countdown at 0.5s when checkStageReady returns false, then completes when ready', () => {
    let isReady = false;
    const waitingCoordinator = new StageTransitionCoordinator({
      scoreSystem: mockScoreSystem,
      obstacleManager: mockObstacleManager,
      soundFx: mockSoundFx,
      hud: mockHud,
      onApplyStageSwitch: mockOnApplyStageSwitch,
      checkStageReady: () => isReady
    });

    waitingCoordinator.startTransition(2);

    // Advance 4.0s (exceeding nominal 3.5s duration)
    waitingCoordinator.update(4.0);
    // Should hold runway and enter waiting state at timer = 0.5
    expect(waitingCoordinator.isTransitioning).toBe(true);
    expect(waitingCoordinator.isWaitingForDetection).toBe(true);
    expect(waitingCoordinator.timer).toBe(0.5);
    expect(mockObstacleManager.setTransitioning).toHaveBeenCalledWith(true);

    // Now model detects landmarks and confirms readiness
    isReady = true;
    waitingCoordinator.update(0.6);
    expect(waitingCoordinator.isTransitioning).toBe(false);
    expect(mockObstacleManager.setTransitioning).toHaveBeenCalledWith(false);
  });

  it('triggers onCalibrateAtEnd at the final 1.0s of transition countdown', () => {
    const onCalibrate = vi.fn();
    const calibCoordinator = new StageTransitionCoordinator({
      scoreSystem: mockScoreSystem,
      obstacleManager: mockObstacleManager,
      soundFx: mockSoundFx,
      hud: mockHud,
      onApplyStageSwitch: mockOnApplyStageSwitch,
      checkStageReady: () => true,
      onCalibrateAtEnd: onCalibrate
    });

    calibCoordinator.startTransition(2);

    // After 2.0s (timer = 1.5s): onCalibrate should NOT have fired yet
    calibCoordinator.update(2.0);
    expect(onCalibrate).not.toHaveBeenCalled();

    // After another 0.6s (timer = 0.9s <= 1.0s): onCalibrate MUST fire once
    calibCoordinator.update(0.6);
    expect(onCalibrate).toHaveBeenCalledTimes(1);
    expect(onCalibrate).toHaveBeenCalledWith(2);

    // Further updates should NOT re-trigger onCalibrate
    calibCoordinator.update(0.5);
    expect(onCalibrate).toHaveBeenCalledTimes(1);
  });
});

describe('DebugShortcuts', () => {
  let mockEngine;
  let mockHud;
  let mockSoundFx;

  beforeEach(() => {
    mockEngine = {
      state: GameState.PLAYING,
      godMode: false,
      toggleGodMode: vi.fn(),
      toggleStageLock: vi.fn(),
      setDebugStage: vi.fn(),
      startGame: vi.fn(),
      goToMenu: vi.fn()
    };
    mockHud = {
      isAnyModalOpen: vi.fn().mockReturnValue(false),
      closeAllModals: vi.fn(),
      toggleDebugModal: vi.fn(),
      updateSoundState: vi.fn()
    };
    mockSoundFx = {
      toggleMute: vi.fn().mockReturnValue(true)
    };
  });

  it('handles hotkeys: God Mode (G), Stage Lock (L), Mute (M), Debug Modal (F2)', () => {
    const shortcuts = new DebugShortcuts({
      engine: mockEngine,
      hud: mockHud,
      soundFx: mockSoundFx
    });

    shortcuts._handleKeyDown({ code: 'KeyG', key: 'g' });
    expect(mockEngine.toggleGodMode).toHaveBeenCalled();

    shortcuts._handleKeyDown({ code: 'KeyL', key: 'l' });
    expect(mockEngine.toggleStageLock).toHaveBeenCalled();

    shortcuts._handleKeyDown({ code: 'KeyM', key: 'm' });
    expect(mockSoundFx.toggleMute).toHaveBeenCalled();
    expect(mockHud.updateSoundState).toHaveBeenCalledWith(true);

    shortcuts._handleKeyDown({ code: 'F2', key: 'F2', preventDefault: () => {} });
    expect(mockHud.toggleDebugModal).toHaveBeenCalled();

    shortcuts.dispose();
  });

  it('switches stages on 0-5 key press during gameplay', () => {
    const shortcuts = new DebugShortcuts({
      engine: mockEngine,
      hud: mockHud,
      soundFx: mockSoundFx
    });

    shortcuts._handleKeyDown({ key: '3' });
    expect(mockHud.closeAllModals).toHaveBeenCalled();
    expect(mockEngine.setDebugStage).toHaveBeenCalledWith(3, true);

    shortcuts.dispose();
  });

  it('ignores hotkeys when typing in INPUT or TEXTAREA elements', () => {
    const shortcuts = new DebugShortcuts({
      engine: mockEngine,
      hud: mockHud,
      soundFx: mockSoundFx
    });

    shortcuts._handleKeyDown({
      code: 'KeyG',
      key: 'g',
      target: { tagName: 'INPUT' }
    });
    expect(mockEngine.toggleGodMode).not.toHaveBeenCalled();

    shortcuts.dispose();
  });

  it('only triggers camera recalibration on C key when active stage is a Zone Control stage (2 or 3)', () => {
    const mockVisionManager = {
      isReady: true,
      recalibrate: vi.fn()
    };
    const testEngine = {
      scoreSystem: { stage: 0 },
      controlManager: { stage: 0 },
      visionManager: mockVisionManager
    };

    const shortcuts = new DebugShortcuts({
      engine: testEngine,
      hud: mockHud,
      soundFx: mockSoundFx
    });

    // Press C on Stage 0 (Keyboard): must NOT recalibrate zones
    shortcuts._handleKeyDown({ code: 'KeyC', key: 'c' });
    expect(mockVisionManager.recalibrate).not.toHaveBeenCalled();

    // Press C on Stage 4 (FingerGesture): must NOT recalibrate zones
    testEngine.scoreSystem.stage = 4;
    shortcuts._handleKeyDown({ code: 'KeyC', key: 'c' });
    expect(mockVisionManager.recalibrate).not.toHaveBeenCalled();

    // Press C on Stage 5 (HandSwipe): must NOT recalibrate zones
    testEngine.scoreSystem.stage = 5;
    shortcuts._handleKeyDown({ code: 'KeyC', key: 'c' });
    expect(mockVisionManager.recalibrate).not.toHaveBeenCalled();

    // Press C on Stage 2 (FaceZone): MUST recalibrate zones
    testEngine.scoreSystem.stage = 2;
    shortcuts._handleKeyDown({ code: 'KeyC', key: 'c' });
    expect(mockVisionManager.recalibrate).toHaveBeenCalledTimes(1);

    // Press C on Stage 3 (HandZone): MUST recalibrate zones
    testEngine.scoreSystem.stage = 3;
    shortcuts._handleKeyDown({ code: 'KeyC', key: 'c' });
    expect(mockVisionManager.recalibrate).toHaveBeenCalledTimes(2);

    shortcuts.dispose();
  });
});
