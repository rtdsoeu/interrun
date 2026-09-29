import { describe, it, expect, beforeEach } from 'vitest';

// Node test environment stub
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

import { ScoreSystem } from '../src/game/ScoreSystem.js';
import { ControlManager } from '../src/controls/ControlManager.js';
import { HandSwipeControl } from '../src/controls/HandSwipeControl.js';
import { FingerGestureControl } from '../src/controls/FingerGestureControl.js';
import { ZoneControl } from '../src/controls/ZoneControl.js';
import { HandZoneControl } from '../src/controls/HandZoneControl.js';
import { KeyboardControl } from '../src/controls/KeyboardControl.js';
import { PointerControl } from '../src/controls/PointerControl.js';

describe('ScoreSystem (6 Stages: 0 to 5)', () => {
  let scoreSystem;

  beforeEach(() => {
    scoreSystem = new ScoreSystem();
  });

  it('initializes with correct constants and thresholds', () => {
    expect(scoreSystem.MAX_STAGE).toBe(5);
    expect(scoreSystem.STAGE_THRESHOLDS).toEqual([0, 100, 250, 500, 750, 1050]);
    expect(scoreSystem.stage).toBe(0);
  });

  it('progresses through stages as distance increases', () => {
    scoreSystem.start(0, false);

    // Distance 0 -> Stage 0
    expect(scoreSystem.stage).toBe(0);

    // Update distance to 105m -> Stage 1
    scoreSystem.distance = 105;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(1);

    // Update distance to 260m -> Stage 2
    scoreSystem.distance = 260;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(2);

    // Update distance to 510m -> Stage 3
    scoreSystem.distance = 510;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(3);

    // Update distance to 760m -> Stage 4
    scoreSystem.distance = 760;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(4);

    // Update distance to 1100m -> Stage 5 (MAX_STAGE)
    scoreSystem.distance = 1100;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(5);

    // Beyond MAX_STAGE remains 5
    scoreSystem.distance = 5000;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(5);
  });

  it('respects lockedStage in debug mode', () => {
    scoreSystem.start(0, false);
    scoreSystem.setLockedStage(2);
    expect(scoreSystem.stage).toBe(2);
    expect(scoreSystem.lockedStage).toBe(2);

    scoreSystem.distance = 1200;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(2); // remains 2 because locked
  });

  it('initializes distance to stage threshold when starting at non-zero stage', () => {
    // Starting at Stage 2 without lock
    scoreSystem.start(2, false);
    expect(scoreSystem.stage).toBe(2);
    expect(scoreSystem.distance).toBe(scoreSystem.STAGE_THRESHOLDS[2]); // 250m

    // Next frame update should NOT revert to stage 0
    scoreSystem.update(0.016);
    expect(scoreSystem.stage).toBe(2);

    // Starting at Stage 4 with lock
    scoreSystem.start(4, true);
    expect(scoreSystem.stage).toBe(4);
    expect(scoreSystem.distance).toBe(scoreSystem.STAGE_THRESHOLDS[4]); // 750m
    expect(scoreSystem.lockedStage).toBe(4);
  });

  it('manages tailored per-stage speeds and transition deceleration', () => {
    scoreSystem.start(0, false);
    expect(scoreSystem.STAGE_BASE_SPEEDS).toBeDefined();
    expect(scoreSystem.STAGE_BASE_SPEEDS.length).toBe(6);

    // Initial stage 0 speed
    expect(scoreSystem.speed).toBeCloseTo(11.0, 1);

    // Transition slowdown
    scoreSystem.setTransitioning(true);
    scoreSystem.update(0.5);
    expect(scoreSystem.speed).toBeLessThan(11.0); // decelerating towards 9.0

    scoreSystem.setTransitioning(false);
  });
});

describe('HandSwipeControl Single-Event Consumption', () => {
  it('fires action strictly once per swipe ID across multiple frames', () => {
    const mockVision = {
      isReady: true,
      currentState: {
        hsSwipe: 'left',
        hsSwipeId: 1,
        hsSource: 'hand'
      },
      setMode: () => {},
      initWebcam: () => {}
    };

    const swipeControl = new HandSwipeControl(mockVision);
    swipeControl.enable();

    // Frame 1 (16ms)
    swipeControl.update(0.016);
    let commands = swipeControl.consume();
    expect(commands.laneDelta).toBe(-1);

    // Frame 2 (next frame, same swipe ID still in currentState)
    swipeControl.update(0.016);
    commands = swipeControl.consume();
    expect(commands.laneDelta).toBe(0); // must NOT fire again!

    // Frame 3
    swipeControl.update(0.016);
    commands = swipeControl.consume();
    expect(commands.laneDelta).toBe(0);

    // New swipe arrives with new ID
    mockVision.currentState.hsSwipe = 'right';
    mockVision.currentState.hsSwipeId = 2;

    swipeControl.update(0.016);
    commands = swipeControl.consume();
    expect(commands.laneDelta).toBe(1);

    // Subsequent frame with ID 2
    swipeControl.update(0.016);
    commands = swipeControl.consume();
    expect(commands.laneDelta).toBe(0);
  });

  it('correctly maps all 4 directional air swipes', () => {
    const mockVision = {
      isReady: true,
      currentState: {
        hsSwipe: null,
        hsSwipeId: 0,
        hsSource: 'hand'
      },
      setMode: () => {},
      initWebcam: () => {}
    };

    const swipeControl = new HandSwipeControl(mockVision);
    swipeControl.enable();

    // Up -> Jump
    mockVision.currentState = { hsSwipe: 'up', hsSwipeId: 10, hsSource: 'hand' };
    swipeControl.update(0.016);
    expect(swipeControl.consume().jump).toBe(true);

    // Down -> Slide
    mockVision.currentState = { hsSwipe: 'down', hsSwipeId: 11, hsSource: 'hand' };
    swipeControl.update(0.016);
    expect(swipeControl.consume().slide).toBe(true);

    // Left -> laneDelta -1
    mockVision.currentState = { hsSwipe: 'left', hsSwipeId: 12, hsSource: 'hand' };
    swipeControl.update(0.016);
    expect(swipeControl.consume().laneDelta).toBe(-1);

    // Right -> laneDelta +1
    mockVision.currentState = { hsSwipe: 'right', hsSwipeId: 13, hsSource: 'hand' };
    swipeControl.update(0.016);
    expect(swipeControl.consume().laneDelta).toBe(1);
  });
});

describe('ControlManager 6-Stage Registry', () => {
  it('registers stages 0 through 5 without gaps or crashes', () => {
    const cm = new ControlManager();
    const mockVision = {
      isReady: true,
      currentState: {},
      setMode: () => {},
      initWebcam: () => {}
    };

    cm.register(0, new KeyboardControl());
    cm.register(1, new PointerControl());
    cm.register(2, new ZoneControl(mockVision));
    cm.register(3, new HandZoneControl(mockVision));
    cm.register(4, new FingerGestureControl(mockVision));
    cm.register(5, new HandSwipeControl(mockVision));

    for (let s = 0; s <= 5; s++) {
      expect(() => cm.setStage(s)).not.toThrow();
      expect(cm.stage).toBe(s);
    }
  });
});

describe('ZoneControl & HandZoneControl (Stages 2 & 3: 3×3 Grid)', () => {
  it('correctly maps 3x3 zones to absolute targetLane, jump, and duck', () => {
    const mockVision = {
      isReady: true,
      currentState: {
        zoneCol: 'L',
        zoneRow: 'mid',
        zoneSource: 'face'
      },
      setMode: () => {},
      initWebcam: () => {}
    };

    const zc = new ZoneControl(mockVision);
    zc.enable();

    // L -> Left lane
    zc.update(0.016);
    expect(zc.consume().targetLane).toBe(-1);

    // C + top -> Center lane + Jump
    mockVision.currentState.zoneCol = 'C';
    mockVision.currentState.zoneRow = 'top';
    zc.update(0.016);
    const topRes = zc.consume();
    expect(topRes.targetLane).toBe(0);
    expect(topRes.jump).toBe(true);

    // R + bot -> Right lane + Ducking
    mockVision.currentState.zoneCol = 'R';
    mockVision.currentState.zoneRow = 'bot';
    zc.update(0.016);
    const botRes = zc.consume();
    expect(botRes.targetLane).toBe(1);
    expect(botRes.isDucking).toBe(true);

    // Face leaves frame -> isDucking must immediately reset to false
    mockVision.currentState.zoneSource = null;
    zc.update(0.016);
    const lostRes = zc.consume();
    expect(lostRes.isDucking).toBe(false);
    expect(lostRes.targetLane).toBe(1); // maintains lane
  });

  it('HandZoneControl maps hand positions correctly and resets ducking on hand lost', () => {
    const mockVision = {
      isReady: true,
      currentState: {
        hzCol: 'R',
        hzRow: 'top',
        hzSource: 'hands'
      },
      setMode: () => {},
      initWebcam: () => {}
    };

    const hzc = new HandZoneControl(mockVision);
    hzc.enable();
    hzc.update(0.016);
    const res = hzc.consume();
    expect(res.targetLane).toBe(1);
    expect(res.jump).toBe(true);

    // Hand in bot zone -> Ducking
    mockVision.currentState.hzRow = 'bot';
    hzc.update(0.016);
    expect(hzc.consume().isDucking).toBe(true);

    // Hand leaves frame -> isDucking must immediately reset to false
    mockVision.currentState.hzSource = null;
    hzc.update(0.016);
    expect(hzc.consume().isDucking).toBe(false);
  });
});

describe('FingerGestureControl (Stage 4: Kinematic Gestures)', () => {
  it('maps 1/2/3 fingers to lanes and palm/fist to jump/slide', () => {
    const mockVision = {
      isReady: true,
      currentState: {
        fgGesture: 'jump',
        fgSource: 'hand'
      },
      setMode: () => {},
      initWebcam: () => {}
    };

    const fgc = new FingerGestureControl(mockVision);
    fgc.enable();

    // Open Palm -> Jump
    fgc.update(0.016);
    expect(fgc.consume().jump).toBe(true);

    // Closed Fist -> Duck / Slide
    mockVision.currentState.fgGesture = 'duck';
    fgc.update(0.016);
    expect(fgc.consume().slide).toBe(true);

    // Lost tracking -> must immediately reset isDucking to false (no stuck duck!)
    mockVision.currentState.fgSource = null;
    fgc.update(0.016);
    expect(fgc.consume().isDucking).toBe(false);

    // Hand re-enters with open palm (Jump) -> jump executes cleanly without ducking
    mockVision.currentState.fgSource = 'hand';
    mockVision.currentState.fgGesture = 'jump';
    fgc.update(0.016);
    const jumpRes = fgc.consume();
    expect(jumpRes.jump).toBe(true);
    expect(jumpRes.isDucking).toBe(false);

    // Finger lane change with stability buffer (~0.08s)
    mockVision.currentState.fgGesture = 'lane_left';
    fgc.update(0.016); // frame 1: detected, timer initialized to 0
    expect(fgc.consume().targetLane).toBe(0); // remains 0
    fgc.update(0.04);  // frame 2: 0.04s < 0.08s
    expect(fgc.consume().targetLane).toBe(0); // remains 0
    fgc.update(0.05);  // frame 3: 0.04 + 0.05 = 0.09s >= 0.08s
    expect(fgc.consume().targetLane).toBe(-1); // lane left confirmed and applied!

    // Switch to 3 fingers (lane_right)
    mockVision.currentState.fgGesture = 'lane_right';
    fgc.update(0.016);
    expect(fgc.consume().targetLane).toBe(-1); // still left until buffer expires
    fgc.update(0.09);
    expect(fgc.consume().targetLane).toBe(1); // lane right confirmed!

    // Switch to 2 fingers (lane_center)
    mockVision.currentState.fgGesture = 'lane_center';
    fgc.update(0.016);
    expect(fgc.consume().targetLane).toBe(1);
    fgc.update(0.09);
    expect(fgc.consume().targetLane).toBe(0); // lane center confirmed!
  });
});

describe('VisionManager Performance Settings', () => {
  it('exposes correct resolution presets (eco 160x120, balanced 256x192, high 320x240)', async () => {
    const { CV_RESOLUTION_PRESETS, VisionManager } = await import('../src/vision/VisionManager.js');

    expect(CV_RESOLUTION_PRESETS.eco).toEqual({ width: 160, height: 120 });
    expect(CV_RESOLUTION_PRESETS.balanced).toEqual({ width: 256, height: 192 });
    expect(CV_RESOLUTION_PRESETS.high).toEqual({ width: 320, height: 240 });

    const vm = new VisionManager();
    expect(vm.settings.resolution).toBeDefined();
    expect(vm.settings.targetFps).toBeDefined();
    expect(vm.settings.pipMode).toBeDefined();

    // Test applySettings
    vm.applySettings({ resolution: 'eco', targetFps: 20, pipMode: 'minimal' });
    expect(vm.settings.resolution).toBe('eco');
    expect(vm.settings.targetFps).toBe(20);
    expect(vm.settings.pipMode).toBe('minimal');
  });
});

describe('SoundFx & Synthwave BGM Engine', () => {
  it('initializes safely and manages volumes, mute, and BGM modes without errors', async () => {
    const { SoundFx } = await import('../src/audio/SoundFx.js');

    const sfx = new SoundFx();
    expect(sfx.muted).toBe(false);
    expect(sfx.sfxVolume).toBeGreaterThan(0);
    expect(sfx.bgmVolume).toBeGreaterThan(0);

    // Mute toggle
    sfx.toggleMute();
    expect(sfx.muted).toBe(true);
    sfx.setMuted(false);
    expect(sfx.muted).toBe(false);

    // Volume adjustments
    sfx.setSfxVolume(0.5);
    expect(sfx.sfxVolume).toBe(0.5);
    sfx.setBgmVolume(0.7);
    expect(sfx.bgmVolume).toBe(0.7);

    // BGM modes
    sfx.startBGM('menu');
    sfx.setBgmMode('game');
    sfx.setBgmMode('transition');
    sfx.setBgmMode('dead');
    sfx.stopBGM();

    // SFX methods execute cleanly without throwing even in headless environment
    expect(() => {
      sfx.playJump();
      sfx.playSlide();
      sfx.playLaneSwitch();
      sfx.playCoin();
      sfx.playCrash();
      sfx.playStageUp();
    }).not.toThrow();

    // Dedicated MusicPlayer tests
    const { MusicPlayer, RADIO_STATIONS } = await import('../src/audio/MusicPlayer.js');
    expect(RADIO_STATIONS.length).toBeGreaterThanOrEqual(4);

    const player = new MusicPlayer();
    expect(player.stationId).toBeDefined();
    player.setStation('chillsynth');
    expect(player.stationId).toBe('chillsynth');
    player.setStation('synth'); // Procedural 80s synth mode
    expect(player.stationId).toBe('synth');
    player.setMode('game');
    expect(player.mode).toBe('game');
    player.setMode('dead');
    expect(player.mode).toBe('dead');
  });
});

describe('ScoreSystem Speed Multipliers & Debug Launch', () => {
  it('correctly applies speed multiplier on start and updates speed live', async () => {
    const { ScoreSystem, STAGE_BASE_SPEEDS } = await import('../src/game/ScoreSystem.js');

    const score = new ScoreSystem();
    expect(score.speedMultiplier).toBe(1.0);

    // Start Stage 2 with 0.5x speed
    score.start(2, true, 0.5);
    expect(score.stage).toBe(2);
    expect(score.speedMultiplier).toBe(0.5);
    expect(score.speed).toBeCloseTo(STAGE_BASE_SPEEDS[2] * 0.5, 2);

    // Change speed live to 1.75x
    score.setSpeedMultiplier(1.75);
    expect(score.speedMultiplier).toBe(1.75);
    expect(score.speed).toBeCloseTo(STAGE_BASE_SPEEDS[2] * 1.75, 2);

    // Clamping checks
    score.setSpeedMultiplier(0.01);
    expect(score.speedMultiplier).toBe(0.2); // clamped min
    score.setSpeedMultiplier(10.0);
    expect(score.speedMultiplier).toBe(3.0); // clamped max

    // Test update loop scaling distance
    score.start(0, false, 1.5);
    const startDist = score.distance;
    score.update(1.0); // 1 second
    const distGained = score.distance - startDist;
    expect(distGained).toBeCloseTo(STAGE_BASE_SPEEDS[0] * 1.5, 1);
  });
});

