import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ObstacleType, checkObstacleCollision } from '../src/game/Obstacles.js';

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
});
