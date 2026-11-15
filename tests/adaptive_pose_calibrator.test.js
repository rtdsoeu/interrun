import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptivePoseCalibrator, CalibrationState } from '../src/vision/AdaptivePoseCalibrator.js';

describe('AdaptivePoseCalibrator (Camera Tilt & Spatial Rest-Pose Adaptation)', () => {
  let calibrator;

  beforeEach(() => {
    calibrator = new AdaptivePoseCalibrator({
      defaultCenterX: 0.50,
      defaultCenterY: 0.52,
      leftBoundary: 0.40,
      rightBoundary: 0.60,
      jumpDelta: 0.09,
      slideDelta: 0.14
    });
  });

  it('initializes in WARMUP state with canonical default baseline', () => {
    expect(calibrator.state).toBe(CalibrationState.WARMUP);
    expect(calibrator.centerX).toBe(0.50);
    expect(calibrator.centerY).toBe(0.52);
    expect(calibrator.repositionEvents).toBe(0);
    expect(calibrator.lastWarning).toBeNull();
  });

  it('completes warmup and locks onto user resting posture Y while keeping center X fixed', () => {
    // User is sitting at y=0.58
    for (let f = 1; f <= 15; f++) {
      calibrator.update(0.55, 0.58, f * 33);
    }

    expect(calibrator.state).toBe(CalibrationState.TRACKING);
    // Center X must remain canonical 0.50 so lane steering never drifts
    expect(calibrator.centerX).toBe(0.50);
    expect(calibrator.centerY).toBeCloseTo(0.58, 1);
  });

  it('ensures running in left lane does NOT shift center X to the left or trigger right lane on return', () => {
    // 1. Warmup center
    for (let f = 1; f <= 15; f++) {
      calibrator.update(0.50, 0.52, f * 33);
    }
    // 2. User steers to Left lane (x = 0.30) and runs there for 3 seconds
    let t = 15 * 33;
    for (let i = 0; i < 90; i++) {
      const res = calibrator.update(0.30, 0.52, t += 33);
      expect(res.col).toBe('L');
    }
    // Center X must remain 0.50, NOT drift to 0.30!
    expect(calibrator.centerX).toBe(0.50);

    // 3. User returns head to center (0.48) -> MUST be 'C', never 'R'!
    const returnRes = calibrator.update(0.48, 0.52, t += 33);
    expect(returnRes.col).toBe('C');
  });

  it('triggers JUMP with a comfortable head nod without needing to reach top of frame', () => {
    // Warmup at neutral y = 0.52
    for (let f = 1; f <= 15; f++) {
      calibrator.update(0.50, 0.52, f * 33);
    }
    // Jump threshold is centerY - 0.09 = 0.43. A gentle nod up to 0.40 triggers JUMP comfortably.
    const jumpRes = calibrator.update(0.50, 0.40, 16 * 33);
    expect(jumpRes.row).toBe('top');
  });

  it('protects against frame drop-out when camera is tilted down (low footroom)', () => {
    // User face sits low in frame (y=0.64), barely leaving footroom at bottom
    for (let f = 1; f <= 20; f++) {
      calibrator.update(0.50, 0.64, f * 33);
    }

    const state = calibrator.update(0.50, 0.64, 21 * 33);

    // The downward delta must be compressed so user can duck without leaving frame
    expect(state.isAsymmetric).toBe(true);
    expect(state.yBot).toBeLessThan(0.78); // Much safer than static 0.72 + 0.16 = 0.88
    expect(state.yBot - state.centerY).toBeLessThan(calibrator.slideDelta);

    // A gentle nod down to 0.74 should safely register as 'bot' (duck/slide)
    const duckRes = calibrator.update(0.50, 0.75, 22 * 33);
    expect(duckRes.row).toBe('bot');
  });

  it('emits camera tilt warning when face is dangerously close to vertical borders', () => {
    // Very low sitting (y=0.72)
    for (let f = 1; f <= 20; f++) {
      calibrator.update(0.50, 0.72, f * 33);
    }
    const resLow = calibrator.update(0.50, 0.72, 21 * 33);
    expect(resLow.warning).toBe('tilt_down');

    // Reset and test high sitting / camera pointed down (y=0.25)
    calibrator.reset();
    for (let f = 1; f <= 20; f++) {
      calibrator.update(0.50, 0.25, f * 33);
    }
    const resHigh = calibrator.update(0.50, 0.25, 21 * 33);
    expect(resHigh.warning).toBe('tilt_up');
  });

  it('maintains a locked rock-solid baseline during gameplay and cleanly recalibrates when requested', () => {
    // 1. Establish initial baseline at level start (y=0.45)
    for (let f = 1; f <= 15; f++) {
      calibrator.update(0.50, 0.45, f * 33);
    }
    expect(calibrator.state).toBe(CalibrationState.TRACKING);
    expect(calibrator.isCalibrated).toBe(true);
    expect(calibrator.centerY).toBeCloseTo(0.45, 1);
    const lockedYTop = calibrator.fixedYTop;
    const lockedYBot = calibrator.fixedYBot;

    // 2. User ducks or leans low (y = 0.65) during gameplay for a long period
    let t = 15 * 33;
    for (let i = 0; i < 40; i++) {
      calibrator.update(0.50, 0.65, t += 33);
    }

    // Mid-game baseline and thresholds must remain FROZEN — no drift during level!
    expect(calibrator.centerY).toBeCloseTo(0.45, 1);
    expect(calibrator.fixedYTop).toBe(lockedYTop);
    expect(calibrator.fixedYBot).toBe(lockedYBot);

    // 3. User starts a new level or triggers recalibration at a new camera angle (y = 0.62)
    calibrator.recalibrate();
    expect(calibrator.isCalibrated).toBe(false);
    expect(calibrator.state).toBe(CalibrationState.WARMUP);

    for (let f = 1; f <= 15; f++) {
      calibrator.update(0.50, 0.62, t += 33);
    }

    // Baseline should now match the new camera angle calibrated at the start of the level!
    expect(calibrator.isCalibrated).toBe(true);
    expect(calibrator.centerY).toBeCloseTo(0.62, 1);
  });

  it('supports mid-game auto-recentering after 3.0s sustained posture shift', () => {
    const dynamicCalibrator = new AdaptivePoseCalibrator({
      defaultCenterX: 0.50,
      defaultCenterY: 0.52,
      autoRecenterMidGame: true,
      recenterHoldMs: 3000
    });

    // 1. Initial warmup
    for (let f = 1; f <= 15; f++) {
      dynamicCalibrator.update(0.50, 0.45, f * 33);
    }
    expect(dynamicCalibrator.centerY).toBeCloseTo(0.45, 1);

    // 2. Player changes posture to y=0.64 and holds still for ~2.0s (less than 3.0s -> no recenter yet)
    let t = 15 * 33;
    for (let i = 0; i < 60; i++) {
      dynamicCalibrator.update(0.50, 0.64, t += 33);
    }
    expect(dynamicCalibrator.repositionEvents).toBe(0);

    // 3. Continues holding still past 3.0s (100 frames total * 33ms = 3300ms)
    for (let i = 0; i < 40; i++) {
      dynamicCalibrator.update(0.50, 0.64, t += 33);
    }
    expect(dynamicCalibrator.repositionEvents).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < 15; i++) {
      dynamicCalibrator.update(0.50, 0.64, t += 33);
    }
    expect(dynamicCalibrator.centerY).toBeCloseTo(0.64, 1);
  });

  it('correctly classifies horizontal columns (L, C, R) with dead-band hysteresis', () => {
    // Warm up center
    for (let f = 1; f <= 15; f++) {
      calibrator.update(0.50, 0.50, f * 33);
    }

    // Lean left (mirrored x < 0.40)
    const leanLeft = calibrator.update(0.32, 0.50, 16 * 33);
    expect(leanLeft.col).toBe('L');

    // Small bounce back within hysteresis band should keep 'L' committed
    const bounce = calibrator.update(0.41, 0.50, 17 * 33);
    expect(bounce.col).toBe('L');

    // Full return to center
    const center = calibrator.update(0.50, 0.50, 18 * 33);
    expect(center.col).toBe('C');

    // Lean right (x > 0.60)
    const leanRight = calibrator.update(0.68, 0.50, 19 * 33);
    expect(leanRight.col).toBe('R');
  });

  it('supports HandZone calibration with compact center box (width 0.16) and ergonomic vertical deltas', () => {
    const handCalibrator = new AdaptivePoseCalibrator({
      defaultCenterX: 0.50,
      defaultCenterY: 0.55,
      leftBoundary: 0.42,
      rightBoundary: 0.58,
      jumpDelta: 0.10,
      slideDelta: 0.11,
      hysteresisBand: 0.030,
      calibrationFrames: 15
    });

    // 1. Initial warmup with hand resting comfortably at y=0.55
    for (let f = 1; f <= 15; f++) {
      handCalibrator.update(0.50, 0.55, f * 33);
    }
    expect(handCalibrator.isCalibrated).toBe(true);
    expect(handCalibrator.centerX).toBe(0.50);
    expect(handCalibrator.centerY).toBeCloseTo(0.55, 1);

    // Center column width must be compact (0.58 - 0.42 = 0.16, not the old 0.33)
    expect(handCalibrator.rightBoundary - handCalibrator.leftBoundary).toBeCloseTo(0.16, 2);

    // 2. Small hand nudge left (x=0.38) triggers Left lane immediately
    const leftRes = handCalibrator.update(0.38, 0.55, 16 * 33);
    expect(leftRes.col).toBe('L');

    // 3. Return to center (x=0.48)
    const centerRes = handCalibrator.update(0.48, 0.55, 17 * 33);
    expect(centerRes.col).toBe('C');

    // 4. Comfortable vertical lift (y=0.42) triggers JUMP without reaching ceiling
    const jumpRes = handCalibrator.update(0.50, 0.42, 18 * 33);
    expect(jumpRes.row).toBe('top');

    // 5. Comfortable vertical dip (y=0.68) triggers SLIDE without leaving frame
    const slideRes = handCalibrator.update(0.50, 0.68, 19 * 33);
    expect(slideRes.row).toBe('bot');
  });

  it('anticipates lane changes with velocity lookahead during low-FPS video (8-10 FPS)', () => {
    // 1. Warm up at 10 FPS (interval = 100ms)
    for (let f = 1; f <= 15; f++) {
      calibrator.update(0.50, 0.52, f * 100);
    }
    expect(calibrator.isCalibrated).toBe(true);

    // 2. Head starts rapid motion leftwards (x goes from 0.50 to 0.44 with vx = -0.6/s)
    // Raw coordinate is still 0.44 (which without lookahead would be inside center lane!)
    // But with velocity lookahead at dt = 100ms, predX is projected to ~0.39 (< 0.42)
    const result = calibrator.update(0.44, 0.52, 16 * 100);
    expect(result.isLowFps).toBe(true);
    expect(result.predX).toBeLessThan(0.42);
    expect(result.col).toBe('L'); // Immediate single-frame lane change!
  });
});
