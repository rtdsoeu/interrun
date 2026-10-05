/**
 * HandZoneControl — Stage 3: Hand-only Zone CV 3×3 Grid Control.
 *
 * 3×3 grid where the tracking source is strictly the palm center.
 * If hand is not visible, ducking is released and current lane is preserved.
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
 * Vision Worker mode: 'handzone'
 */
import { GridZoneControl } from './GridZoneControl.js';

export class HandZoneControl extends GridZoneControl {
  constructor(visionManager) {
    super(visionManager, {
      mode: 'handzone',
      colKey: 'hzCol',
      rowKey: 'hzRow',
      sourceKey: 'hzSource'
    });
  }
}
