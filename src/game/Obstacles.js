import * as THREE from 'three';

export const ObstacleType = {
  JUMP_BARRIER: 'jump_barrier',   // low barrier — must jump over
  SLIDE_BARRIER: 'slide_barrier', // high barrier — must slide underneath
  TRAIN_BLOCKER: 'train_blocker', // train car / solid obstacle — must switch lanes
  COIN: 'coin'
};

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

    this.spawnInterval = 30; // distance between rows
    this.furthestZ = -180;
    this.isTransitioning = false;

    this._initMaterials();

    // Coin geometry
    this._coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16);
    this._coinGeo.rotateZ(Math.PI / 2);
  }

  setTransitioning(isTrans) {
    this.isTransitioning = isTrans;
    if (isTrans) {
      // Clear hazardous obstacles right ahead of the runner (-60m to +10m) for a clean runway
      for (let i = this.activeObstacles.length - 1; i >= 0; i--) {
        const obs = this.activeObstacles[i];
        if (obs.mesh.position.z >= -60 && obs.mesh.position.z <= 10) {
          this.obstacleGroup.remove(obs.mesh);
          this.activeObstacles.splice(i, 1);
        }
      }
    }
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
    }
  }

  reset() {
    while (this.obstacleGroup.children.length > 0) {
      this.obstacleGroup.remove(this.obstacleGroup.children[0]);
    }
    while (this.coinGroup.children.length > 0) {
      this.coinGroup.remove(this.coinGroup.children[0]);
    }
    this.activeObstacles = [];
    this.activeCoins = [];

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

    const count = (difficulty > 0.35 && Math.random() > 0.4) ? 2 : 1;

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

  _spawnJumpBarrier(lane, z) {
    const group = new THREE.Group();
    const x = lane * this.laneWidth;
    group.position.set(x, 0, z);

    const barGeo = new THREE.BoxGeometry(2.0, 0.26, 0.2);
    const bar = new THREE.Mesh(barGeo, this._matHazard);
    bar.position.y = 0.55;
    bar.castShadow = true;
    group.add(bar);

    const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.7, 8);
    const poleL = new THREE.Mesh(poleGeo, this._matFrame);
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
    const group = new THREE.Group();
    const x = lane * this.laneWidth;
    group.position.set(x, 0, z);

    const beamGeo = new THREE.BoxGeometry(2.1, 0.6, 0.3);
    const beam = new THREE.Mesh(beamGeo, this._matHazard);
    beam.position.y = 1.7;
    beam.castShadow = true;
    group.add(beam);

    const poleGeo = new THREE.BoxGeometry(0.1, 2.0, 0.1);
    const poleL = new THREE.Mesh(poleGeo, this._matFrame);
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
    const group = new THREE.Group();
    const x = lane * this.laneWidth;
    group.position.set(x, 0, z);

    const trainGeo = new THREE.BoxGeometry(2.0, 2.6, 5.0);
    const train = new THREE.Mesh(trainGeo, this._matTrain);
    train.position.set(0, 1.3, -2.0);
    train.castShadow = true;
    train.receiveShadow = true;
    group.add(train);

    const lightGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const lightL = new THREE.Mesh(lightGeo, this._matTrainLight);
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

  _spawnCoinLine(lane, startZ, count = 4, y = 0.5) {
    const x = lane * this.laneWidth;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this._coinGeo, this._matCoin);
      mesh.position.set(x, y, startZ - i * 2.2);
      this.coinGroup.add(mesh);

      this.activeCoins.push({
        mesh,
        x,
        y,
        collected: false
      });
    }
  }

  _spawnCoinArch(lane, zCenter) {
    const x = lane * this.laneWidth;
    const offsets = [-3, -1.5, 0, 1.5, 3];
    const heights = [0.8, 1.6, 2.2, 1.6, 0.8];

    for (let i = 0; i < offsets.length; i++) {
      const mesh = new THREE.Mesh(this._coinGeo, this._matCoin);
      mesh.position.set(x, heights[i], zCenter + offsets[i]);
      this.coinGroup.add(mesh);

      this.activeCoins.push({
        mesh,
        x,
        y: heights[i],
        collected: false
      });
    }
  }

  update(dt, speed, difficulty = 0, runnerHitbox, onHit, onCoinCollected) {
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

      obs.box.min.set(obs.x - obs.halfW, obs.minY, currentZ - obs.halfD);
      obs.box.max.set(obs.x + obs.halfW, obs.maxY, currentZ + obs.halfD);

      if (!obs.passed && runnerHitbox.intersectsBox(obs.box)) {
        let isHit = true;

        if (obs.type === ObstacleType.SLIDE_BARRIER && runnerHitbox.max.y < obs.minY + 0.1) {
          isHit = false;
        }

        if (obs.type === ObstacleType.JUMP_BARRIER && runnerHitbox.min.y > obs.maxY - 0.1) {
          isHit = false;
        }

        if (isHit) {
          obs.passed = true;
          if (onHit) onHit(obs);
        }
      }

      if (currentZ > 15) {
        this.obstacleGroup.remove(obs.mesh);
        this.activeObstacles.splice(i, 1);
      }
    }

    // 3. Coins
    const coinRotSpeed = 4.2;
    const runnerCenter = runnerHitbox.getCenter(new THREE.Vector3());

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
          this.coinGroup.remove(coin.mesh);
          this.activeCoins.splice(i, 1);
          if (this.soundFx) this.soundFx.playCoin();
          if (onCoinCollected) onCoinCollected();
          continue;
        }
      }

      if (coin.mesh.position.z > 15) {
        this.coinGroup.remove(coin.mesh);
        this.activeCoins.splice(i, 1);
      }
    }
  }
}
