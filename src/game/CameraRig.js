import * as THREE from 'three';

/**
 * CameraRig — completely stable third-person camera (Subway Surfers style):
 * - Horizon is always strictly locked (camera.up = 0, 1, 0)
 * - No flips, rolls, or disorienting angles
 * - Smooth horizontal lag during lane changes
 * - Soft vertical following (character jumps in frame, camera stays stable)
 * - Safe FOV range of 62°..70°
 * - Subtle positional shake on impact (no camera rotations)
 */
export class CameraRig {
  constructor(camera) {
    this.camera = camera;

    // Base camera coordinates relative to runner
    this.baseHeight = 3.3;
    this.baseDistance = 5.8;
    this.lookHeight = 1.3;
    this.lookDistance = 15.0;

    // Current smoothed camera coordinates
    this.currentX = 0;
    this.currentY = this.baseHeight;

    // FOV
    this.baseFOV = 62;
    this.maxFOV = 70;
    this.currentFOV = 62;

    // Trauma (camera shake)
    this.trauma = 0;

    this.reset();
  }

  addTrauma(amount = 0.35) {
    this.trauma = Math.min(0.6, this.trauma + amount);
  }

  reset(playerPos = new THREE.Vector3(0, 0, 0)) {
    this.currentX = playerPos.x;
    this.currentY = this.baseHeight;
    this.trauma = 0;
    this.currentFOV = this.baseFOV;

    this.camera.position.set(this.currentX, this.currentY, this.baseDistance);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(playerPos.x * 0.6, this.lookHeight, -this.lookDistance);
    this.camera.fov = this.baseFOV;
    this.camera.updateProjectionMatrix();
  }

  update(dt, playerPos, playerXVelocity = 0, speedNorm = 0, isSliding = false) {
    // 1. Smooth horizontal lag (damped following behind runner)
    const xFollowFactor = 1 - Math.exp(-8.5 * dt);
    this.currentX = THREE.MathUtils.lerp(this.currentX, playerPos.x, xFollowFactor);

    // 2. Soft vertical following:
    // Camera reacts to only ~22% of jump height — character ascends visually in frame!
    const slideDrop = isSliding ? -0.3 : 0;
    const targetY = this.baseHeight + Math.max(0, playerPos.y * 0.22) + slideDrop;
    const yFollowFactor = 1 - Math.exp(-6.0 * dt);
    this.currentY = THREE.MathUtils.lerp(this.currentY, targetY, yFollowFactor);

    // 3. Smooth and safe dynamic FOV (strictly 62..70 degrees)
    const targetFOV = THREE.MathUtils.lerp(this.baseFOV, this.maxFOV, THREE.MathUtils.clamp(speedNorm, 0, 1));
    const fovFactor = 1 - Math.exp(-2.0 * dt);
    this.currentFOV = THREE.MathUtils.lerp(this.currentFOV, targetFOV, fovFactor);
    this.camera.fov = THREE.MathUtils.clamp(this.currentFOV, 60, 72);

    // 4. Positional screen shake on impact (translation only, strictly within ±0.15m)
    let shakeX = 0;
    let shakeY = 0;
    if (this.trauma > 0.005) {
      const factor = this.trauma * this.trauma;
      const t = performance.now() * 0.02;
      shakeX = Math.sin(t * 1.7) * 0.12 * factor;
      shakeY = Math.cos(t * 2.1) * 0.12 * factor;

      this.trauma = Math.max(0, this.trauma - dt * 2.5);
    }

    // 5. Apply camera position (Z locked behind runner)
    this.camera.position.set(
      this.currentX + shakeX,
      this.currentY + shakeY,
      this.baseDistance
    );

    // 6. Look target forward along track
    // Up vector is ALWAYS (0, 1, 0) — horizon is 100% stable and never tilts!
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(
      playerPos.x * 0.6,
      this.lookHeight + slideDrop * 0.2,
      -this.lookDistance
    );

    this.camera.updateProjectionMatrix();
  }
}
