import { describe, it, expect } from 'vitest';
import { processFingerGesture, dist3D } from '../src/vision/processors/FingerGestureProcessor.js';

describe('FingerGestureProcessor (Orientation & Hand Facing Invariance)', () => {
  const baseState = () => ({
    fgGesture: null,
    fgSource: null,
    debugText: '',
    points: [],
    gestureConfidences: {}
  });

  /**
   * Helper to construct a realistic 21-point hand skeleton in 3D.
   * @param {Object} config
   * @param {boolean} [config.isBackOfHand=false] If true, hand is facing with dorsum towards camera
   * @param {boolean} [config.index=false]
   * @param {boolean} [config.middle=false]
   * @param {boolean} [config.ring=false]
   * @param {boolean} [config.pinky=false]
   * @param {boolean} [config.thumb=false]
   */
  function createHandModel({ isBackOfHand = false, index = false, middle = false, ring = false, pinky = false, thumb = false } = {}) {
    // Coordinate frame: x [0..1] left-to-right, y [0..1] top-to-bottom, z depth
    // Wrist at bottom center
    const zSign = isBackOfHand ? -1 : 1;
    const hand = new Array(21);

    hand[0] = { x: 0.50, y: 0.80, z: 0.00 }; // Wrist

    // Helper to generate finger joints (MCP, PIP, DIP, TIP)
    const buildFinger = (mcpIdx, baseX, isExtended) => {
      const mcp = { x: baseX, y: 0.55, z: 0.02 * zSign };
      let pip, dip, tip;

      if (isExtended) {
        // Finger pointing straight up in y
        pip = { x: baseX, y: 0.42, z: 0.01 * zSign };
        dip = { x: baseX, y: 0.32, z: 0.00 };
        tip = { x: baseX, y: 0.22, z: -0.01 * zSign };
      } else {
        // Finger curled: folds inward towards palm
        pip = { x: baseX, y: 0.58, z: 0.06 * zSign };
        dip = { x: baseX, y: 0.62, z: 0.04 * zSign };
        tip = { x: baseX, y: 0.57, z: 0.02 * zSign };
      }

      hand[mcpIdx]     = mcp;
      hand[mcpIdx + 1] = pip;
      hand[mcpIdx + 2] = dip;
      hand[mcpIdx + 3] = tip;
    };

    // Thumb (joints 1, 2, 3, 4)
    hand[1] = { x: 0.46, y: 0.72, z: 0.01 * zSign }; // CMC
    hand[2] = { x: 0.42, y: 0.65, z: 0.02 * zSign }; // MCP

    if (thumb) {
      // Thumb spread outward
      hand[3] = { x: 0.32, y: 0.58, z: 0.02 * zSign }; // IP
      hand[4] = { x: 0.24, y: 0.52, z: 0.01 * zSign }; // TIP
    } else {
      // Thumb curled/tucked against palm or fingers
      hand[3] = { x: 0.45, y: 0.60, z: 0.04 * zSign }; // IP
      hand[4] = { x: 0.47, y: 0.56, z: 0.03 * zSign }; // TIP
    }

    // Fingers: Index (5..8), Middle (9..12), Ring (13..16), Pinky (17..20)
    buildFinger(5,  0.44, index);
    buildFinger(9,  0.50, middle);
    buildFinger(13, 0.56, ring);
    buildFinger(17, 0.62, pinky);

    return hand;
  }

  function mockLandmarker(landmarks) {
    return {
      detectForVideo: () => ({ landmarks: [landmarks] })
    };
  }

  describe('Palm-Facing (Front of Hand)', () => {
    it('recognizes 1 Finger (Index) as lane_left', () => {
      const hand = createHandModel({ isBackOfHand: false, index: true });
      const state = processFingerGesture({}, 100, mockLandmarker(hand), baseState);
      expect(state.fgGesture).toBe('lane_left');
    });

    it('recognizes 2 Fingers (Index + Middle) as lane_center', () => {
      const hand = createHandModel({ isBackOfHand: false, index: true, middle: true });
      const state = processFingerGesture({}, 100, mockLandmarker(hand), baseState);
      expect(state.fgGesture).toBe('lane_center');
    });

    it('recognizes 3 Fingers (Index + Middle + Ring) as lane_right', () => {
      const hand = createHandModel({ isBackOfHand: false, index: true, middle: true, ring: true });
      const state = processFingerGesture({}, 100, mockLandmarker(hand), baseState);
      expect(state.fgGesture).toBe('lane_right');
    });

    it('recognizes Open Palm as jump', () => {
      const hand = createHandModel({ isBackOfHand: false, index: true, middle: true, ring: true, pinky: true, thumb: true });
      const state = processFingerGesture({}, 100, mockLandmarker(hand), baseState);
      expect(state.fgGesture).toBe('jump');
    });

    it('recognizes Closed Fist as duck', () => {
      const hand = createHandModel({ isBackOfHand: false });
      const state = processFingerGesture({}, 100, mockLandmarker(hand), baseState);
      expect(state.fgGesture).toBe('duck');
    });
  });

  describe('Back-of-Hand Facing (Dorsum / Reverse Side)', () => {
    it('correctly recognizes 1 Finger (Index) as lane_left when showing back of hand', () => {
      const hand = createHandModel({ isBackOfHand: true, index: true });
      const state = processFingerGesture({}, 100, mockLandmarker(hand), baseState);
      expect(state.fgGesture).toBe('lane_left');
    });

    it('correctly recognizes 2 Fingers (Index + Middle) as lane_center when showing back of hand', () => {
      const hand = createHandModel({ isBackOfHand: true, index: true, middle: true });
      const state = processFingerGesture({}, 100, mockLandmarker(hand), baseState);
      expect(state.fgGesture).toBe('lane_center');
    });

    it('correctly recognizes 3 Fingers (Index + Middle + Ring) as lane_right when showing back of hand', () => {
      const hand = createHandModel({ isBackOfHand: true, index: true, middle: true, ring: true });
      const state = processFingerGesture({}, 100, mockLandmarker(hand), baseState);
      expect(state.fgGesture).toBe('lane_right');
    });

    it('correctly recognizes Open Palm as jump when showing back of hand', () => {
      const hand = createHandModel({ isBackOfHand: true, index: true, middle: true, ring: true, pinky: true, thumb: true });
      const state = processFingerGesture({}, 100, mockLandmarker(hand), baseState);
      expect(state.fgGesture).toBe('jump');
    });

    it('correctly recognizes Closed Fist as duck when showing back of hand', () => {
      const hand = createHandModel({ isBackOfHand: true });
      const state = processFingerGesture({}, 100, mockLandmarker(hand), baseState);
      expect(state.fgGesture).toBe('duck');
    });
  });

  it('calculates 3D Euclidean distance correctly', () => {
    const a = { x: 1, y: 2, z: 3 };
    const b = { x: 4, y: 6, z: 3 };
    expect(dist3D(a, b)).toBe(5);
  });
});
