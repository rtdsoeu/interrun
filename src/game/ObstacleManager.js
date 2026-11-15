import * as THREE from 'three';

export const ObstacleType = {
  JUMP_BARRIER: 'jump_barrier',   // low barrier — must jump over
  SLIDE_BARRIER: 'slide_barrier', // high barrier — must slide underneath
  TRAIN_BLOCKER: 'train_blocker', // train car / solid obstacle — must switch lanes
  FALLING_HAZARD: 'falling_hazard', // sudden overhead cargo drop — must switch lanes
  COIN: 'coin'
};

/**
 * Evaluates whether a runner hitbox collides with an obstacle.
 * Takes into account specific obstacle clearance rules:
 * - SLIDE_BARRIER: cleared if runner ducks underneath (runnerHitbox.max.y < obs.minY + 0.1)
 * - JUMP_BARRIER: cleared if runner jumps above (runnerHitbox.min.y > obs.maxY - 0.1)
 * - TRAIN_BLOCKER: always collides if bounding boxes intersect
 *
 * @param {THREE.Box3} runnerHitbox
 * @param {{ type: string, box: THREE.Box3, minY: number, maxY: number }} obs
 * @returns {boolean} true if collision occurs
 */
export function checkObstacleCollision(runnerHitbox, obs) {
  if (!runnerHitbox.intersectsBox(obs.box)) return false;

  if (obs.type === ObstacleType.SLIDE_BARRIER && runnerHitbox.max.y < obs.minY + 0.1) {
    return false;
  }

  if (obs.type === ObstacleType.JUMP_BARRIER && runnerHitbox.min.y > obs.maxY - 0.1) {
    return false;
  }

  return true;
}

/**
 * ObstacleManager — obstacle and coin generation with guaranteed
 * precise analytical hitboxes and evenly spaced obstacle rows.
 */
export class ObstacleManager {
  constructor(scene, skinManager, soundFx) {
    this.scene = scene;
    this.skinManager = skinManager;
    this.soundFx = soundFx;

    this.laneWidth = 2.4;
    this.activeObstacles = [];
    this.activeCoins = [];

    // Three.js groups
    this.obstacleGroup = new THREE.Group();
    this.coinGroup = new THREE.Group();
    this.scene.add(this.obstacleGroup);
    this.scene.add(this.coinGroup);

    this.baseSpawnInterval = 30;
    this.spawnInterval = 30; // distance between rows
    this.adaptiveSpacingMultiplier = 1.0;
    this.adaptiveDoubleFactor = 1.0;
    this.furthestZ = -180;
    this.isTransitioning = false;

    // Zero-allocation reusable vector for collision calculations
    this._tempCenter = new THREE.Vector3();

    // Object pools to completely prevent runtime allocations during gameplay
    this.totalDistance = 0;
    this._lastFallingHazardDist = -999;
    this._pools = {
      [ObstacleType.JUMP_BARRIER]: [],
      [ObstacleType.SLIDE_BARRIER]: [],
      [ObstacleType.TRAIN_BLOCKER]: [],
      [ObstacleType.FALLING_HAZARD]: []
    };
    this._coinPool = [];

    this._initMaterials();
    this._initGeometries();
  }

  setTransitioning(isTrans) {
    this.isTransitioning = isTrans;
    if (isTrans) {
      // Clear hazardous obstacles right ahead of the runner (-60m to +10m) for a clean runway
      for (let i = this.activeObstacles.length - 1; i >= 0; i--) {
        const obs = this.activeObstacles[i];
        if (obs.mesh.position.z >= -60 && obs.mesh.position.z <= 10) {
          this._recycleObstacle(obs);
          this.activeObstacles.splice(i, 1);
        }
      }
    }
  }

  /**
   * Sets dynamic difficulty parameters from AdaptiveDifficultyManager.
   * @param {number} spacingMultiplier Multiplier for distance between obstacle rows (e.g. 0.85 .. 1.35)
   * @param {number} doubleFactor Factor for two-lane obstacle spawn probability (e.g. 0.0 .. 1.4)
   */
  setAdaptiveParameters(spacingMultiplier = 1.0, doubleFactor = 1.0) {
    this.adaptiveSpacingMultiplier = Math.max(0.7, Math.min(1.5, spacingMultiplier));
    this.adaptiveDoubleFactor = Math.max(0.0, Math.min(2.0, doubleFactor));
    this.spawnInterval = this.baseSpawnInterval * this.adaptiveSpacingMultiplier;
  }

  _initGeometries() {
    // Reusable shared geometries to eliminate GPU buffer churn and memory allocations
    this._geoJumpBar = new THREE.BoxGeometry(2.0, 0.26, 0.2);
    this._geoJumpPole = new THREE.CylinderGeometry(0.06, 0.08, 0.7, 8);

    this._geoSlideBeam = new THREE.BoxGeometry(2.1, 0.6, 0.3);
    this._geoSlidePole = new THREE.BoxGeometry(0.1, 2.0, 0.1);

    this._geoTrain = new THREE.BoxGeometry(2.0, 2.6, 5.0);
    this._geoTrainLight = new THREE.SphereGeometry(0.14, 8, 8);

    // Falling Hazard geometries
    this._geoFallingCrate = new THREE.BoxGeometry(1.9, 1.8, 1.9);
    this._geoCrateTrim = new THREE.BoxGeometry(1.94, 0.22, 1.94);
    this._geoCrateTopBeacon = new THREE.CylinderGeometry(0.18, 0.24, 0.25, 8);
    this._geoWarningDecal = new THREE.PlaneGeometry(2.3, 2.3);
    this._geoWarningDecal.rotateX(-Math.PI / 2);
    this._geoWarningRing = new THREE.RingGeometry(0.75, 1.05, 16);
    this._geoWarningRing.rotateX(-Math.PI / 2);

    // Coin geometry
    this._coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16);
    this._coinGeo.rotateZ(Math.PI / 2);
  }

  _recycleObstacle(obs) {
    this.obstacleGroup.remove(obs.mesh);
    if (obs.type === ObstacleType.FALLING_HAZARD) {
      if (obs.crateGroup) obs.crateGroup.visible = false;
      if (obs.decal) obs.decal.visible = false;
      if (obs.ring) obs.ring.visible = false;
    }
    if (this._pools[obs.type]) {
      this._pools[obs.type].push(obs);
    }
  }

  _recycleCoin(coin) {
    this.coinGroup.remove(coin.mesh);
    this._coinPool.push(coin);
  }

  _initMaterials() {
    this._matHazard = new THREE.MeshStandardMaterial({
      color: 0xff3d5e,
      roughness: 0.3,
      metalness: 0.4,
      emissive: 0xaa1122,
      emissiveIntensity: 0.35
    });

    this._matFrame = new THREE.MeshStandardMaterial({
      color: 0x222636,
      roughness: 0.5,
      metalness: 0.6
    });

    this._matTrain = new THREE.MeshStandardMaterial({
      color: 0x1b2845,
      roughness: 0.4,
      metalness: 0.5
    });

    this._matTrainLight = new THREE.MeshBasicMaterial({
      color: 0xffeedd
    });

    // Falling Hazard materials
    this._matFallingCrate = new THREE.MeshStandardMaterial({
      color: 0x1e1b24,
      roughness: 0.35,
      metalness: 0.65
    });

    this._matCrateTrim = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      roughness: 0.25,
      metalness: 0.4,
      emissive: 0xff3300,
      emissiveIntensity: 0.6
    });

    this._matWarningBeacon = new THREE.MeshBasicMaterial({
      color: 0xffaa00
    });

    this._matWarningDecal = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this._matWarningRing = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this._matCoin = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0xffaa00,
      emissiveIntensity: 0.45
    });
  }

  applyTheme(theme) {
    if (!theme) return;
    if (theme.neonPalette && theme.neonPalette.length > 0) {
      this._matHazard.emissive.setHex(theme.neonPalette[1] || 0xff3d5e);
      if (this._matCrateTrim) {
        this._matCrateTrim.emissive.setHex(theme.neonPalette[0] || 0xff4400);
      }
    }
  }

  reset() {
    this.totalDistance = 0;
    this._lastFallingHazardDist = -999;
    this.adaptiveSpacingMultiplier = 1.0;
    this.adaptiveDoubleFactor = 1.0;
    this.spawnInterval = this.baseSpawnInterval;
    for (let i = 0; i < this.activeObstacles.length; i++) {
      this._recycleObstacle(this.activeObstacles[i]);
    }
    this.activeObstacles.length = 0;

    for (let i = 0; i < this.activeCoins.length; i++) {
      this._recycleCoin(this.activeCoins[i]);
    }
    this.activeCoins.length = 0;

    // Initial seeding: first obstacle at Z = -45, last at -180
    this.furthestZ = -180;
    for (let z = -45; z >= -180; z -= this.spawnInterval) {
      this.spawnPattern(z, 0.1);
    }
  }

  /**
   * Spawn a row of obstacles and coins
   * @param {number} zPosition
   * @param {number} difficulty 0..1
   */
  spawnPattern(zPosition, difficulty = 0) {
    if (this.isTransitioning) {
      // Transition corridor: safe celebratory runway with coin arches and lines
      this._spawnCoinArch(0, zPosition);
      this._spawnCoinLine(-1, zPosition - 4, 3, 0.4);
      this._spawnCoinLine(1, zPosition - 4, 3, 0.4);
      return;
    }

    const lanes = [-1, 0, 1];
    lanes.sort(() => Math.random() - 0.5);

    // Rare Falling Hazard: distance >= 120m, spacing >= 220m, ~14% spawn chance or guaranteed after 400m
    const distSinceLast = this.totalDistance - this._lastFallingHazardDist;
    const canFalling = this.totalDistance >= 120 && distSinceLast >= 220;
    if (canFalling && (Math.random() < 0.14 || distSinceLast >= 400)) {
      this._lastFallingHazardDist = this.totalDistance;
      const hazardLane = lanes[0];
      this._spawnFallingHazard(hazardLane, zPosition);
      const coinLane = lanes[1];
      this._spawnCoinLine(coinLane, zPosition - 4, 3, 0.4);
      return;
    }

    // Adaptive double obstacle probability based on player flow state
    const doubleProb = Math.min(0.75, 0.6 * this.adaptiveDoubleFactor);
    const count = (difficulty > 0.35 && Math.random() < doubleProb) ? 2 : 1;

    for (let i = 0; i < count; i++) {
      const lane = lanes[i];
      const r = Math.random();

      if (r < 0.4) {
        this._spawnJumpBarrier(lane, zPosition);
        this._spawnCoinArch(lane, zPosition);
      } else if (r < 0.75) {
        this._spawnSlideBarrier(lane, zPosition);
        this._spawnCoinLine(lane, zPosition - 4, 3, 0.4);
      } else {
        this._spawnTrainBlocker(lane, zPosition);
      }
    }

    // Coins on clear lane
    const freeLane = lanes[count];
    if (freeLane !== undefined && Math.random() > 0.35) {
      this._spawnCoinLine(freeLane, zPosition - 5, 4, 0.5);
    }
  }

  _spawnFallingHazard(lane, z) {
    const x = lane * this.laneWidth;
    if (this._pools[ObstacleType.FALLING_HAZARD].length > 0) {
      const obs = this._pools[ObstacleType.FALLING_HAZARD].pop();
      obs.lane = lane;
      obs.x = x;
      obs.passed = false;
      obs.currentY = 10.5;
      obs.fallVelocity = 0;
      obs.dropping = false;
      obs.hasLanded = false;
      obs.minY = 9.6;
      obs.maxY = 11.4;
      obs.crateGroup.position.set(0, 10.5, 0);
      obs.crateGroup.visible = false;
      if (obs.decal) {
        obs.decal.material.opacity = 0.65;
        obs.decal.visible = false;
      }
      if (obs.ring) {
        obs.ring.material.opacity = 0.75;
        obs.ring.visible = false;
      }
      obs.mesh.position.set(x, 0, z);
      obs.box.min.set(x - obs.halfW, 9.6, z - obs.halfD);
      obs.box.max.set(x + obs.halfW, 11.4, z + obs.halfD);
      this.obstacleGroup.add(obs.mesh);
      this.activeObstacles.push(obs);
      return;
    }

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 1. Ground warning decal and pulsating laser ring (cloned for independent opacity)
    const decal = new THREE.Mesh(this._geoWarningDecal, this._matWarningDecal.clone());
    decal.position.set(0, 0.02, 0);
    decal.visible = false;
    const ring = new THREE.Mesh(this._geoWarningRing, this._matWarningRing.clone());
    ring.position.set(0, 0.03, 0);
    ring.visible = false;
    group.add(decal, ring);

    // 2. Heavy cyber cargo crate subgroup
    const crateGroup = new THREE.Group();
    crateGroup.position.set(0, 10.5, 0);
    crateGroup.visible = false;

    const crate = new THREE.Mesh(this._geoFallingCrate, this._matFallingCrate);
    crate.castShadow = true;
    crate.receiveShadow = true;
    crateGroup.add(crate);

    const trimTop = new THREE.Mesh(this._geoCrateTrim, this._matCrateTrim);
    trimTop.position.set(0, 0.6, 0);
    const trimBot = new THREE.Mesh(this._geoCrateTrim, this._matCrateTrim);
    trimBot.position.set(0, -0.6, 0);
    crateGroup.add(trimTop, trimBot);

    const beacon = new THREE.Mesh(this._geoCrateTopBeacon, this._matWarningBeacon);
    beacon.position.set(0, 1.0, 0);
    crateGroup.add(beacon);

    group.add(crateGroup);
    this.obstacleGroup.add(group);

    this.activeObstacles.push({
      type: ObstacleType.FALLING_HAZARD,
      mesh: group,
      crateGroup,
      decal,
      ring,
      lane,
      x,
      halfW: 0.95,
      currentY: 10.5,
      minY: 9.6,
      maxY: 11.4,
      halfD: 0.95,
      fallVelocity: 0,
      dropping: false,
      hasLanded: false,
      box: new THREE.Box3(),
      passed: false
    });
  }

  _spawnJumpBarrier(lane, z) {
    const x = lane * this.laneWidth;
    if (this._pools[ObstacleType.JUMP_BARRIER].length > 0) {
      const obs = this._pools[ObstacleType.JUMP_BARRIER].pop();
      obs.lane = lane;
      obs.x = x;
      obs.passed = false;
      obs.mesh.position.set(x, 0, z);
      this.obstacleGroup.add(obs.mesh);
      this.activeObstacles.push(obs);
      return;
    }

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const bar = new THREE.Mesh(this._geoJumpBar, this._matHazard);
    bar.position.y = 0.55;
    bar.castShadow = true;
    group.add(bar);

    const poleL = new THREE.Mesh(this._geoJumpPole, this._matFrame);
    poleL.position.set(-0.92, 0.35, 0);
    poleL.castShadow = true;

    const poleR = poleL.clone();
    poleR.position.x = 0.92;
    group.add(poleL, poleR);

    this.obstacleGroup.add(group);

    this.activeObstacles.push({
      type: ObstacleType.JUMP_BARRIER,
      mesh: group,
      lane,
      x,
      halfW: 0.95,
      minY: 0.0,
      maxY: 0.68,
      halfD: 0.3,
      box: new THREE.Box3(),
      passed: false
    });
  }

  _spawnSlideBarrier(lane, z) {
    const x = lane * this.laneWidth;
    if (this._pools[ObstacleType.SLIDE_BARRIER].length > 0) {
      const obs = this._pools[ObstacleType.SLIDE_BARRIER].pop();
      obs.lane = lane;
      obs.x = x;
      obs.passed = false;
      obs.mesh.position.set(x, 0, z);
      this.obstacleGroup.add(obs.mesh);
      this.activeObstacles.push(obs);
      return;
    }

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const beam = new THREE.Mesh(this._geoSlideBeam, this._matHazard);
    beam.position.y = 1.7;
    beam.castShadow = true;
    group.add(beam);

    const poleL = new THREE.Mesh(this._geoSlidePole, this._matFrame);
    poleL.position.set(-0.95, 1.0, 0);
    poleL.castShadow = true;

    const poleR = poleL.clone();
    poleR.position.x = 0.95;
    group.add(poleL, poleR);

    this.obstacleGroup.add(group);

    this.activeObstacles.push({
      type: ObstacleType.SLIDE_BARRIER,
      mesh: group,
      lane,
      x,
      halfW: 0.95,
      minY: 1.15,
      maxY: 2.2,
      halfD: 0.3,
      box: new THREE.Box3(),
      passed: false
    });
  }

  _spawnTrainBlocker(lane, z) {
    const x = lane * this.laneWidth;
    if (this._pools[ObstacleType.TRAIN_BLOCKER].length > 0) {
      const obs = this._pools[ObstacleType.TRAIN_BLOCKER].pop();
      obs.lane = lane;
      obs.x = x;
      obs.passed = false;
      obs.mesh.position.set(x, 0, z);
      this.obstacleGroup.add(obs.mesh);
      this.activeObstacles.push(obs);
      return;
    }

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const train = new THREE.Mesh(this._geoTrain, this._matTrain);
    train.position.set(0, 1.3, -2.0);
    train.castShadow = true;
    train.receiveShadow = true;
    group.add(train);

    const lightL = new THREE.Mesh(this._geoTrainLight, this._matTrainLight);
    lightL.position.set(-0.55, 1.1, 0.55);

    const lightR = lightL.clone();
    lightR.position.x = 0.55;
    group.add(lightL, lightR);

    this.obstacleGroup.add(group);

    this.activeObstacles.push({
      type: ObstacleType.TRAIN_BLOCKER,
      mesh: group,
      lane,
      x,
      halfW: 0.95,
      minY: 0.0,
      maxY: 2.8,
      halfD: 2.6,
      box: new THREE.Box3(),
      passed: false
    });
  }

  _spawnCoin(x, y, z) {
    let coin;
    if (this._coinPool.length > 0) {
      coin = this._coinPool.pop();
      coin.x = x;
      coin.y = y;
      coin.collected = false;
      coin.mesh.position.set(x, y, z);
      coin.mesh.rotation.set(0, 0, 0);
    } else {
      const mesh = new THREE.Mesh(this._coinGeo, this._matCoin);
      mesh.position.set(x, y, z);
      coin = {
        mesh,
        x,
        y,
        collected: false
      };
    }
    this.coinGroup.add(coin.mesh);
    this.activeCoins.push(coin);
  }

  _spawnCoinLine(lane, startZ, count = 4, y = 0.5) {
    const x = lane * this.laneWidth;
    for (let i = 0; i < count; i++) {
      this._spawnCoin(x, y, startZ - i * 2.2);
    }
  }

  _spawnCoinArch(lane, zCenter) {
    const x = lane * this.laneWidth;
    const offsets = [-3, -1.5, 0, 1.5, 3];
    const heights = [0.8, 1.6, 2.2, 1.6, 0.8];

    for (let i = 0; i < offsets.length; i++) {
      this._spawnCoin(x, heights[i], zCenter + offsets[i]);
    }
  }

  update(dt, speed, difficulty = 0, runnerHitbox, onHit, onCoinCollected, currentDistance = null) {
    if (currentDistance !== null && currentDistance !== undefined) {
      this.totalDistance = currentDistance;
    } else {
      this.totalDistance += speed * dt;
    }

    // 1. Advance furthest spawn front
    this.furthestZ += speed * dt;
    while (this.furthestZ > -150) {
      const spawnZ = this.furthestZ - this.spawnInterval;
      this.spawnPattern(spawnZ, difficulty);
      this.furthestZ -= this.spawnInterval;
    }

    // 2. Move obstacles and update precise hitboxes
    for (let i = this.activeObstacles.length - 1; i >= 0; i--) {
      const obs = this.activeObstacles[i];
      obs.mesh.position.z += speed * dt;
      const currentZ = obs.mesh.position.z;

      // Dynamic physics for FALLING_HAZARD
      if (obs.type === ObstacleType.FALLING_HAZARD) {
        if (!obs.hasLanded) {
          // Drop trigger distance dynamically scaled with forward speed
          const dropTriggerZ = -Math.max(16, speed * 1.25);

          // Ground warning hologram decal appears ahead of the crate (~1.4s before drop)
          const decalTriggerZ = dropTriggerZ - Math.max(18, speed * 1.4);
          const showDecal = currentZ >= decalTriggerZ;
          if (obs.decal) obs.decal.visible = showDecal;
          if (obs.ring) obs.ring.visible = showDecal;

          // Crate appears in the air shortly before drop (narrow window ~0.65s instead of hanging for 10+ seconds)
          const appearTriggerZ = dropTriggerZ - Math.max(9, speed * 0.65);
          if (currentZ >= appearTriggerZ) {
            obs.crateGroup.visible = true;
          } else {
            obs.crateGroup.visible = false;
          }

          if (currentZ >= dropTriggerZ) {
            obs.dropping = true;
          }
          if (obs.dropping) {
            obs.crateGroup.visible = true;
            obs.fallVelocity += 58.0 * dt; // snappy metallic gravity acceleration
            obs.currentY -= obs.fallVelocity * dt;
            if (obs.currentY <= 0.9) {
              obs.currentY = 0.9;
              obs.hasLanded = true;
              obs.dropping = false;
              if (this.soundFx) this.soundFx.playHazardDrop();
              if (this.onHazardLanded) this.onHazardLanded(obs);
            }
            obs.crateGroup.position.y = obs.currentY;
          }
          // Pulsate ground warning decal
          if (obs.decal && obs.ring && showDecal) {
            const freq = obs.dropping ? 0.025 : 0.008;
            const pulse = 0.4 + 0.5 * Math.sin(Date.now() * freq);
            obs.decal.material.opacity = pulse;
            obs.ring.material.opacity = Math.min(1.0, pulse * 1.15);
          }
          obs.minY = obs.currentY - 0.9;
          obs.maxY = obs.currentY + 0.9;
        } else {
          obs.crateGroup.visible = true;
          if (obs.decal) obs.decal.visible = true;
          if (obs.ring) obs.ring.visible = true;
          // Fade warning decal after impact
          if (obs.decal) obs.decal.material.opacity = Math.max(0.12, obs.decal.material.opacity - dt * 0.6);
          if (obs.ring) obs.ring.material.opacity = Math.max(0.15, obs.ring.material.opacity - dt * 0.6);
          obs.minY = 0.0;
          obs.maxY = 1.8;
        }
      }

      obs.box.min.set(obs.x - obs.halfW, Math.max(0, obs.minY), currentZ - obs.halfD);
      obs.box.max.set(obs.x + obs.halfW, obs.maxY, currentZ + obs.halfD);

      if (!obs.passed && checkObstacleCollision(runnerHitbox, obs)) {
        obs.passed = true;
        if (onHit) onHit(obs);
      }

      if (currentZ > 15) {
        this._recycleObstacle(obs);
        this.activeObstacles.splice(i, 1);
      }
    }

    // 3. Coins (zero-allocation runnerCenter lookup using reusable vector)
    const coinRotSpeed = 4.2;
    const runnerCenter = runnerHitbox.getCenter(this._tempCenter);

    for (let i = this.activeCoins.length - 1; i >= 0; i--) {
      const coin = this.activeCoins[i];
      coin.mesh.position.z += speed * dt;
      coin.mesh.rotation.y += coinRotSpeed * dt;

      if (!coin.collected) {
        const dx = Math.abs(coin.mesh.position.x - runnerCenter.x);
        const dy = Math.abs(coin.mesh.position.y - runnerCenter.y);
        const dz = Math.abs(coin.mesh.position.z - runnerCenter.z);

        if (dx < 0.85 && dy < 1.1 && dz < 1.0) {
          coin.collected = true;
          this._recycleCoin(coin);
          this.activeCoins.splice(i, 1);
          if (this.soundFx) this.soundFx.playCoin();
          if (onCoinCollected) onCoinCollected();
          continue;
        }
      }

      if (coin.mesh.position.z > 15) {
        this._recycleCoin(coin);
        this.activeCoins.splice(i, 1);
      }
    }
  }
}
