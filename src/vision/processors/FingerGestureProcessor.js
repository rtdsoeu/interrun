import { palmCenter } from './ZoneProcessor.js';

export let fgFistFrames = 0;

export function resetFingerCalibration() {
  fgFistFrames = 0;
}

/** 2-D Euclidean distance between two {x,y} landmark points */
export function dist2D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * processFingerGesture (for FingerGestureControl, Stage 4)
 * Finger count + open palm + fist -> game actions.
 */
export function processFingerGesture(bitmap, timestamp, handLandmarker, baseState) {
  const state = baseState();

  if (!handLandmarker) {
    state.debugText = '⏳ Loading hand model...';
    return state;
  }

  const results = handLandmarker.detectForVideo(bitmap, timestamp);

  if (results?.landmarks && results.landmarks.length > 0) {
    const hand  = results.landmarks[0];
    const wrist = hand[0];

    const thumbTip  = hand[4];  const thumbMCP = hand[2];
    const idxTip    = hand[8];  const idxDIP   = hand[7];  const idxPIP   = hand[6];  const idxMCP  = hand[5];
    const midTip    = hand[12]; const midDIP   = hand[11]; const midPIP   = hand[10]; const midMCP  = hand[9];
    const ringTip   = hand[16]; const ringDIP  = hand[15]; const ringPIP  = hand[14]; const ringMCP = hand[13];
    const pinkyTip  = hand[20]; const pinkyDIP = hand[19]; const pinkyPIP = hand[18]; const pinkyMCP = hand[17];

    const wristToMid = dist2D(wrist, hand[9]);
    const scale = wristToMid + 1e-5;

    // Robust extension check based on intrinsic geometric invariants:
    const isFingerExtended = (tip, dip, pip, mcp) => {
      const isFurtherThanPIP = dist2D(tip, wrist) > dist2D(pip, wrist) * 1.04;
      const isOutstretched = dist2D(tip, mcp) > scale * 0.38;
      const isUncurled = dist2D(tip, mcp) > dist2D(pip, mcp) * 1.12;
      const isUpperOrientation = tip.y < mcp.y + scale * 0.12;
      return isFurtherThanPIP && isOutstretched && isUncurled && isUpperOrientation;
    };

    const idxUp   = isFingerExtended(idxTip, idxDIP, idxPIP, idxMCP);
    const midUp   = isFingerExtended(midTip, midDIP, midPIP, midMCP);
    const ringUp  = isFingerExtended(ringTip, ringDIP, ringPIP, ringMCP);
    const pinkyUp = isFingerExtended(pinkyTip, pinkyDIP, pinkyPIP, pinkyMCP);

    // Thumb is extended when spread outward away from the palm/index knuckle
    const thumbUp = dist2D(thumbTip, idxMCP) > scale * 0.44 &&
                    dist2D(thumbTip, wrist) > dist2D(thumbMCP, wrist) * 1.08;

    const extendedCount = (idxUp ? 1 : 0) + (midUp ? 1 : 0) + (ringUp ? 1 : 0) + (pinkyUp ? 1 : 0);

    // Closed fist detection:
    const isCompactFist = dist2D(idxTip, idxMCP) < scale * 0.58 && dist2D(midTip, midMCP) < scale * 0.58;
    const isTrueFist = (extendedCount === 0) && isCompactFist;

    if (isTrueFist) {
      fgFistFrames = Math.min(10, fgFistFrames + 1);
    } else {
      fgFistFrames = Math.max(0, fgFistFrames - 1);
    }

    let gesture = null;
    let label = '';

    // 1. Open Palm: 4+ fingers extended (or 3 fingers + thumb spread) -> JUMP (instant priority)
    if (extendedCount >= 4 || (idxUp && midUp && ringUp && pinkyUp) || (extendedCount === 3 && thumbUp && idxUp && midUp)) {
      gesture = 'jump';
      label = '🖐️ PALM: JUMP';
      fgFistFrames = 0;
    }
    // 2. Closed Fist: all fingers curled -> DUCK / SLIDE
    else if (isTrueFist || fgFistFrames >= 1) {
      gesture = 'duck';
      label = '✊ FIST: SLIDE';
    }
    // 3. Three Fingers: Index + Middle + Ring -> RIGHT LANE (+1)
    else if ((idxUp && midUp && ringUp && !pinkyUp) || (thumbUp && idxUp && midUp && !ringUp && !pinkyUp) || (extendedCount === 3 && !pinkyUp)) {
      gesture = 'lane_right';
      label = '🤟 3 FINGERS: RIGHT';
    }
    // 4. Two Fingers: strictly 2 fingers up (Index + Middle) -> CENTER LANE (0)
    else if ((idxUp && midUp && !ringUp && !pinkyUp) || (extendedCount === 2 && (idxUp || midUp))) {
      gesture = 'lane_center';
      label = '✌️ 2 FINGERS: CENTER';
    }
    // 5. One Finger: strictly Index up -> LEFT LANE (-1)
    else if ((idxUp && !midUp && !ringUp && !pinkyUp) || (extendedCount === 1 && idxUp)) {
      gesture = 'lane_left';
      label = '☝️ 1 FINGER: LEFT';
    } else {
      gesture = null;
      label = `✋ Fingers: ${extendedCount}`;
    }

    // Continuous extension score for each finger: [0, 1]
    const getFingerExtensionScore = (tip, dip, pip, mcp) => {
      const mcpDistRatio = dist2D(tip, mcp) / scale;
      const wristDistRatio = dist2D(tip, wrist) / (dist2D(pip, wrist) + 1e-5);
      const s1 = Math.max(0, Math.min(1, (mcpDistRatio - 0.38) / (0.80 - 0.38)));
      const s2 = Math.max(0, Math.min(1, (wristDistRatio - 0.95) / (1.25 - 0.95)));
      return 0.5 * s1 + 0.5 * s2;
    };

    const eIdx   = getFingerExtensionScore(idxTip, idxDIP, idxPIP, idxMCP);
    const eMid   = getFingerExtensionScore(midTip, midDIP, midPIP, midMCP);
    const eRing  = getFingerExtensionScore(ringTip, ringDIP, ringPIP, ringMCP);
    const ePinky = getFingerExtensionScore(pinkyTip, pinkyDIP, pinkyPIP, pinkyMCP);
    const eThumb = Math.max(0, Math.min(1, (dist2D(thumbTip, idxMCP) / scale - 0.35) / 0.30));

    // Continuous confidence scores for each gesture (0.0 to 1.0)
    const othersCurled1 = Math.min(1 - eMid, 1 - eRing, 1 - ePinky);
    let confOne = Math.max(0, Math.min(1, eIdx * 0.7 + othersCurled1 * 0.3));
    if (eIdx < 0.35 || othersCurled1 < 0.35) confOne = 0;
    if (gesture === 'lane_left') confOne = Math.max(confOne, 0.90 + confOne * 0.09);
    else if (gesture) confOne = Math.min(confOne, 0.05);

    const mainTwo = Math.min(eIdx, eMid);
    const othersCurled2 = Math.min(1 - eRing, 1 - ePinky);
    let confTwo = Math.max(0, Math.min(1, mainTwo * 0.7 + othersCurled2 * 0.3));
    if (mainTwo < 0.35 || othersCurled2 < 0.35) confTwo = 0;
    if (gesture === 'lane_center') confTwo = Math.max(confTwo, 0.90 + confTwo * 0.09);
    else if (gesture) confTwo = Math.min(confTwo, 0.05);

    const mainThree = Math.min(eIdx, eMid, eRing);
    const pinkyCurled = 1 - ePinky;
    let confThree = Math.max(0, Math.min(1, mainThree * 0.7 + pinkyCurled * 0.3));
    if (mainThree < 0.35 || pinkyCurled < 0.35) confThree = 0;
    if (gesture === 'lane_right') confThree = Math.max(confThree, 0.90 + confThree * 0.09);
    else if (gesture) confThree = Math.min(confThree, 0.05);

    const allExtended = Math.min(eIdx, eMid, eRing, ePinky);
    let confPalm = Math.max(0, Math.min(1, allExtended * 0.85 + eThumb * 0.15));
    if (allExtended < 0.35) confPalm = 0;
    if (gesture === 'jump') confPalm = Math.max(confPalm, 0.90 + confPalm * 0.09);
    else if (gesture) confPalm = Math.min(confPalm, 0.05);

    const allCurled = Math.min(1 - eIdx, 1 - eMid, 1 - eRing, 1 - ePinky);
    const compact1  = Math.max(0, Math.min(1, (0.60 - dist2D(idxTip, idxMCP) / scale) / 0.22));
    const compact2  = Math.max(0, Math.min(1, (0.60 - dist2D(midTip, midMCP) / scale) / 0.22));
    let confFist    = Math.max(0, Math.min(1, allCurled * 0.6 + 0.5 * (compact1 + compact2) * 0.4));
    if (allCurled < 0.35) confFist = 0;
    if (isTrueFist || fgFistFrames >= 1) confFist = Math.max(confFist, 0.90 + confFist * 0.09);
    else if (gesture && gesture !== 'duck') confFist = Math.min(confFist, 0.05);

    state.gestureConfidences = {
      fist: Number(confFist.toFixed(3)),
      palm: Number(confPalm.toFixed(3)),
      one_finger: Number(confOne.toFixed(3)),
      two_fingers: Number(confTwo.toFixed(3)),
      three_fingers: Number(confThree.toFixed(3))
    };

    state.fgGesture = gesture;
    state.fgSource  = 'hand';
    state.debugText = label;

    const pc = palmCenter(hand);
    const fistActive = gesture === 'duck';
    state.points = [
      { x: 1 - pc.x, y: pc.y, color: fistActive ? '#ffd700' : '#ff6b35', r: fistActive ? 8 : 7 },
      { x: 1 - thumbTip.x, y: thumbTip.y, color: thumbUp ? '#00ff88' : (fistActive ? '#ffaa00' : '#666'), r: 4 },
      { x: 1 - idxTip.x, y: idxTip.y, color: idxUp ? '#00ff88' : (fistActive ? '#ffaa00' : '#666'), r: 4 },
      { x: 1 - midTip.x, y: midTip.y, color: midUp ? '#00ff88' : (fistActive ? '#ffaa00' : '#666'), r: 4 },
      { x: 1 - ringTip.x, y: ringTip.y, color: ringUp ? '#00ff88' : (fistActive ? '#ffaa00' : '#666'), r: 4 },
      { x: 1 - pinkyTip.x, y: pinkyTip.y, color: pinkyUp ? '#00ff88' : (fistActive ? '#ffaa00' : '#666'), r: 4 }
    ];
  } else {
    fgFistFrames = 0;
    state.fgSource  = null;
    state.fgGesture = null;
    state.debugText = '✋ Show hand in camera';
  }

  return state;
}
