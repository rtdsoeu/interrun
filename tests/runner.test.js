import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Runner, PlayerState } from '../src/game/Runner.js';

describe('Runner Physics, Lane Clamping, and Hitbox Math', () => {
  let scene;
  let runner;

  beforeEach(() => {
    scene = new THREE.Scene();
    runner = new Runner(scene, null);
  });

  it('initializes in center lane (0) and RUNNING state', () => {
    expect(runner.currentLane).toBe(0);
    expect(runner.targetX).toBe(0);
    expect(runner.state).toBe(PlayerState.RUNNING);
    expect(runner.pos.x).toBe(0);
    expect(runner.pos.y).toBe(0);
  });

  it('clamps horizontal lane delta between -1 and 1', () => {
    // Start at center (0), move left
    runner.handleInput({ laneDelta: -1, jump: false, slide: false });
    expect(runner.currentLane).toBe(-1);
    expect(runner.targetX).toBe(-runner.laneWidth);

    // Try moving left again -> should clamp at -1
    runner.handleInput({ laneDelta: -1, jump: false, slide: false });
    expect(runner.currentLane).toBe(-1);

    // Move right twice -> 0 then 1
    runner.handleInput({ laneDelta: 1, jump: false, slide: false });
    expect(runner.currentLane).toBe(0);
    expect(runner.targetX).toBe(0);

    runner.handleInput({ laneDelta: 1, jump: false, slide: false });
    expect(runner.currentLane).toBe(1);
    expect(runner.targetX).toBe(runner.laneWidth);

    // Move right again -> clamp at 1
    runner.handleInput({ laneDelta: 1, jump: false, slide: false });
    expect(runner.currentLane).toBe(1);
  });

  it('handles absolute targetLane input with clamping', () => {
    runner.handleInput({ targetLane: -1, jump: false, slide: false });
    expect(runner.currentLane).toBe(-1);

    runner.handleInput({ targetLane: 1, jump: false, slide: false });
    expect(runner.currentLane).toBe(1);

    // Clamping invalid values
    runner.handleInput({ targetLane: 5, jump: false, slide: false });
    expect(runner.currentLane).toBe(1);

    runner.handleInput({ targetLane: -10, jump: false, slide: false });
    expect(runner.currentLane).toBe(-1);
  });

  it('handles jump and vertical gravity physics', () => {
    runner.handleInput({ laneDelta: 0, jump: true, slide: false });
    expect(runner.state).toBe(PlayerState.JUMPING);
    expect(runner.yVelocity).toBe(runner.jumpSpeed);

    // Simulate 0.1s in the air
    runner.update(0.1, 10);
    expect(runner.pos.y).toBeGreaterThan(0);
    expect(runner.yVelocity).toBeLessThan(runner.jumpSpeed);

    // Simulate enough time to land back on the ground
    for (let i = 0; i < 30; i++) {
      runner.update(0.05, 10);
    }

    expect(runner.pos.y).toBe(0);
    expect(runner.state).toBe(PlayerState.RUNNING);
  });

  it('handles slide/duck duration and state return', () => {
    runner.handleInput({ laneDelta: 0, jump: false, slide: true });
    expect(runner.state).toBe(PlayerState.SLIDING);
    expect(runner.slideTimer).toBe(runner.slideDuration);

    // Partial slide duration
    runner.update(0.3, 10);
    expect(runner.state).toBe(PlayerState.SLIDING);
    expect(runner.slideTimer).toBeCloseTo(runner.slideDuration - 0.3, 2);

    // Complete slide duration
    runner.update(0.6, 10);
    expect(runner.state).toBe(PlayerState.RUNNING);
    expect(runner.slideTimer).toBe(0);
  });

  it('performs fast drop down when sliding mid-jump', () => {
    runner.handleInput({ laneDelta: 0, jump: true, slide: false });
    expect(runner.state).toBe(PlayerState.JUMPING);

    // Mid-air duck
    runner.handleInput({ laneDelta: 0, jump: false, slide: true });
    expect(runner.yVelocity).toBe(-runner.jumpSpeed * 1.5);
    expect(runner.slideTimer).toBe(runner.slideDuration);
  });

  it('dynamically adjusts hitbox height between normal (1.8m) and slide (0.75m)', () => {
    runner.update(0.016, 10);
    const normalHeight = runner.hitbox.max.y - runner.hitbox.min.y;
    expect(normalHeight).toBeCloseTo(1.8, 2);

    // Initiate slide
    runner.handleInput({ laneDelta: 0, jump: false, slide: true });
    runner.update(0.016, 10);
    const slideHeight = runner.hitbox.max.y - runner.hitbox.min.y;
    expect(slideHeight).toBeCloseTo(0.75, 2);
  });

  it('transitions to CRASHED state and ignores input after crash', () => {
    runner.crash();
    expect(runner.state).toBe(PlayerState.CRASHED);

    runner.handleInput({ laneDelta: 1, jump: true, slide: true });
    expect(runner.currentLane).toBe(0);
    expect(runner.state).toBe(PlayerState.CRASHED);
  });

  it('resets state, position, and velocities cleanly on reset()', () => {
    runner.handleInput({ targetLane: 1, jump: true, slide: false });
    runner.update(0.1, 10);
    runner.crash();

    runner.reset();
    expect(runner.state).toBe(PlayerState.RUNNING);
    expect(runner.currentLane).toBe(0);
    expect(runner.pos.x).toBe(0);
    expect(runner.pos.y).toBe(0);
    expect(runner.yVelocity).toBe(0);
  });

  it('enforces slideDuration and slideCooldown even if ducking input is continuously held', () => {
    // 1. Initial slide trigger
    runner.handleInput({ laneDelta: 0, jump: false, slide: false, isDucking: true });
    expect(runner.state).toBe(PlayerState.SLIDING);
    expect(runner.slideTimer).toBe(runner.slideDuration);

    // 2. Continuous duck input over slideDuration (e.g. 0.75s)
    const steps = Math.ceil(runner.slideDuration / 0.05);
    for (let i = 0; i < steps; i++) {
      runner.update(0.05, 10);
      runner.handleInput({ laneDelta: 0, jump: false, slide: false, isDucking: true });
    }

    // Must stand up to RUNNING after slideDuration expires, and activate slideCooldown
    expect(runner.state).toBe(PlayerState.RUNNING);
    expect(runner.slideCooldown).toBeGreaterThan(0);

    // 3. While slideCooldown > 0, duck input cannot trigger SLIDING
    runner.handleInput({ laneDelta: 0, jump: false, slide: false, isDucking: true });
    expect(runner.state).toBe(PlayerState.RUNNING);

    // 4. Once cooldown decays, next slide is permitted
    runner.update(runner.slideCooldown + 0.01, 10);
    expect(runner.slideCooldown).toBe(0);
    runner.handleInput({ laneDelta: 0, jump: false, slide: false, isDucking: true });
    expect(runner.state).toBe(PlayerState.SLIDING);
  });
});
