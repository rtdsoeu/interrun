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
});
