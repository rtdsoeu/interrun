import * as THREE from 'three';

export const PlayerState = {
  RUNNING: 'running',
  JUMPING: 'jumping',
  SLIDING: 'sliding',
  CRASHED: 'crashed'
};

/**
 * Runner — player character with 3 lanes of movement, jump and duck physics,
 * procedural animated body, and skin switching support.
 */
export class Runner {
  constructor(scene, soundFx) {
    this.scene = scene;
    this.soundFx = soundFx;

    this.laneWidth = 2.4;
    this.currentLane = 0; // -1 (left), 0 (center), 1 (right)
    this.targetX = 0;

    this.pos = new THREE.Vector3(0, 0, 0);
    this.prevX = 0;
    this.xVelocity = 0;

    // Jump physics
    this.yVelocity = 0;
    this.jumpSpeed = 11.5;
    this.gravity = 28.0;

    // Slide (duck) physics
    this.slideTimer = 0;
    this.slideDuration = 0.75;

    // Micro-cooldowns between states
    this.actionDelay = 0.18; // ~180 ms between consecutive jumps / slides
    this.jumpCooldown = 0;
    this.slideCooldown = 0;

    this.state = PlayerState.RUNNING;
    this.runCycleTime = 0;

    // Collision dimensions
    this.normalHeight = 1.8;
    this.slideHeight = 0.75;
    this.width = 0.8;
    this.hitbox = new THREE.Box3();

    // Create character 3D model
    this.meshGroup = new THREE.Group();
    this.scene.add(this.meshGroup);

    this._materials = {};
    this._parts = {};
    this._buildProceduralCharacter();

    // Footwear trail / glow effect
    this._buildTrailEffect();
  }

  _buildProceduralCharacter() {
    // Base materials
    this._materials.body = new THREE.MeshStandardMaterial({
      color: 0x182030,
      roughness: 0.4,
      metalness: 0.3
    });
    this._materials.accent = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      roughness: 0.2,
      emissive: 0x00aacc,
      emissiveIntensity: 0.35
    });
    this._materials.visor = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      roughness: 0.1,
      emissive: 0x00ffff,
      emissiveIntensity: 0.8
    });
    this._materials.shoes = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      roughness: 0.3,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.4
    });
    this._materials.limbs = new THREE.MeshStandardMaterial({
      color: 0x121724,
      roughness: 0.6
    });

    // 1. Torso
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.65, 0.32);
    const torso = new THREE.Mesh(torsoGeo, this._materials.body);
    torso.position.y = 1.15;
    torso.castShadow = true;
    this.meshGroup.add(torso);
    this._parts.torso = torso;

    // Accent neon stripes on torso
    const stripeGeo = new THREE.BoxGeometry(0.57, 0.1, 0.34);
    const stripe = new THREE.Mesh(stripeGeo, this._materials.accent);
    torso.add(stripe);

    // Backpack / jetpack
    const packGeo = new THREE.BoxGeometry(0.38, 0.45, 0.18);
    const pack = new THREE.Mesh(packGeo, this._materials.limbs);
    pack.position.set(0, 0.05, 0.24);
    pack.castShadow = true;
    torso.add(pack);

    // Backpack neon thrusters
    const thrusterGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.12, 12);
    const thrusterL = new THREE.Mesh(thrusterGeo, this._materials.accent);
    thrusterL.position.set(-0.12, -0.22, 0.24);
    thrusterL.rotation.x = Math.PI;
    torso.add(thrusterL);

    const thrusterR = thrusterL.clone();
    thrusterR.position.x = 0.12;
    torso.add(thrusterR);

    // 2. Head
    const headGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    const head = new THREE.Mesh(headGeo, this._materials.body);
    head.position.y = 1.68;
    head.castShadow = true;
    this.meshGroup.add(head);
    this._parts.head = head;

    // Visor / helmet
    const visorGeo = new THREE.BoxGeometry(0.38, 0.12, 0.2);
    const visor = new THREE.Mesh(visorGeo, this._materials.visor);
    visor.position.set(0, 0.02, -0.12);
    head.add(visor);

    // Cap / headphones
    const capGeo = new THREE.BoxGeometry(0.4, 0.08, 0.42);
    const cap = new THREE.Mesh(capGeo, this._materials.accent);
    cap.position.y = 0.18;
    head.add(cap);

    // 3. Arms (shoulder joints)
    const armGeo = new THREE.BoxGeometry(0.14, 0.55, 0.14);

    const shoulderL = new THREE.Group();
    shoulderL.position.set(-0.36, 1.4, 0);
    const armL = new THREE.Mesh(armGeo, this._materials.limbs);
    armL.position.y = -0.25;
    armL.castShadow = true;
    shoulderL.add(armL);
    this.meshGroup.add(shoulderL);
    this._parts.shoulderL = shoulderL;

    const shoulderR = new THREE.Group();
    shoulderR.position.set(0.36, 1.4, 0);
    const armR = new THREE.Mesh(armGeo, this._materials.limbs);
    armR.position.y = -0.25;
    armR.castShadow = true;
    shoulderR.add(armR);
    this.meshGroup.add(shoulderR);
    this._parts.shoulderR = shoulderR;

    // 4. Legs (hip joints)
    const legGeo = new THREE.BoxGeometry(0.18, 0.6, 0.18);
    const shoeGeo = new THREE.BoxGeometry(0.2, 0.12, 0.32);

    const hipL = new THREE.Group();
    hipL.position.set(-0.16, 0.8, 0);
    const legL = new THREE.Mesh(legGeo, this._materials.limbs);
    legL.position.y = -0.3;
    legL.castShadow = true;
    hipL.add(legL);

    const shoeL = new THREE.Mesh(shoeGeo, this._materials.shoes);
    shoeL.position.set(0, -0.55, -0.05);
    shoeL.castShadow = true;
    hipL.add(shoeL);

    this.meshGroup.add(hipL);
    this._parts.hipL = hipL;

    const hipR = new THREE.Group();
    hipR.position.set(0.16, 0.8, 0);
    const legR = new THREE.Mesh(legGeo, this._materials.limbs);
    legR.position.y = -0.3;
    legR.castShadow = true;
    hipR.add(legR);

    const shoeR = new THREE.Mesh(shoeGeo, this._materials.shoes);
    shoeR.position.set(0, -0.55, -0.05);
    shoeR.castShadow = true;
    hipR.add(shoeR);

    this.meshGroup.add(hipR);
    this._parts.hipR = hipR;

    // Drop shadow under character (decorative blob)
    const shadowGeo = new THREE.PlaneGeometry(0.9, 1.3);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    const groundShadow = new THREE.Mesh(shadowGeo, shadowMat);
    groundShadow.rotation.x = -Math.PI / 2;
    groundShadow.position.y = 0.02;
    this.meshGroup.add(groundShadow);
    this._parts.groundShadow = groundShadow;
  }

  _buildTrailEffect() {
    // Neon trail particles behind character
    const count = 24;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x00e5ff,
      size: 0.12,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });
    this._trailParticles = new THREE.Points(geo, mat);
    this.scene.add(this._trailParticles);

    this._trailHistory = [];
    for (let i = 0; i < count; i++) {
      this._trailHistory.push({ x: 0, y: 0.1, z: 0 });
    }
  }

  /**
   * Apply character skin
   * @param {Object} skinConfig
   */
  applySkin(skinConfig) {
    if (!skinConfig) return;
    if (this._materials.body) {
      this._materials.body.color.setHex(skinConfig.bodyColor);
    }
    if (this._materials.accent) {
      this._materials.accent.color.setHex(skinConfig.accentColor);
      this._materials.accent.emissive.setHex(skinConfig.accentColor);
    }
    if (this._materials.visor) {
      this._materials.visor.color.setHex(skinConfig.visorColor);
      this._materials.visor.emissive.setHex(skinConfig.visorColor);
    }
    if (this._materials.shoes) {
      this._materials.shoes.color.setHex(skinConfig.shoesColor);
      this._materials.shoes.emissive.setHex(skinConfig.shoesColor);
    }
    if (this._trailParticles) {
      this._trailParticles.material.color.setHex(skinConfig.trailColor || skinConfig.accentColor);
    }
  }

  reset() {
    this.currentLane = 0;
    this.targetX = 0;
    this.pos.set(0, 0, 0);
    this.prevX = 0;
    this.xVelocity = 0;
    this.yVelocity = 0;
    this.slideTimer = 0;
    this.jumpCooldown = 0;
    this.slideCooldown = 0;
    this.runCycleTime = 0;
    this.state = PlayerState.RUNNING;
    this.meshGroup.position.set(0, 0, 0);
    this.meshGroup.rotation.set(0, 0, 0);
    this.meshGroup.scale.set(1, 1, 1);

    if (this._parts.torso) {
      this._parts.torso.position.y = 1.15;
      this._parts.torso.rotation.x = 0.1;
      this._parts.head.position.y = 1.68;
      this._parts.head.rotation.x = 0;
      this._parts.shoulderL.position.y = 1.4;
      this._parts.shoulderL.rotation.x = 0;
      this._parts.shoulderR.position.y = 1.4;
      this._parts.shoulderR.rotation.x = 0;
      this._parts.hipL.position.y = 0.8;
      this._parts.hipL.rotation.x = 0;
      this._parts.hipR.position.y = 0.8;
      this._parts.hipR.rotation.x = 0;
    }
  }

  /**
   * Handle control input commands
   * @param {{ laneDelta: number, jump: boolean, slide: boolean, targetLane?: number, isDucking?: boolean }} input
   */
  handleInput(input) {
    if (this.state === PlayerState.CRASHED) return;

    // Lane switching (absolute target lane targetLane or relative delta laneDelta)
    if (input.targetLane !== undefined && input.targetLane !== null) {
      const nextLane = THREE.MathUtils.clamp(input.targetLane, -1, 1);
      if (nextLane !== this.currentLane) {
        this.currentLane = nextLane;
        this.targetX = this.currentLane * this.laneWidth;
        if (this.soundFx) this.soundFx.playLaneSwitch();
      }
    } else if (input.laneDelta !== 0) {
      const nextLane = THREE.MathUtils.clamp(this.currentLane + input.laneDelta, -1, 1);
      if (nextLane !== this.currentLane) {
        this.currentLane = nextLane;
        this.targetX = this.currentLane * this.laneWidth;
        if (this.soundFx) this.soundFx.playLaneSwitch();
      }
    }

    // Duck / slide
    const wantsDuck = Boolean(input.isDucking || input.slide);
    if (wantsDuck) {
      if (this.state === PlayerState.JUMPING) {
        // Fast drop down when pressing "down" during jump
        this.yVelocity = -this.jumpSpeed * 1.5;
        this.slideTimer = this.slideDuration;
        if (this.soundFx) this.soundFx.playSlide();
      } else if (this.state === PlayerState.RUNNING && this.slideCooldown <= 0) {
        this.state = PlayerState.SLIDING;
        this.slideTimer = this.slideDuration;
        if (this.soundFx) this.soundFx.playSlide();
      }
    }

    // Jump
    if (input.jump && this.jumpCooldown <= 0) {
      if (this.state === PlayerState.RUNNING || this.state === PlayerState.SLIDING) {
        if (this.state === PlayerState.SLIDING) {
          this.slideCooldown = this.actionDelay;
        }
        this.state = PlayerState.JUMPING;
        this.yVelocity = this.jumpSpeed;
        this.slideTimer = 0;
        if (this.soundFx) this.soundFx.playJump();
      }
    }
  }

  crash() {
    this.state = PlayerState.CRASHED;
    if (this.soundFx) this.soundFx.playCrash();
  }

  update(dt, currentSpeed) {
    this.prevX = this.pos.x;

    // Micro-delay cooldown timers between identical states
    if (this.jumpCooldown > 0) {
      this.jumpCooldown -= dt;
    }
    if (this.slideCooldown > 0) {
      this.slideCooldown -= dt;
    }

    // 1. Horizontal lane transition (snappy spring lerp)
    const laneLerpSpeed = 16.0;
    this.pos.x = THREE.MathUtils.lerp(this.pos.x, this.targetX, 1 - Math.exp(-laneLerpSpeed * dt));
    this.xVelocity = dt > 0 ? (this.pos.x - this.prevX) / dt : 0;

    // 2. Vertical physics (gravity and jump)
    if (this.state === PlayerState.JUMPING) {
      this.pos.y += this.yVelocity * dt;
      this.yVelocity -= this.gravity * dt;

      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.yVelocity = 0;
        this.state = this.slideTimer > 0 ? PlayerState.SLIDING : PlayerState.RUNNING;
        this.jumpCooldown = this.actionDelay;
      }
    }

    // 3. Slide timer
    if (this.state === PlayerState.SLIDING) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.slideTimer = 0;
        if (this.pos.y <= 0) {
          this.state = PlayerState.RUNNING;
          this.slideCooldown = this.actionDelay;
        }
      }
    }

    // Apply coordinates to 3D mesh group
    this.meshGroup.position.copy(this.pos);

    // 4. Procedural character animation
    this._animateCharacter(dt, currentSpeed);

    // 5. Update collision hitbox
    this._updateHitbox();

    // 6. Update particle trail
    this._updateTrail(dt);
  }

  _animateCharacter(dt, speed) {
    if (this.state === PlayerState.CRASHED) {
      // Crash knockdown animation
      this.meshGroup.rotation.x = THREE.MathUtils.lerp(this.meshGroup.rotation.x, -Math.PI * 0.45, 10 * dt);
      this.meshGroup.rotation.z = THREE.MathUtils.lerp(this.meshGroup.rotation.z, 0.4, 10 * dt);
      this.meshGroup.position.y = THREE.MathUtils.lerp(this.meshGroup.position.y, 0.2, 10 * dt);
      return;
    }

    // Character banking tilt during lane switches
    const targetTilt = -THREE.MathUtils.clamp(this.xVelocity * 0.05, -0.3, 0.3);
    this.meshGroup.rotation.z = THREE.MathUtils.lerp(this.meshGroup.rotation.z, targetTilt, 14 * dt);

    if (this.state === PlayerState.SLIDING) {
      // Slide posture: character ducks close to ground, leans backward
      this._parts.torso.position.y = 0.55;
      this._parts.torso.rotation.x = -0.55;
      this._parts.head.position.y = 0.85;
      this._parts.head.rotation.x = -0.2;

      this._parts.shoulderL.position.y = 0.7;
      this._parts.shoulderL.rotation.x = 0.9;
      this._parts.shoulderR.position.y = 0.7;
      this._parts.shoulderR.rotation.x = 0.9;

      this._parts.hipL.position.y = 0.35;
      this._parts.hipL.rotation.x = -1.2;
      this._parts.hipR.position.y = 0.35;
      this._parts.hipR.rotation.x = -1.0;

      this._parts.groundShadow.scale.set(1.4, 0.8, 1);
      return;
    }

    // Reset base heights of body parts
    this._parts.torso.position.y = 1.15;
    this._parts.torso.rotation.x = 0.1;
    this._parts.head.position.y = 1.68;
    this._parts.head.rotation.x = 0;
    this._parts.shoulderL.position.y = 1.4;
    this._parts.shoulderR.position.y = 1.4;
    this._parts.hipL.position.y = 0.8;
    this._parts.hipR.position.y = 0.8;

    if (this.state === PlayerState.JUMPING) {
      // Jump posture: legs tucked, arms spread for balance
      this._parts.hipL.rotation.x = THREE.MathUtils.lerp(this._parts.hipL.rotation.x, -0.5, 12 * dt);
      this._parts.hipR.rotation.x = THREE.MathUtils.lerp(this._parts.hipR.rotation.x, 0.4, 12 * dt);
      this._parts.shoulderL.rotation.x = THREE.MathUtils.lerp(this._parts.shoulderL.rotation.x, -0.9, 12 * dt);
      this._parts.shoulderR.rotation.x = THREE.MathUtils.lerp(this._parts.shoulderR.rotation.x, -0.9, 12 * dt);

      // Shadow shrinks as player jumps higher
      const shadowScale = Math.max(0.3, 1 - this.pos.y * 0.25);
      this._parts.groundShadow.scale.set(shadowScale, shadowScale, 1);
      this._parts.groundShadow.material.opacity = 0.45 * shadowScale;
      return;
    }

    // Normal run: arm and leg stride swinging
    const runFreq = speed * 1.1; // step frequency proportional to speed
    this.runCycleTime += dt * runFreq;

    const legSwing = Math.sin(this.runCycleTime) * 0.75;
    const armSwing = Math.sin(this.runCycleTime) * 0.75;

    // Opposite phase for arms and legs
    this._parts.hipL.rotation.x = legSwing;
    this._parts.hipR.rotation.x = -legSwing;
    this._parts.shoulderL.rotation.x = -armSwing;
    this._parts.shoulderR.rotation.x = armSwing;

    // Head bobbing while running
    const bob = Math.abs(Math.sin(this.runCycleTime)) * 0.08;
    this._parts.torso.position.y = 1.15 + bob;
    this._parts.head.position.y = 1.68 + bob;

    this._parts.groundShadow.scale.set(1, 1, 1);
    this._parts.groundShadow.material.opacity = 0.45;
  }

  _updateHitbox() {
    const isSlide = this.state === PlayerState.SLIDING;
    const currentH = isSlide ? this.slideHeight : this.normalHeight;

    const halfW = this.width * 0.45;
    const halfD = 0.4;

    this.hitbox.min.set(
      this.pos.x - halfW,
      this.pos.y,
      this.pos.z - halfD
    );
    this.hitbox.max.set(
      this.pos.x + halfW,
      this.pos.y + currentH,
      this.pos.z + halfD
    );
  }

  _updateTrail(dt) {
    if (!this._trailParticles) return;

    // Shift point history backwards
    for (let i = this._trailHistory.length - 1; i > 0; i--) {
      const curr = this._trailHistory[i];
      const prev = this._trailHistory[i - 1];
      curr.x = prev.x;
      curr.y = prev.y;
      curr.z = prev.z + 0.3; // move backwards
    }

    // New point at heels (zero-allocation in-place mutation)
    const p0 = this._trailHistory[0];
    p0.x = this.pos.x + (Math.random() - 0.5) * 0.2;
    p0.y = this.pos.y + 0.1;
    p0.z = this.pos.z + 0.2;

    const posAttr = this._trailParticles.geometry.attributes.position;
    for (let i = 0; i < this._trailHistory.length; i++) {
      posAttr.setXYZ(i, this._trailHistory[i].x, this._trailHistory[i].y, this._trailHistory[i].z);
    }
    posAttr.needsUpdate = true;
  }

  /**
   * Extension point for external glTF 3D model
   * @param {THREE.Group} modelMesh
   * @param {THREE.AnimationAction[]} [actions]
   */
  replaceWithModel(modelMesh, actions = []) {
    this.scene.remove(this.meshGroup);
    this.meshGroup = modelMesh;
    this.scene.add(this.meshGroup);
    this.customActions = actions;
  }
}
