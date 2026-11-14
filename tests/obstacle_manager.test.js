import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ObstacleType, ObstacleManager, checkObstacleCollision } from '../src/game/ObstacleManager.js';

describe('Obstacle Collision Detection (checkObstacleCollision)', () => {
  it('detects collision with JUMP_BARRIER when running on ground', () => {
    // Runner standing on ground: y: 0..1.7, x: -0.5..0.5, z: -0.4..0.4
    const runnerHitbox = new THREE.Box3(
      new THREE.Vector3(-0.5, 0, -0.4),
      new THREE.Vector3(0.5, 1.7, 0.4)
    );

    // Jump barrier at z: 0, height 0.0..0.7
    const jumpBarrier = {
      type: ObstacleType.JUMP_BARRIER,
      minY: 0.0,
      maxY: 0.7,
      box: new THREE.Box3(
        new THREE.Vector3(-1.0, 0.0, -0.2),
        new THREE.Vector3(1.0, 0.7, 0.2)
      )
    };

    expect(checkObstacleCollision(runnerHitbox, jumpBarrier)).toBe(true);
  });

  it('allows runner to jump over JUMP_BARRIER when clear of maxY', () => {
    // Runner in air: y: 0.8..2.5
    const runnerHitbox = new THREE.Box3(
      new THREE.Vector3(-0.5, 0.8, -0.4),
      new THREE.Vector3(0.5, 2.5, 0.4)
    );

    const jumpBarrier = {
      type: ObstacleType.JUMP_BARRIER,
      minY: 0.0,
      maxY: 0.7,
      box: new THREE.Box3(
        new THREE.Vector3(-1.0, 0.0, -0.2),
        new THREE.Vector3(1.0, 0.7, 0.2)
      )
    };

    expect(checkObstacleCollision(runnerHitbox, jumpBarrier)).toBe(false);
  });

  it('detects collision with SLIDE_BARRIER when runner is standing upright', () => {
    // Runner standing: y: 0..1.7
    const runnerHitbox = new THREE.Box3(
      new THREE.Vector3(-0.5, 0, -0.4),
      new THREE.Vector3(0.5, 1.7, 0.4)
    );

    // Slide barrier beam: y: 1.15..2.2
    const slideBarrier = {
      type: ObstacleType.SLIDE_BARRIER,
      minY: 1.15,
      maxY: 2.2,
      box: new THREE.Box3(
        new THREE.Vector3(-1.0, 1.15, -0.2),
        new THREE.Vector3(1.0, 2.2, 0.2)
      )
    };

    expect(checkObstacleCollision(runnerHitbox, slideBarrier)).toBe(true);
  });

  it('allows runner to duck under SLIDE_BARRIER when height is lowered', () => {
    // Runner sliding: y: 0..0.9
    const runnerHitbox = new THREE.Box3(
      new THREE.Vector3(-0.5, 0, -0.4),
      new THREE.Vector3(0.5, 0.9, 0.4)
    );

    const slideBarrier = {
      type: ObstacleType.SLIDE_BARRIER,
      minY: 1.15,
      maxY: 2.2,
      box: new THREE.Box3(
        new THREE.Vector3(-1.0, 1.15, -0.2),
        new THREE.Vector3(1.0, 2.2, 0.2)
      )
    };

    expect(checkObstacleCollision(runnerHitbox, slideBarrier)).toBe(false);
  });

  it('always collides with TRAIN_BLOCKER on intersecting bounding box', () => {
    const standingRunner = new THREE.Box3(
      new THREE.Vector3(-0.5, 0, -0.4),
      new THREE.Vector3(0.5, 1.7, 0.4)
    );

    const slidingRunner = new THREE.Box3(
      new THREE.Vector3(-0.5, 0, -0.4),
      new THREE.Vector3(0.5, 0.8, 0.4)
    );

    const train = {
      type: ObstacleType.TRAIN_BLOCKER,
      minY: 0.0,
      maxY: 2.8,
      box: new THREE.Box3(
        new THREE.Vector3(-1.0, 0.0, -2.5),
        new THREE.Vector3(1.0, 2.8, 2.5)
      )
    };

    expect(checkObstacleCollision(standingRunner, train)).toBe(true);
    expect(checkObstacleCollision(slidingRunner, train)).toBe(true);
  });

  it('returns false when runner is in another lane (no box intersection)', () => {
    // Runner in right lane: x: 2.0..3.0
    const runnerHitbox = new THREE.Box3(
      new THREE.Vector3(2.0, 0, -0.4),
      new THREE.Vector3(3.0, 1.7, 0.4)
    );

    // Obstacle in center lane: x: -1.0..1.0
    const centerObstacle = {
      type: ObstacleType.TRAIN_BLOCKER,
      minY: 0.0,
      maxY: 2.8,
      box: new THREE.Box3(
        new THREE.Vector3(-1.0, 0.0, -2.5),
        new THREE.Vector3(1.0, 2.8, 2.5)
      )
    };

    expect(checkObstacleCollision(runnerHitbox, centerObstacle)).toBe(false);
  });

  it('detects collision with FALLING_HAZARD once it has slammed onto the track', () => {
    const runnerHitbox = new THREE.Box3(
      new THREE.Vector3(-0.5, 0, -0.4),
      new THREE.Vector3(0.5, 1.7, 0.4)
    );

    // Landed falling crate at y: 0..1.8, z: -0.95..0.95
    const landedHazard = {
      type: ObstacleType.FALLING_HAZARD,
      minY: 0.0,
      maxY: 1.8,
      box: new THREE.Box3(
        new THREE.Vector3(-0.95, 0.0, -0.95),
        new THREE.Vector3(0.95, 1.8, 0.95)
      )
    };

    expect(checkObstacleCollision(runnerHitbox, landedHazard)).toBe(true);
  });

  it('allows runner to safely pass underneath FALLING_HAZARD while it is still high in the air', () => {
    const runnerHitbox = new THREE.Box3(
      new THREE.Vector3(-0.5, 0, -0.4),
      new THREE.Vector3(0.5, 1.7, 0.4)
    );

    // Falling crate still high in the sky: y: 7.0..8.8
    const midAirHazard = {
      type: ObstacleType.FALLING_HAZARD,
      minY: 7.0,
      maxY: 8.8,
      box: new THREE.Box3(
        new THREE.Vector3(-0.95, 7.0, -0.95),
        new THREE.Vector3(0.95, 8.8, 0.95)
      )
    };

    expect(checkObstacleCollision(runnerHitbox, midAirHazard)).toBe(false);
  });
});

describe('ObstacleManager Lifecycle & Spawning', () => {
  it('spawns FALLING_HAZARD periodically once distance threshold is reached', () => {
    const scene = new THREE.Scene();
    const mgr = new ObstacleManager(scene, null, null);
    mgr.reset();

    const spawnedHazards = [];
    const origSpawn = mgr._spawnFallingHazard.bind(mgr);
    mgr._spawnFallingHazard = function(lane, z) {
      spawnedHazards.push({ distance: mgr.totalDistance, lane, z });
      return origSpawn(lane, z);
    };

    const hitbox = new THREE.Box3();
    // Simulate running 1500m at 12 m/s
    for (let dist = 0; dist < 1500; dist += 12 * 0.016) {
      mgr.update(0.016, 12, 0.5, hitbox, () => {}, () => {}, dist);
    }

    // Must have spawned falling hazards over 1500m (rare: around 3-5 over 1500m)
    expect(spawnedHazards.length).toBeGreaterThanOrEqual(3);

    // First spawn must only happen after initial distance threshold (>= 120m)
    expect(spawnedHazards[0].distance).toBeGreaterThanOrEqual(120);
  });

  it('respects minimum spacing distance between consecutive FALLING_HAZARD spawns', () => {
    const scene = new THREE.Scene();
    const mgr = new ObstacleManager(scene, null, null);
    mgr.reset();

    const spawnDistances = [];
    const origSpawn = mgr._spawnFallingHazard.bind(mgr);
    mgr._spawnFallingHazard = function(lane, z) {
      spawnDistances.push(mgr.totalDistance);
      return origSpawn(lane, z);
    };

    const hitbox = new THREE.Box3();
    for (let dist = 0; dist < 3000; dist += 12 * 0.016) {
      mgr.update(0.016, 12, 0.5, hitbox, () => {}, () => {}, dist);
    }

    expect(spawnDistances.length).toBeGreaterThanOrEqual(6);

    // Verify distance between consecutive spawns is at least 220m
    for (let i = 1; i < spawnDistances.length; i++) {
      const delta = spawnDistances[i] - spawnDistances[i - 1];
      expect(delta).toBeGreaterThanOrEqual(210); // accounts for discrete frame intervals
    }
  });

  it('triggers crate drop close to the player (within 16-20m)', () => {
    const scene = new THREE.Scene();
    const mgr = new ObstacleManager(scene, null, null);
    mgr.reset();
    mgr._spawnFallingHazard(0, -60);
    const obs = mgr.activeObstacles.find(o => o.type === ObstacleType.FALLING_HAZARD);
    expect(obs).toBeDefined();
    expect(obs.type).toBe(ObstacleType.FALLING_HAZARD);
    expect(obs.dropping).toBe(false);

    const hitbox = new THREE.Box3();
    // Move obstacle forward until it reaches Z = -20 (still high, not dropping)
    while (obs.mesh.position.z < -20) {
      mgr.update(0.016, 12, 0.5, hitbox, () => {}, () => {}, 0);
    }
    expect(obs.dropping).toBe(false);

    // Update through the trigger zone (-16m at speed 12)
    while (obs.mesh.position.z < -14) {
      mgr.update(0.016, 12, 0.5, hitbox, () => {}, () => {}, 0);
    }
    // Now it should be dropping close to player
    expect(obs.dropping).toBe(true);
  });
});
