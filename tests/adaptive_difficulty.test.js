import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptiveDifficultyManager, DDAState, STAGE_TARGET_TTC } from '../src/game/AdaptiveDifficultyManager.js';

describe('AdaptiveDifficultyManager (DDA on TTC)', () => {
  let dda;

  beforeEach(() => {
    dda = new AdaptiveDifficultyManager({ enabled: true, baseSpacing: 30 });
  });

  it('initializes with balanced default state', () => {
    expect(dda.enabled).toBe(true);
    expect(dda.state).toBe(DDAState.OPTIMAL);
    expect(dda.performanceScore).toBe(0.5);
    expect(dda.speedMultiplier).toBe(1.0);
    expect(dda.spacingMultiplier).toBe(1.0);
    expect(dda.effectiveSpacing).toBe(30);
  });

  it('adjusts performance score upwards on early safe reaction (high TTC)', () => {
    // Stage 0 target TTC is 550ms. Player dodges with generous margin of 1100ms (ratio = 2.0)
    dda.recordReaction(1100, 0);

    // Performance score should rise above 0.5
    expect(dda.performanceScore).toBeGreaterThan(0.5);

    // Update DDA for 1.5 seconds to allow smooth lerp
    for (let i = 0; i < 30; i++) {
      dda.update(0.05, 0);
    }

    expect(dda.speedMultiplier).toBeGreaterThan(1.0);
    expect(dda.spacingMultiplier).toBeLessThan(1.0);
    expect(dda.effectiveSpacing).toBeLessThan(30);
  });

  it('adjusts performance score downwards on near-miss reaction (low TTC)', () => {
    // Stage 0 target is 550ms. Player dodges at last moment with only 180ms TTC
    dda.recordReaction(180, 0);

    expect(dda.performanceScore).toBeLessThan(0.5);

    for (let i = 0; i < 30; i++) {
      dda.update(0.05, 0);
    }

    // Should enter assist mode or lower speed, widen spacing
    expect(dda.speedMultiplier).toBeLessThan(1.0);
    expect(dda.spacingMultiplier).toBeGreaterThan(1.0);
    expect(dda.effectiveSpacing).toBeGreaterThan(30);
  });

  it('triggers immediate ASSIST mode and recovery period upon collision', () => {
    // Initially in optimal flow
    expect(dda.state).toBe(DDAState.OPTIMAL);

    dda.recordCollision(0);

    expect(dda.totalCollisions).toBe(1);
    expect(dda.collisionRecoveryTimer).toBe(8.0);
    expect(dda.performanceScore).toBeLessThanOrEqual(0.2);

    dda.update(0.1, 0);
    expect(dda.state).toBe(DDAState.ASSIST);

    // Obstacle double factor must be 0 in assist mode (no impossible double rows)
    for (let i = 0; i < 40; i++) {
      dda.update(0.05, 0);
    }
    expect(dda.doubleFactor).toBeLessThan(0.1);
  });

  it('recovers from collision assist mode after grace period expires', () => {
    dda.recordCollision(0);
    expect(dda.collisionRecoveryTimer).toBe(8.0);

    // Fast-forward 8.5 seconds
    dda.update(8.5, 0);
    expect(dda.collisionRecoveryTimer).toBe(0);

    // Successful dodges after recovery
    for (let i = 0; i < 5; i++) {
      dda.recordReaction(750, 0);
    }
    dda.update(0.1, 0);

    expect(dda.performanceScore).toBeGreaterThan(0.38);
    expect(dda.state).not.toBe(DDAState.ASSIST);
  });

  it('respects modality-specific target TTCs across different stages', () => {
    // Stage 0 (Keyboard) target is 550ms
    expect(STAGE_TARGET_TTC[0]).toBe(550);
    // Stage 5 (HandSwipe) target is 900ms
    expect(STAGE_TARGET_TTC[5]).toBe(900);

    const ddaKbd = new AdaptiveDifficultyManager();
    const ddaSwipe = new AdaptiveDifficultyManager();

    // 600ms is generous for keyboard (ratio > 1.0)
    ddaKbd.recordReaction(600, 0);
    // 600ms is rushed / near-miss for hand swipe (ratio < 1.0)
    ddaSwipe.recordReaction(600, 5);

    expect(ddaKbd.performanceScore).toBeGreaterThan(ddaSwipe.performanceScore);
  });

  it('freezes multipliers to neutral 1.0 when disabled', () => {
    dda.setEnabled(false);
    expect(dda.enabled).toBe(false);

    dda.recordReaction(1500, 0);
    dda.update(0.5, 0);

    expect(dda.speedMultiplier).toBe(1.0);
    expect(dda.spacingMultiplier).toBe(1.0);
    expect(dda.doubleFactor).toBe(1.0);
    expect(dda.state).toBe(DDAState.OPTIMAL);
  });

  it('exports valid metrics snapshot with state duration tracking', () => {
    dda.update(1.0, 0); // 1.0s in optimal
    dda.recordCollision(0);
    dda.update(2.0, 0); // 2.0s in assist

    const m = dda.getMetrics();
    expect(m.enabled).toBe(true);
    expect(m.state).toBe(DDAState.ASSIST);
    expect(m.totalCollisions).toBe(1);
    expect(m.timeInOptimalSec).toBeCloseTo(1.0, 1);
    expect(m.timeInAssistSec).toBeCloseTo(2.0, 1);
    expect(m.effectiveSpacing).toBeGreaterThan(30);
  });

  it('resets cleanly upon reset() call', () => {
    dda.recordCollision(0);
    dda.update(1.0, 0);
    dda.reset();

    expect(dda.performanceScore).toBe(0.5);
    expect(dda.state).toBe(DDAState.OPTIMAL);
    expect(dda.totalCollisions).toBe(0);
    expect(dda.collisionRecoveryTimer).toBe(0);
    expect(dda.timeInAssist).toBe(0);
    expect(dda.dodgeHistory).toHaveLength(0);
  });

  describe('Play Style Persona (Regularity of Dodge Margin)', () => {
    it('returns calibrating status until sufficient samples are recorded', () => {
      expect(dda.getPlayStyle().archetype).toBe('calibrating');

      dda.recordReaction(550, 0, 15);
      dda.recordReaction(550, 0, 15);
      expect(dda.getPlayStyle().archetype).toBe('calibrating');
    });

    it('identifies Risk-Taker archetype upon regular tight-margin dodges', () => {
      // Stage 0 target is 550ms. Player consistently dodges with ~320ms margin (tight, ~4.8m)
      for (let i = 0; i < 5; i++) {
        dda.recordReaction(320, 0, 15);
      }

      const style = dda.getPlayStyle();
      expect(style.archetype).toBe('risk_taker');
      expect(style.regularityPct).toBeGreaterThanOrEqual(80);
      expect(style.avgMarginMeters).toBeCloseTo(4.8, 1);
    });

    it('identifies Cautious archetype upon regular early-clearance dodges', () => {
      // Stage 0 target is 550ms. Player consistently dodges very early ~950ms margin (~14.25m -> rounds to 14.3m)
      for (let i = 0; i < 5; i++) {
        dda.recordReaction(950, 0, 15);
      }

      const style = dda.getPlayStyle();
      expect(style.archetype).toBe('cautious');
      expect(style.regularityPct).toBeGreaterThanOrEqual(80);
      expect(style.avgMarginMeters).toBeCloseTo(14.3, 1);
    });

    it('identifies Variable archetype when dodge distances fluctuate wildly without pattern', () => {
      // Wildly fluctuating margins: 200ms -> 1200ms -> 220ms -> 1100ms (high variance)
      dda.recordReaction(200, 0, 15);
      dda.recordReaction(1200, 0, 15);
      dda.recordReaction(220, 0, 15);
      dda.recordReaction(1100, 0, 15);

      const style = dda.getPlayStyle();
      expect(style.archetype).toBe('variable');
      expect(style.regularityPct).toBeLessThan(70);
    });

    it('detects Near-Misses on close dodges (<= 8.5m) and increments counter', () => {
      // 320ms at 15 m/s = 4.8m -> Near-Miss!
      const res1 = dda.recordReaction(320, 0, 15, 'lane');
      expect(res1.isNearMiss).toBe(true);
      expect(res1.distanceMeters).toBe(4.8);
      expect(dda.nearMissCount).toBe(1);

      // 1000ms at 15 m/s = 15m -> Safe dodge (not a near-miss)
      const res2 = dda.recordReaction(1000, 0, 15, 'jump');
      expect(res2.isNearMiss).toBe(false);
      expect(dda.nearMissCount).toBe(1);
    });

    it('identifies Weaver vs Acrobat maneuver preferences and generates combined RPG title', () => {
      // 4 lane switches in a row -> Weaver
      for (let i = 0; i < 4; i++) {
        dda.recordReaction(320, 0, 15, 'lane');
      }

      const style = dda.getPlayStyle();
      expect(style.maneuverArchetype).toBe('weaver');
      expect(style.weavesPct).toBe(100);
      expect(style.personaTitle).toContain('Ризиковий Слаломіст');

      // Now do 6 jumps/slides -> Acrobat dominates
      for (let i = 0; i < 7; i++) {
        dda.recordReaction(320, 0, 15, 'jump');
      }
      const acrobatStyle = dda.getPlayStyle();
      expect(acrobatStyle.maneuverArchetype).toBe('acrobat');
      expect(acrobatStyle.personaTitle).toContain('Ризиковий Акробат');
    });
  });
});
