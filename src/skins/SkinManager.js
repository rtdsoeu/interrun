import * as THREE from 'three';

/**
 * SkinManager — central registry of character skins, scene themes, and obstacles.
 * Supports:
 * - Procedural models (work immediately without external files)
 * - External glTF (.glb) character/object models
 * - Built-in scene themes (City/Metro, Sunset Canyon, Neon Forest)
 * - Obstacle and collectible coin styling
 */
export class SkinManager {
  constructor() {
    this.currentThemeId = 'cyber_metro';
    this.currentCharSkinId = 'cyber_neon';

    // Skin change listeners
    this._listeners = [];

    // Scene theme definitions
    this.themes = {
      cyber_metro: {
        id: 'cyber_metro',
        name: 'Cyber Metro (City)',
        fogColor: 0x070b19,
        fogNear: 25,
        fogFar: 140,
        skyColor: 0x050814,
        groundColor: 0x121526,
        railColor: 0x00e5ff,
        sleeperColor: 0x1f2438,
        ambientLight: 0x334466,
        directionalLight: 0x88ccff,
        sideType: 'buildings', // city high-rises and billboards
        neonPalette: [0x00e5ff, 0xff007f, 0x7928ca, 0x00ff88]
      },
      sunset_canyon: {
        id: 'sunset_canyon',
        name: 'Sunset Canyon',
        fogColor: 0x2b1016,
        fogNear: 30,
        fogFar: 150,
        skyColor: 0x3a141d,
        groundColor: 0x381e18,
        railColor: 0xffaa44,
        sleeperColor: 0x5a3122,
        ambientLight: 0x663322,
        directionalLight: 0xff8844,
        sideType: 'canyons', // cliffs and canyons
        neonPalette: [0xff7700, 0xffbb33, 0xff3344, 0xffdd88]
      },
      neon_forest: {
        id: 'neon_forest',
        name: 'Neon Forest',
        fogColor: 0x051410,
        fogNear: 25,
        fogFar: 130,
        skyColor: 0x040e0c,
        groundColor: 0x0d241a,
        railColor: 0x00ff88,
        sleeperColor: 0x123626,
        ambientLight: 0x114433,
        directionalLight: 0x44ffaa,
        sideType: 'forest', // bioluminescent trees
        neonPalette: [0x00ff88, 0x00e5ff, 0x88ff00, 0x00ffa3]
      }
    };

    // Character skin definitions
    this.characterSkins = {
      cyber_neon: {
        id: 'cyber_neon',
        name: 'Neon Runner',
        bodyColor: 0x182030,
        accentColor: 0x00e5ff,
        visorColor: 0x00ffff,
        gloveColor: 0x223355,
        shoesColor: 0x00e5ff,
        trailColor: 0x00e5ff
      },
      subway_graffiti: {
        id: 'subway_graffiti',
        name: 'Subway Graffiti',
        bodyColor: 0xff6b35,
        accentColor: 0xffd23f,
        visorColor: 0x333333, // cap visor
        gloveColor: 0x111111,
        shoesColor: 0xffffff,
        trailColor: 0xff6b35
      },
      shadow_shinobi: {
        id: 'shadow_shinobi',
        name: 'Shadow Shinobi',
        bodyColor: 0x111116,
        accentColor: 0xff2a5f,
        visorColor: 0xff1744, // glowing mask
        gloveColor: 0x22222a,
        shoesColor: 0x331122,
        trailColor: 0xff2a5f
      }
    };
  }

  get activeTheme() {
    return this.themes[this.currentThemeId] || this.themes.cyber_metro;
  }

  get activeCharSkin() {
    return this.characterSkins[this.currentCharSkinId] || this.characterSkins.cyber_neon;
  }

  setTheme(themeId) {
    if (!this.themes[themeId]) return;
    this.currentThemeId = themeId;
    this._notify('theme', this.activeTheme);
  }

  setCharacterSkin(skinId) {
    if (!this.characterSkins[skinId]) return;
    this.currentCharSkinId = skinId;
    this._notify('character', this.activeCharSkin);
  }

  onChange(cb) {
    this._listeners.push(cb);
  }

  _notify(type, data) {
    this._listeners.forEach(cb => cb(type, data));
  }
}
