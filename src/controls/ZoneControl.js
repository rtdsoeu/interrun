/**
 * ZoneControl — Stage 2: Face Zone CV 3×3 Grid Control (Face Only).
 *
 * Camera frame is divided into a 3×3 grid.
 * Head / nose position in cell maps to action:
 *
 *  ┌──────┬──────┬──────┐
 *  │  J←  │  J↑  │  J→  │  ← top: jump
 *  ├──────┼──────┼──────┤
 *  │  ←   │ IDLE │  →   │  ← mid: lane change
 *  ├──────┼──────┼──────┤
 *  │  S←  │  S↓  │  S→  │  ← bot: duck / slide
 *  └──────┴──────┴──────┘
 *    L       C       R
 *
 * Tracking source: FACE ONLY (nose landmark with 3×3 grid hysteresis).
 */
import { GridZoneControl } from './GridZoneControl.js';

export class ZoneControl extends GridZoneControl {
  constructor(visionManager) {
    super(visionManager, {
      mode: 'zone',
      colKey: 'zoneCol',
      rowKey: 'zoneRow',
      sourceKey: 'zoneSource'
    });
  }
}
