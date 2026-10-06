/**
 * HandZoneControl — Stage 3: Hand-only Zone CV 3×3 Grid Control.
 *
 * Thin factory wrapper around GridZoneControl.
 * CV source: 5-point palm centroid (hand only, no face fallback).
 * Vision Worker mode: 'handzone'
 */
import { GridZoneControl } from './GridZoneControl.js';

export class HandZoneControl extends GridZoneControl {
  constructor(visionManager) {
    super(visionManager, {
      mode:      'handzone',
      colKey:    'hzCol',
      rowKey:    'hzRow',
      sourceKey: 'hzSource',
    });
  }
}
