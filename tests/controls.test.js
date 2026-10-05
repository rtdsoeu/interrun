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
    expect(scoreSystem.STAGE_THRESHOLDS).toEqual([0, 300, 650, 950, 1250, 1850]);
    expect(scoreSystem.STAGE_CYCLE_LENGTH).toBe(2250);
    expect(scoreSystem.stage).toBe(0);
  });

  it('progresses through stages as distance increases', () => {
    scoreSystem.start(0, false);

    // Distance 0 -> Stage 0 (Keyboard, extended 0-300m)
    expect(scoreSystem.stage).toBe(0);

    // Update distance to 310m -> Stage 1 (Pointer / Mouse, extended 300-650m)
    scoreSystem.distance = 310;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(1);

    // Update distance to 660m -> Stage 2 (Face Zone 3x3, 650-950m)
    scoreSystem.distance = 660;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(2);

    // Update distance to 960m -> Stage 3 (HandZone 3x3, 950-1250m)
    scoreSystem.distance = 960;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(3);

    // Update distance to 1300m -> Stage 4 (FingerGesture, 1250-1850m)
    scoreSystem.distance = 1300;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(4);

    // At 1600m -> still Stage 4 (600m length)
    scoreSystem.distance = 1600;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(4);

    // Update distance to 1900m -> Stage 5 (HandSwipe, 1850-2250m)
    scoreSystem.distance = 1900;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(5);
    expect(scoreSystem.cycle).toBe(0);

    // At 2260m (completing 2250m cycle): loops back to Stage 0 (Keyboard) with higher speed
    scoreSystem.distance = 2260;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(0);
    expect(scoreSystem.cycle).toBe(1);
    // Speed on cycle 1 target is 12.0 + 2.0 = 14.0 (higher than cycle 0's 12.0)
    scoreSystem.update(1.0); // allow speed to interpolate
    expect(scoreSystem.speed).toBeGreaterThan(12.0);
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
    expect(scoreSystem.distance).toBe(scoreSystem.STAGE_THRESHOLDS[2]); // 650m

    // Next frame update should NOT revert to stage 0
    scoreSystem.update(0.016);
    expect(scoreSystem.stage).toBe(2);

    // Starting at Stage 4 with lock
    scoreSystem.start(4, true);
    expect(scoreSystem.stage).toBe(4);
    expect(scoreSystem.distance).toBe(scoreSystem.STAGE_THRESHOLDS[4]); // 1250m
    expect(scoreSystem.lockedStage).toBe(4);
  });

  it('manages tailored per-stage speeds and transition deceleration', () => {
    scoreSystem.start(0, false);
    expect(scoreSystem.STAGE_BASE_SPEEDS).toBeDefined();
    expect(scoreSystem.STAGE_BASE_SPEEDS.length).toBe(6);

    // Initial stage 0 speed
    expect(scoreSystem.speed).toBeCloseTo(12.0, 1);

    // Transition slowdown
    scoreSystem.setTransitioning(true);
    scoreSystem.update(0.5);
    expect(scoreSystem.speed).toBeLessThan(12.0); // decelerating towards 10.5

    scoreSystem.setTransitioning(false);
  });

  it('applies cyclic speed increment when looping back to Stage 0 and avoids Stage 5 endless acceleration', () => {
    scoreSystem.start(0, false);

    // Stage 5 at 2000m (cycle 0)
    scoreSystem.distance = 2000;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(5);
    expect(scoreSystem.cycle).toBe(0);

    // Target speed for stage 5 in cycle 0 is base 12.8
    scoreSystem.update(2.0);
    expect(scoreSystem.speed).toBeCloseTo(12.8, 0.5);

    // Crossing 2250m -> cycle 1, Stage 0 (Keyboard)
    scoreSystem.distance = 2255;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(0);
    expect(scoreSystem.cycle).toBe(1);

    // Target speed for stage 0 in cycle 1 is 12.0 + 2.0 = 14.0 (higher than cycle 0 stage 5!)
    scoreSystem.update(2.0);
    expect(scoreSystem.speed).toBeCloseTo(14.0, 0.5);

    // Advance to Stage 2 (Face Zone) in cycle 1: 2250 + 660 = 2910m
    scoreSystem.distance = 2910;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(2);
    expect(scoreSystem.cycle).toBe(1);
    scoreSystem.update(2.0);
    // Target speed for Stage 2 in cycle 1 is 12.2 + 2.0 = 14.2 (clearly boosted, no dip!)
    expect(scoreSystem.speed).toBeCloseTo(14.2, 0.5);

    // Advance to Stage 3 (HandZone) in cycle 1: 2250 + 960 = 3210m
    scoreSystem.distance = 3210;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(3);
    expect(scoreSystem.cycle).toBe(1);
    scoreSystem.update(2.0);
    // Target speed for Stage 3 in cycle 1 is 12.4 + 2.0 = 14.4 (clearly boosted!)
    expect(scoreSystem.speed).toBeCloseTo(14.4, 0.5);

    // Advance to Stage 4 (FingerGesture) in cycle 1: 2250 + 1300 = 3550m
    scoreSystem.distance = 3550;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(4);
    expect(scoreSystem.cycle).toBe(1);
    scoreSystem.update(2.0);
    expect(scoreSystem.speed).toBeCloseTo(14.4, 0.5);

    // Crossing 4500m -> cycle 2, Stage 0 (Keyboard)
    scoreSystem.distance = 4505;
    scoreSystem.update(0.1);
    expect(scoreSystem.stage).toBe(0);
    expect(scoreSystem.cycle).toBe(2);

    // Target speed for stage 0 in cycle 2 is 12.0 + 4.0 = 16.0
    scoreSystem.update(2.0);
    expect(scoreSystem.speed).toBeCloseTo(16.0, 0.5);
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

describe('HandSwipeControl (Air Swipes + Seamless Fallback)', () => {
  it('processes air swipes from vision state and supports keyboard/touch fallback', () => {
    const mockVision = {
      isReady: true,
      setMode: () => {},
      initWebcam: () => {},
      currentState: {
        hsSource: 'hand',
        hsSwipe: 'left',
        hsSwipeId: 1
      }
    };

    const hsc = new HandSwipeControl(mockVision);
    hsc.enable();

    // Air swipe left
    hsc.update(0.016);
    let action = hsc.consume();
    expect(action.laneDelta).toBe(-1);

    // Duplicate event with same ID is ignored
    hsc.update(0.016);
    expect(hsc.consume().laneDelta).toBe(0);

    // Air swipe up (jump)
    mockVision.currentState.hsSwipe = 'up';
    mockVision.currentState.hsSwipeId = 2;
    hsc.update(0.016);
    action = hsc.consume();
    expect(action.jump).toBe(true);

    // Keyboard fallback: ArrowRight
    hsc._keyDown({ code: 'ArrowRight', preventDefault: () => {} });
    action = hsc.consume();
    expect(action.laneDelta).toBe(1);

    // Keyboard fallback: Space (jump)
    hsc._keyDown({ code: 'Space', preventDefault: () => {} });
    action = hsc.consume();
    expect(action.jump).toBe(true);

    hsc.disable();
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

describe('SoundFx SFX Engine', () => {
  it('initializes safely and manages volume, mute, and SFX without errors', async () => {
    const { SoundFx } = await import('../src/audio/SoundFx.js');

    const sfx = new SoundFx();
    expect(sfx.muted).toBe(false);
    expect(sfx.sfxVolume).toBeGreaterThan(0);

    // Mute toggle
    sfx.toggleMute();
    expect(sfx.muted).toBe(true);
    sfx.setMuted(false);
    expect(sfx.muted).toBe(false);

    // Volume adjustments
    sfx.setSfxVolume(0.5);
    expect(sfx.sfxVolume).toBe(0.5);

    // SFX methods execute cleanly without throwing even in headless environment
    expect(() => {
      sfx.playJump();
      sfx.playSlide();
      sfx.playLaneSwitch();
      sfx.playCoin();
      sfx.playCrash();
      sfx.playStageUp();
    }).not.toThrow();
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

describe('HandSwipeControl Fallback Backup Inputs', () => {
  it('supports emergency keyboard backup (WASD / Arrows / Space) when enabled', () => {
    const mockVision = { isReady: true, currentState: {}, setMode: () => {}, initWebcam: () => {} };
    const swipeControl = new HandSwipeControl(mockVision);
    swipeControl.enable();

    // Keydown ArrowLeft
    swipeControl._keyDown({ code: 'ArrowLeft', preventDefault: () => {} });
    swipeControl.update(0.016);
    let cmd = swipeControl.consume();
    expect(cmd.laneDelta).toBe(-1);

    // Keyup ArrowLeft
    swipeControl._keyUp({ code: 'ArrowLeft' });

    // Keydown Space (Jump)
    swipeControl._keyDown({ code: 'Space', preventDefault: () => {} });
    swipeControl.update(0.016);
    cmd = swipeControl.consume();
    expect(cmd.jump).toBe(true);
    swipeControl._keyUp({ code: 'Space' });

    // Keydown KeyS (Slide)
    swipeControl._keyDown({ code: 'KeyS', preventDefault: () => {} });
    swipeControl.update(0.016);
    cmd = swipeControl.consume();
    expect(cmd.slide).toBe(true);
    swipeControl._keyUp({ code: 'KeyS' });

    swipeControl.disable();
  });

  it('supports touch swipe fallback gestures', () => {
    const mockVision = { isReady: true, currentState: {}, setMode: () => {}, initWebcam: () => {} };
    const swipeControl = new HandSwipeControl(mockVision);
    swipeControl.enable();

    // Touch swipe right (dx = 50px)
    swipeControl._onTouchStart({ touches: [{ clientX: 100, clientY: 100 }], target: {} });
    swipeControl._onTouchMove({ touches: [{ clientX: 160, clientY: 102 }] });
    swipeControl._onTouchEnd();

    swipeControl.update(0.016);
    const cmd = swipeControl.consume();
    expect(cmd.laneDelta).toBe(1);

    swipeControl.disable();
  });
});

describe('VisionManager Low FPS Auto-Calibration', () => {
  it('correctly sets eco resolution and lowered target FPS when camera is <= 15 FPS', async () => {
    const { VisionManager } = await import('../src/vision/VisionManager.js');
    const vm = new VisionManager();

    // Simulate mock video with requestVideoFrameCallback returning 10 FPS (100ms per frame)
    let t = 1000;
    vm.video = {
      requestVideoFrameCallback: (cb) => {
        t += 100;
        cb(t);
      }
    };

    await vm._benchmarkCameraFps();
    expect(vm.realCamFps).toBeLessThanOrEqual(15);
    expect(vm.settings.targetFps).toBeLessThanOrEqual(15);
    expect(vm.settings.resolution).toBe('eco');
  });
});

describe('HUD Stage Loop Display on Cycle 2+ Transitions', () => {
  it('correctly includes loop counter for Stage 0 (Keyboard) when looping to cycle 1+', async () => {
    const { HUD } = await import('../src/ui/HUD.js');
    const root = { innerHTML: '' };
    const elements = {};
    const mockDoc = {
      getElementById: (id) => elements[id] || (elements[id] = {
        textContent: '',
        innerHTML: '',
        style: {},
        classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
        addEventListener: () => {}
      }),
      querySelectorAll: () => []
    };
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;
    try {
      const hud = new HUD(root, null, null, null);
      // Announce stage 0 on cycle 1 (Kolo 2 / Loop 2)
      hud.announceStage(0, false, 1);
      expect(hud.elStageBadge.textContent).toMatch(/(Loop|Коло|Круг)\s*2/);
      expect(hud.elStageTitle.textContent).toMatch(/(Loop|Коло|Круг)\s*2/);

      // Transition countdown banner for stage 0 on cycle 1
      hud.showTransitionCountdown(0, 3.5, 3.5, 1);
      const nextBadge = mockDoc.getElementById('transition-next-badge');
      expect(nextBadge.textContent).toMatch(/(Loop|Коло|Круг)\s*2/);
    } finally {
      globalThis.document = origDoc;
    }
  });
});

describe('WakeLockManager Screen Sleep Prevention', () => {
  it('correctly requests, tracks, and releases screen wake lock', async () => {
    const { WakeLockManager } = await import('../src/game/WakeLockManager.js');

    let released = false;
    let releaseListeners = [];
    const mockSentinel = {
      released: false,
      release: async () => {
        mockSentinel.released = true;
        released = true;
        releaseListeners.forEach(fn => fn());
      },
      addEventListener: (type, fn) => {
        if (type === 'release') releaseListeners.push(fn);
      }
    };

    let requestedType = null;
    const origWakeLock = Object.getOwnPropertyDescriptor(navigator, 'wakeLock');
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: async (type) => {
          requestedType = type;
          mockSentinel.released = false;
          released = false;
          return mockSentinel;
        }
      },
      configurable: true,
      writable: true
    });

    try {
      const manager = new WakeLockManager();
      expect(manager.isSupported).toBe(true);
      expect(manager.isHoldingLock).toBe(false);

      // Request lock
      await manager.request();
      expect(requestedType).toBe('screen');
      expect(manager.isHoldingLock).toBe(true);

      // Release lock
      await manager.release();
      expect(released).toBe(true);
      expect(manager.isHoldingLock).toBe(false);

      // Gracefully handles request error
      navigator.wakeLock.request = async () => { throw new Error('Low battery'); };
      await manager.request();
      expect(manager.isHoldingLock).toBe(false);

      manager.destroy();
    } finally {
      if (origWakeLock) {
        Object.defineProperty(navigator, 'wakeLock', origWakeLock);
      } else {
        delete navigator.wakeLock;
      }
    }
  });
});

describe('Camera Error & Fallback System', () => {
  it('dispatches onCameraError and records error state when getUserMedia fails', async () => {
    const { VisionManager } = await import('../src/vision/VisionManager.js');
    const vm = new VisionManager();

    let capturedError = null;
    vm.onCameraError = (err) => {
      capturedError = err;
    };

    // Simulate permission denied
    const origMediaDevices = navigator.mediaDevices;
    try {
      navigator.mediaDevices = {
        getUserMedia: async () => {
          const err = new Error('Permission denied by user');
          err.name = 'NotAllowedError';
          throw err;
        }
      };

      const result = await vm.initWebcam();
      expect(result).toBe(false);
      expect(vm.hasPermission).toBe(false);
      expect(vm.hasCameraError).toBe(true);
      expect(vm.lastError?.type).toBe('permission_denied');
      expect(capturedError?.type).toBe('permission_denied');
    } finally {
      navigator.mediaDevices = origMediaDevices;
    }
  });

  it('correctly opens and closes camera error modal in HUD', async () => {
    const { HUD } = await import('../src/ui/HUD.js');
    const root = { innerHTML: '' };
    const elements = {};
    const mockDoc = {
      getElementById: (id) => elements[id] || (elements[id] = {
        textContent: '',
        innerHTML: '',
        style: {},
        classList: {
          _set: new Set(['hidden']),
          add(c) { this._set.add(c); },
          remove(c) { this._set.delete(c); },
          contains(c) { return this._set.has(c); },
          toggle(c, force) {
            if (force !== undefined) {
              if (force) this._set.add(c);
              else this._set.delete(c);
            } else {
              if (this._set.has(c)) this._set.delete(c);
              else this._set.add(c);
            }
          }
        },
        addEventListener: () => {}
      }),
      querySelectorAll: () => []
    };
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;
    try {
      const hud = new HUD(root, null, null, null);
      expect(hud.isAnyModalOpen()).toBe(false);

      // Show camera error modal
      hud.showCameraErrorModal({ type: 'permission_denied' });
      expect(hud.isAnyModalOpen()).toBe(true);
      expect(hud.elCamErrorModal.classList.contains('hidden')).toBe(false);
      expect(hud.elCamErrorBody.innerHTML).toBeTruthy();

      // Close modal
      hud.closeCameraErrorModal();
      expect(hud.elCamErrorModal.classList.contains('hidden')).toBe(true);
      expect(hud.isAnyModalOpen()).toBe(false);
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('triggers seamless fallback to Stage 1 PointerControl on CV stage transition if camera has error', async () => {
    const { Engine } = await import('../src/game/Engine.js');
    let capturedStage = null;
    let cameraModalShown = false;
    let statusSet = null;

    // Lightweight mock engine context for _applyStageSwitch
    const engineCtx = {
      scoreSystem: { lockedStage: null, cycle: 0 },
      visionManager: {
        hasCameraError: true,
        lastError: { type: 'permission_denied' },
        isReady: false
      },
      hud: {
        showCvFps: () => {},
        showWebcamPip: () => {},
        setWebcamStatus: (status) => { statusSet = status; },
        announceStage: () => {},
        showCameraErrorModal: () => { cameraModalShown = true; }
      },
      controlManager: {
        setStage: (stage) => { capturedStage = stage; }
      }
    };

    // Call Engine prototype method directly with our context
    Engine.prototype._applyStageSwitch.call(engineCtx, 2);

    expect(capturedStage).toBe(1); // PointerControl fallback
    expect(cameraModalShown).toBe(true);
    expect(statusSet).toContain('OFFLINE');
  });

  it('toggles low-light badge in HUD metrics panel when camera FPS is below 18', async () => {
    const { HUD } = await import('../src/ui/HUD.js');
    const elements = {};
    const mockDoc = {
      getElementById: (id) => elements[id] || (elements[id] = {
        textContent: '',
        innerHTML: '',
        style: {},
        classList: {
          _set: new Set(['hidden']),
          add(c) { this._set.add(c); },
          remove(c) { this._set.delete(c); },
          contains(c) { return this._set.has(c); }
        },
        addEventListener: () => {}
      }),
      querySelectorAll: () => []
    };
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;
    try {
      const hud = new HUD({ innerHTML: '' }, null, null, null);

      // Normal lighting: 30 FPS -> badge hidden
      hud.updateCvFPS(30, 20, 30);
      expect(hud.elLowLightBadge.classList.contains('hidden')).toBe(true);

      // Low light: 14 FPS -> badge visible
      hud.updateCvFPS(15, 45, 14);
      expect(hud.elLowLightBadge.classList.contains('hidden')).toBe(false);

      // Recovers: 30 FPS -> badge hidden again
      hud.updateCvFPS(30, 20, 30);
      expect(hud.elLowLightBadge.classList.contains('hidden')).toBe(true);
    } finally {
      globalThis.document = origDoc;
    }
  });
});




