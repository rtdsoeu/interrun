import * as THREE from 'three';

/**
 * Track — endless track chunking system with 3 lanes,
 * dynamic scenery (cities / canyons / forest), and theme support.
 */
export class Track {
  constructor(scene, skinManager) {
    this.scene = scene;
    this.skinManager = skinManager;

    this.chunkLength = 30;
    this.chunkCount = 8; // 8 * 30 = 240 units of forward track
    this.laneWidth = 2.4;
    this.trackWidth = this.laneWidth * 3 + 1.2;

    this.chunks = [];
    this.trackGroup = new THREE.Group();
    this.scene.add(this.trackGroup);

    // Materials re-instantiated on theme change
    this._materials = {};
    this._initMaterials();

    // Create initial chunks
    for (let i = 0; i < this.chunkCount; i++) {
      const zPos = -i * this.chunkLength + 15;
      const chunk = this._createChunk(zPos);
      this.chunks.push(chunk);
      this.trackGroup.add(chunk);
    }
  }

  _initMaterials() {
    const theme = this.skinManager.activeTheme;

    this._materials.ground = new THREE.MeshStandardMaterial({
      color: theme.groundColor,
      roughness: 0.85,
      metalness: 0.15
    });

    this._materials.rail = new THREE.MeshStandardMaterial({
      color: theme.railColor,
      roughness: 0.25,
      metalness: 0.75,
      emissive: theme.railColor,
      emissiveIntensity: 0.4
    });

    this._materials.sleeper = new THREE.MeshStandardMaterial({
      color: theme.sleeperColor,
      roughness: 0.9
    });

    this._materials.building = new THREE.MeshStandardMaterial({
      color: 0x090d18,
      roughness: 0.7,
      metalness: 0.3
    });

    this._materials.window = new THREE.MeshBasicMaterial({
      color: 0x00e5ff
    });

    this._materials.barrier = new THREE.MeshStandardMaterial({
      color: 0x1f2638,
      roughness: 0.5
    });
  }

  _createChunk(zPos) {
    const chunk = new THREE.Group();
    chunk.position.z = zPos;

    // 1. Road surface
    const roadGeo = new THREE.BoxGeometry(this.trackWidth, 0.4, this.chunkLength);
    const road = new THREE.Mesh(roadGeo, this._materials.ground);
    road.position.y = -0.2;
    road.receiveShadow = true;
    chunk.add(road);

    // 2. Rails / neon dividers for 3 lanes
    // 4 lines (left edge, between 1 and 2, between 2 and 3, right edge)
    const railGeo = new THREE.BoxGeometry(0.08, 0.08, this.chunkLength);
    const laneOffsets = [
      -this.laneWidth * 1.5,
      -this.laneWidth * 0.5,
       this.laneWidth * 0.5,
       this.laneWidth * 1.5
    ];

    laneOffsets.forEach(x => {
      const rail = new THREE.Mesh(railGeo, this._materials.rail);
      rail.position.set(x, 0.04, 0);
      chunk.add(rail);
    });

    // 3. Sleepers (cross ties like Subway Surfers railway)
    const sleeperGeo = new THREE.BoxGeometry(this.trackWidth - 0.2, 0.05, 0.35);
    const sleeperStep = 2.5;
    const sleeperCount = Math.floor(this.chunkLength / sleeperStep);

    for (let i = 0; i < sleeperCount; i++) {
      const sleeper = new THREE.Mesh(sleeperGeo, this._materials.sleeper);
      sleeper.position.set(0, 0.01, -this.chunkLength / 2 + i * sleeperStep + 1);
      sleeper.receiveShadow = true;
      chunk.add(sleeper);
    }

    // 4. Side barriers
    const fenceGeo = new THREE.BoxGeometry(0.2, 0.8, this.chunkLength);
    const fenceL = new THREE.Mesh(fenceGeo, this._materials.barrier);
    fenceL.position.set(-this.trackWidth / 2 - 0.1, 0.4, 0);
    fenceL.castShadow = true;
    chunk.add(fenceL);

    const fenceR = fenceL.clone();
    fenceR.position.x = this.trackWidth / 2 + 0.1;
    chunk.add(fenceR);

    // 5. Side scenery (city / canyon / forest)
    const sideDecorGroup = new THREE.Group();
    sideDecorGroup.name = 'sideDecor';
    this._populateSideDecor(sideDecorGroup);
    chunk.add(sideDecorGroup);

    return chunk;
  }

  _populateSideDecor(group) {
    const theme = this.skinManager.activeTheme;

    if (theme.sideType === 'buildings') {
      // City skyscrapers on both sides
      const sideOffsets = [-12, 12];
      sideOffsets.forEach(baseX => {
        for (let i = 0; i < 3; i++) {
          const w = 4 + Math.random() * 4;
          const h = 12 + Math.random() * 22;
          const d = 4 + Math.random() * 4;
          const bGeo = new THREE.BoxGeometry(w, h, d);
          const building = new THREE.Mesh(bGeo, this._materials.building);
          const zOffset = (i - 1) * 9 + (Math.random() - 0.5) * 2;
          const xSign = baseX > 0 ? 1 : -1;
          building.position.set(baseX + xSign * (w / 2), h / 2 - 1, zOffset);
          building.castShadow = true;
          group.add(building);

          // Neon windows on the building
          if (Math.random() > 0.3) {
            const winGeo = new THREE.BoxGeometry(w * 0.9, 0.4, d * 0.9);
            const winMat = new THREE.MeshBasicMaterial({
              color: theme.neonPalette[Math.floor(Math.random() * theme.neonPalette.length)]
            });
            const winBand = new THREE.Mesh(winGeo, winMat);
            winBand.position.set(building.position.x, h * 0.65, zOffset);
            group.add(winBand);
          }
        }
      });

      // Arch traffic light / gantry overhead bridge
      if (Math.random() > 0.5) {
        const archGroup = new THREE.Group();
        const beamGeo = new THREE.BoxGeometry(this.trackWidth + 2, 0.3, 0.3);
        const beam = new THREE.Mesh(beamGeo, this._materials.barrier);
        beam.position.y = 5.2;

        const neonStripe = new THREE.Mesh(
          new THREE.BoxGeometry(this.trackWidth, 0.1, 0.32),
          this._materials.rail
        );
        neonStripe.position.y = 5.2;

        const pillarGeo = new THREE.BoxGeometry(0.3, 5.2, 0.3);
        const pillarL = new THREE.Mesh(pillarGeo, this._materials.barrier);
        pillarL.position.set(-this.trackWidth / 2 - 0.8, 2.6, 0);

        const pillarR = pillarL.clone();
        pillarR.position.x = this.trackWidth / 2 + 0.8;

        archGroup.add(beam, neonStripe, pillarL, pillarR);
        group.add(archGroup);
      }
    } else if (theme.sideType === 'canyons') {
      // Rocky canyons
      [-10, 10].forEach(baseX => {
        for (let i = 0; i < 3; i++) {
          const r = 3 + Math.random() * 4;
          const h = 8 + Math.random() * 16;
          const rockGeo = new THREE.CylinderGeometry(r * 0.6, r, h, 6);
          const rock = new THREE.Mesh(rockGeo, this._materials.ground);
          rock.position.set(baseX, h / 2 - 1, (i - 1) * 9);
          group.add(rock);
        }
      });
    } else if (theme.sideType === 'forest') {
      // Neon forest
      [-8, 8].forEach(baseX => {
        for (let i = 0; i < 4; i++) {
          const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 6, 6);
          const foliageGeo = new THREE.ConeGeometry(2.2, 5, 6);
          const foliageMat = new THREE.MeshStandardMaterial({
            color: theme.neonPalette[Math.floor(Math.random() * theme.neonPalette.length)],
            emissive: theme.neonPalette[0],
            emissiveIntensity: 0.3
          });

          const trunk = new THREE.Mesh(trunkGeo, this._materials.sleeper);
          trunk.position.set(baseX + (Math.random() - 0.5) * 2, 3, (i - 1.5) * 7);

          const foliage = new THREE.Mesh(foliageGeo, foliageMat);
          foliage.position.set(trunk.position.x, 6, trunk.position.z);

          group.add(trunk, foliage);
        }
      });
    }
  }

  applyTheme(theme) {
    if (!theme) return;
    this._materials.ground.color.setHex(theme.groundColor);
    this._materials.rail.color.setHex(theme.railColor);
    this._materials.rail.emissive.setHex(theme.railColor);
    this._materials.sleeper.color.setHex(theme.sleeperColor);

    // Rebuild side scenery in all chunks
    this.chunks.forEach(chunk => {
      const oldDecor = chunk.getObjectByName('sideDecor');
      if (oldDecor) {
        chunk.remove(oldDecor);
      }
      const newDecor = new THREE.Group();
      newDecor.name = 'sideDecor';
      this._populateSideDecor(newDecor);
      chunk.add(newDecor);
    });
  }

  update(dt, speed) {
    const totalSpan = this.chunkLength * this.chunkCount;

    // Move all chunks towards camera (+Z)
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      chunk.position.z += speed * dt;

      // If chunk travelled far behind camera, wrap it to the front
      if (chunk.position.z > 25) {
        // Find minimum (furthest forward) Z
        let minZ = 0;
        for (let j = 0; j < this.chunks.length; j++) {
          if (this.chunks[j].position.z < minZ) {
            minZ = this.chunks[j].position.z;
          }
        }
        chunk.position.z = minZ - this.chunkLength;

        // Regenerate random side decorations
        const oldDecor = chunk.getObjectByName('sideDecor');
        if (oldDecor) chunk.remove(oldDecor);
        const newDecor = new THREE.Group();
        newDecor.name = 'sideDecor';
        this._populateSideDecor(newDecor);
        chunk.add(newDecor);
      }
    }
  }

  reset() {
    for (let i = 0; i < this.chunks.length; i++) {
      this.chunks[i].position.z = -i * this.chunkLength + 15;
    }
  }
}
