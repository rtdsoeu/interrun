import * as THREE from 'three';

/**
 * CameraRig — абсолютно стабильная камера третьего лица (Subway Surfers):
 * - Горизонт всегда строго зафиксирован (camera.up = 0, 1, 0)
 * - Никаких переворотов, кренов и калейдоскопов
 * - Плавный лаг по горизонтали при смене полосы
 * - Мягкое отслеживание прыжка (персонаж подпрыгивает в кадре, камера не скачет)
 * - Безопасный FOV в диапазоне 62°..70°
 * - Легкая позиционная тряска при ударе (без вращения камеры)
 */
export class CameraRig {
  constructor(camera) {
    this.camera = camera;

    // Базовые координаты камеры относительно бегуна
    this.baseHeight = 3.3;
    this.baseDistance = 5.8;
    this.lookHeight = 1.3;
    this.lookDistance = 15.0;

    // Текущие сглаженные координаты камеры
    this.currentX = 0;
    this.currentY = this.baseHeight;

    // FOV
    this.baseFOV = 62;
    this.maxFOV = 70;
    this.currentFOV = 62;

    // Травма (тряска)
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
    // 1. Плавный горизонтальный лаг (сглаженное следование за бегуном)
    const xFollowFactor = 1 - Math.exp(-8.5 * dt);
    this.currentX = THREE.MathUtils.lerp(this.currentX, playerPos.x, xFollowFactor);

    // 2. Мягкое вертикальное следование:
    // Камера реагирует только на 22% от высоты прыжка — персонаж взмывает вверх в кадре!
    const slideDrop = isSliding ? -0.3 : 0;
    const targetY = this.baseHeight + Math.max(0, playerPos.y * 0.22) + slideDrop;
    const yFollowFactor = 1 - Math.exp(-6.0 * dt);
    this.currentY = THREE.MathUtils.lerp(this.currentY, targetY, yFollowFactor);

    // 3. Плавный и безопасный динамический FOV (строго 62..70 градусов)
    const targetFOV = THREE.MathUtils.lerp(this.baseFOV, this.maxFOV, THREE.MathUtils.clamp(speedNorm, 0, 1));
    const fovFactor = 1 - Math.exp(-2.0 * dt);
    this.currentFOV = THREE.MathUtils.lerp(this.currentFOV, targetFOV, fovFactor);
    this.camera.fov = THREE.MathUtils.clamp(this.currentFOV, 60, 72);

    // 4. Позиционная тряска экрана при ударе (только координаты, строго в пределах ±0.15м)
    let shakeX = 0;
    let shakeY = 0;
    if (this.trauma > 0.005) {
      const factor = this.trauma * this.trauma;
      const t = performance.now() * 0.02;
      shakeX = Math.sin(t * 1.7) * 0.12 * factor;
      shakeY = Math.cos(t * 2.1) * 0.12 * factor;

      this.trauma = Math.max(0, this.trauma - dt * 2.5);
    }

    // 5. Установка позиции камеры (Z фиксирован сзади бегуна)
    this.camera.position.set(
      this.currentX + shakeX,
      this.currentY + shakeY,
      this.baseDistance
    );

    // 6. Направление взгляда вперед по трассе
    // Вектор up ВСЕГДА (0, 1, 0) — горизонт 100% зафиксирован и никогда не переворачивается!
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(
      playerPos.x * 0.6,
      this.lookHeight + slideDrop * 0.2,
      -this.lookDistance
    );

    this.camera.updateProjectionMatrix();
  }
}
