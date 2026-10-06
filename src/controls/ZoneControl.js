/**
 * ZoneControl — Stage 2: Face Zone CV 3×3 Grid Control.
 *
 * Thin factory wrapper around GridZoneControl.
 * CV source: face nose-tip landmark.
 * Vision Worker mode: 'zone'
 */
import { GridZoneControl } from './GridZoneControl.js';

export class ZoneControl extends GridZoneControl {
  constructor(visionManager) {
    super(visionManager, {
      mode:      'zone',
      colKey:    'zoneCol',
      rowKey:    'zoneRow',
      sourceKey: 'zoneSource',
    });
  }
}
