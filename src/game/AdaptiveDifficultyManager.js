/**
 * AdaptiveDifficultyManager — Dynamic Difficulty Adjustment (DDA) based on Time-To-Collision (TTC)
 * and empirical player performance metrics for InterRun.
 *
 * Implements cybernetic closed-loop adaptation:
 * - Monitors player reaction margin (TTC) relative to modality-specific baseline latency.
 * - Assesses performance flow state: 'assist' (struggling), 'optimal' (flow), 'challenge' (mastery).
 * - Modulates forward speed (±10%), obstacle row spacing (25.5m–40.5m), and hazard density.
 * - Prevents frustrating failure loops via adaptive post-collision grace recovery.
 */

export const STAGE_TARGET_TTC = [
  550, // Stage 0: Keyboard / Touch D-pad (discrete mechanical input, low latency)
  600, // Stage 1: Pointer / Touch Swipes (continuous screen gestures)
  700, // Stage 2: Face Zone 3×3 (head pose tracking, cervical spine inertia)
  750, // Stage 3: Hand Zone 3×3 (palm centroid in 3D space)
  850, // Stage 4: Finger Gestures (finger articulation count, static poses)
  900  // Stage 5: Hand Swipes (kinetic contactless air swipes, arm sweep duration)
];

export const DDAState = {
  ASSIST: 'assist',
  OPTIMAL: 'optimal',
  CHALLENGE: 'challenge'
};

export class AdaptiveDifficultyManager {
  /**
   * @param {Object} options
   * @param {boolean} [options.enabled=true]
   * @param {number[]} [options.stageTargetTtc=STAGE_TARGET_TTC]
   * @param {number} [options.baseSpacing=30]
   */
  constructor({
    enabled = true,
    stageTargetTtc = STAGE_TARGET_TTC,
    baseSpacing = 30
  } = {}) {
    this.enabled = enabled;
    this.stageTargetTtc = stageTargetTtc;
    this.baseSpacing = baseSpacing;

    // Core dynamic indices
    this.performanceScore = 0.5; // [0.0 = extreme struggle, 0.5 = balanced, 1.0 = flawless mastery]
    this.targetScore = 0.5;
    this.state = DDAState.OPTIMAL;

    // Smoothed output multipliers
    this.speedMultiplier = 1.0;
    this.spacingMultiplier = 1.0;
    this.doubleFactor = 1.0;

    // Internal tracking buffers
    this.recentTtcs = [];
    this.maxRecentSamples = 6;
    this.dodgeHistory = []; // { ttcMs, ratio, stage, speed, distanceMeters, actionType, isNearMiss }
    this.collisionRecoveryTimer = 0; // seconds remaining in post-collision assist mode
    this.totalCollisions = 0;

    // Playstyle & Near-Miss tracking
    this.nearMissCount = 0;
    this.laneWeavesCount = 0;
    this.jumpsCount = 0;
    this.slidesCount = 0;
    this.cleanDodgesStreak = 0;

    // Longitudinal session metrics for HCI validation
    this.timeInAssist = 0;
    this.timeInOptimal = 0;
    this.timeInChallenge = 0;
    this.sampleCount = 0;
    this.cumulativeScore = 0;
  }

  /**
   * Resets internal session state.
   */
  reset() {
    this.performanceScore = 0.5;
    this.targetScore = 0.5;
    this.state = DDAState.OPTIMAL;
    this.speedMultiplier = 1.0;
    this.spacingMultiplier = 1.0;
    this.doubleFactor = 1.0;
    this.recentTtcs = [];
    this.dodgeHistory = [];
    this.collisionRecoveryTimer = 0;
    this.totalCollisions = 0;
    this.nearMissCount = 0;
    this.laneWeavesCount = 0;
    this.jumpsCount = 0;
    this.slidesCount = 0;
    this.cleanDodgesStreak = 0;
    this.timeInAssist = 0;
    this.timeInOptimal = 0;
    this.timeInChallenge = 0;
    this.sampleCount = 0;
    this.cumulativeScore = 0;
  }

  /**
   * Toggles dynamic adjustment on or off.
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.speedMultiplier = 1.0;
      this.spacingMultiplier = 1.0;
      this.doubleFactor = 1.0;
      this.state = DDAState.OPTIMAL;
    }
  }

  /**
   * Records a user evasive maneuver with measured Time-To-Collision (TTC).
   * @param {number} ttcMs Physical TTC to oncoming obstacle in milliseconds
   * @param {number} [stage=0] Active control stage index
   * @param {number} [currentSpeed=null] Live forward speed in m/s
   * @param {string} [actionType=null] 'lane' | 'dodge_left' | 'dodge_right' | 'jump' | 'slide'
   * @param {number} [distAhead=null] Live spatial distance ahead in meters
   * @returns {Object} { isNearMiss, distanceMeters, count, bonus }
   */
  recordReaction(ttcMs, stage = 0, currentSpeed = null, actionType = null, distAhead = null) {
    if (!this.enabled || typeof ttcMs !== 'number' || isNaN(ttcMs)) {
      return { isNearMiss: false, distanceMeters: 0, count: this.nearMissCount, bonus: 0 };
    }

    // Ignore invalid anomalous samples outside physical bounds [80ms, 2500ms]
    if (ttcMs < 80 || ttcMs > 2500) {
      return { isNearMiss: false, distanceMeters: 0, count: this.nearMissCount, bonus: 0 };
    }

    this.recentTtcs.push(ttcMs);
    if (this.recentTtcs.length > this.maxRecentSamples) {
      this.recentTtcs.shift();
    }

    const targetTtc = this.stageTargetTtc[stage] || 650;
    const ratio = ttcMs / targetTtc;

    const speed = (typeof currentSpeed === 'number' && currentSpeed > 0) ? currentSpeed : 16.0;
    const distanceMeters = (typeof distAhead === 'number' && distAhead > 0)
      ? Math.round(distAhead * 10) / 10
      : Math.round(((ttcMs / 1000) * speed) * 10) / 10;

    // Track maneuver preferences
    if (actionType === 'lane' || actionType === 'dodge_left' || actionType === 'dodge_right') {
      this.laneWeavesCount++;
    } else if (actionType === 'jump') {
      this.jumpsCount++;
    } else if (actionType === 'slide') {
      this.slidesCount++;
    }

    // Near-Miss evaluation (evasion with <= 8.5 meters margin)
    const isNearMiss = distanceMeters <= 8.5;
    if (isNearMiss) {
      this.nearMissCount++;
    }
    this.cleanDodgesStreak++;

    this.dodgeHistory.push({ ttcMs, ratio, stage, speed, distanceMeters, actionType, isNearMiss });
    if (this.dodgeHistory.length > 12) {
      this.dodgeHistory.shift();
    }

    // Map ratio to sample performance score
    let sampleScore;
    if (ratio <= 1.0) {
      sampleScore = Math.max(0.05, 0.50 * (ratio / 1.0));
    } else {
      sampleScore = Math.min(1.0, 0.50 + 0.50 * Math.min(1.0, (ratio - 1.0) / 0.6));
    }

    // Exponential moving average update (alpha = 0.28)
    const alpha = 0.28;
    this.targetScore = (1 - alpha) * this.performanceScore + alpha * sampleScore;

    // Cap performance if currently recovering from collision
    if (this.collisionRecoveryTimer > 0) {
      this.targetScore = Math.min(0.35, this.targetScore);
    }

    this.performanceScore = this.targetScore;
    this.sampleCount++;
    this.cumulativeScore += this.performanceScore;

    return {
      isNearMiss,
      distanceMeters,
      count: this.nearMissCount,
      bonus: isNearMiss ? 150 : 0
    };
  }

  /**
   * Records an obstacle collision, immediately triggering post-crash assistance.
   * @param {number} [stage=0]
   */
  recordCollision(stage = 0) {
    if (!this.enabled) return;

    this.totalCollisions++;
    this.cleanDodgesStreak = 0;
    // Sharply lower performance score and trigger 8.0s grace period
    this.performanceScore = Math.max(0.12, this.performanceScore - 0.35);
    this.targetScore = this.performanceScore;
    this.collisionRecoveryTimer = 8.0; // 8 seconds of active assist mode
  }

  /**
   * Per-frame game loop update. Interpolates multipliers and tracks flow state.
   * @param {number} dt Delta time in seconds
   * @param {number} [stage=0] Active control stage
   */
  update(dt, stage = 0) {
    if (!this.enabled) {
      this.speedMultiplier = 1.0;
      this.spacingMultiplier = 1.0;
      this.doubleFactor = 1.0;
      this.state = DDAState.OPTIMAL;
      return;
    }

    // Advance collision recovery countdown
    if (this.collisionRecoveryTimer > 0) {
      this.collisionRecoveryTimer = Math.max(0, this.collisionRecoveryTimer - dt);
    }

    // Determine current flow state
    if (this.performanceScore < 0.38 || this.collisionRecoveryTimer > 0) {
      this.state = DDAState.ASSIST;
      this.timeInAssist += dt;
    } else if (this.performanceScore > 0.65) {
      this.state = DDAState.CHALLENGE;
      this.timeInChallenge += dt;
    } else {
      this.state = DDAState.OPTIMAL;
      this.timeInOptimal += dt;
    }

    // Target multiplier calculations centered around neutral score 0.5 (multiplier = 1.00):
    // 1. Speed modifier: [0.90 .. 1.10]
    let targetSpeed;
    if (this.performanceScore >= 0.5) {
      targetSpeed = 1.0 + (this.performanceScore - 0.5) * 0.20; // 0.5 -> 1.00, 1.0 -> 1.10
    } else {
      targetSpeed = 1.0 - (0.5 - this.performanceScore) * 0.20; // 0.5 -> 1.00, 0.0 -> 0.90
    }

    // 2. Obstacle spacing multiplier: [1.35 .. 0.82]
    let targetSpacing;
    if (this.performanceScore >= 0.5) {
      targetSpacing = 1.0 - (this.performanceScore - 0.5) * 0.36; // 0.5 -> 1.00, 1.0 -> 0.82
    } else {
      targetSpacing = 1.0 + (0.5 - this.performanceScore) * 0.70; // 0.5 -> 1.00, 0.0 -> 1.35
    }

    // 3. Double-obstacle row probability factor: [0.0 .. 1.4]
    //    Assist mode eliminates two-lane hazard rows; challenge mode increases them
    let targetDouble;
    if (this.state === DDAState.ASSIST) {
      targetDouble = 0.0;
    } else if (this.state === DDAState.OPTIMAL) {
      targetDouble = 0.85;
    } else {
      targetDouble = 1.35;
    }

    // Smooth asymptotic approach (rate = 2.2 * dt)
    const lerpRate = Math.min(1.0, dt * 2.2);
    this.speedMultiplier += (targetSpeed - this.speedMultiplier) * lerpRate;
    this.spacingMultiplier += (targetSpacing - this.spacingMultiplier) * lerpRate;
    this.doubleFactor += (targetDouble - this.doubleFactor) * lerpRate;
  }

  /**
   * Calculated effective obstacle row spacing in meters.
   * @returns {number}
   */
  get effectiveSpacing() {
    return Math.round(this.baseSpacing * this.spacingMultiplier * 10) / 10;
  }

  /**
   * Average performance score across session.
   * @returns {number}
   */
  get averageScore() {
    return this.sampleCount > 0 ? (this.cumulativeScore / this.sampleCount) : 0.5;
  }

  /**
   * Evaluates player style based on statistical regularity of obstacle dodge clearance margin.
   * Rejects isolated anomalous spikes and establishes persona on sustained streak behavior.
   *
   * @returns {Object} { archetype, label, regularityPct, avgMarginMeters, avgTtcMs, sampleCount }
   */
  getPlayStyle() {
    const totalManeuvers = this.laneWeavesCount + this.jumpsCount + this.slidesCount;
    const weavesPct = totalManeuvers > 0 ? Math.round((this.laneWeavesCount / totalManeuvers) * 100) : 50;
    const verticalsPct = 100 - weavesPct;

    let maneuverArchetype = 'balanced';
    let maneuverLabel = 'Універсал (Navigator)';
    let maneuverIcon = '⚖️';
    if (totalManeuvers >= 3) {
      if (weavesPct >= 65) {
        maneuverArchetype = 'weaver';
        maneuverLabel = 'Слаломіст (Weaver)';
        maneuverIcon = '🏃';
      } else if (verticalsPct >= 60) {
        maneuverArchetype = 'acrobat';
        maneuverLabel = 'Акробат (Acrobat)';
        maneuverIcon = '🤸';
      }
    }

    if (this.dodgeHistory.length < 3) {
      return {
        archetype: 'calibrating',
        label: 'Calibrating...',
        personaTitle: '⚖️ Калібрування стилю...',
        maneuverArchetype,
        maneuverLabel,
        maneuverIcon,
        weavesPct,
        verticalsPct,
        nearMissCount: this.nearMissCount,
        regularityPct: 50,
        avgMarginMeters: 0,
        avgTtcMs: 0,
        sampleCount: this.dodgeHistory.length
      };
    }

    const n = this.dodgeHistory.length;
    const ratios = this.dodgeHistory.map(d => d.ratio);
    const ttcs = this.dodgeHistory.map(d => d.ttcMs);
    const margins = this.dodgeHistory.map(d => d.distanceMeters || (d.ttcMs * 0.015));

    const avgRatio = ratios.reduce((a, b) => a + b, 0) / n;
    const avgTtc = Math.round(ttcs.reduce((a, b) => a + b, 0) / n);
    const avgMarginMeters = Math.round((margins.reduce((a, b) => a + b, 0) / n) * 10) / 10;

    // Variance & Standard Deviation of normalized clearance ratio
    const variance = ratios.reduce((acc, r) => acc + Math.pow(r - avgRatio, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    // Regularity percentage: low variance = high regularity [10%..100%]
    const regularityPct = Math.round(Math.max(10, Math.min(100, (1 - stdDev / 0.50) * 100)));

    // Measure streak of recent dodges (last 4 samples)
    const recent = ratios.slice(-4);
    const closeCount = recent.filter(r => r < 0.82).length;
    const earlyCount = recent.filter(r => r > 1.25).length;

    let archetype = 'flow_master';
    let label = 'Flow-Master (Optimal Flow)';

    // If standard deviation is high (> 0.35) and no streak dominates -> Variable / Erratic
    if (stdDev > 0.35 && closeCount < 3 && earlyCount < 3) {
      archetype = 'variable';
      label = 'Variable (Dynamic Pacing)';
    } else if (closeCount >= 3 || (avgRatio < 0.80 && stdDev <= 0.30) || (this.nearMissCount >= 3 && stdDev <= 0.30)) {
      archetype = 'risk_taker';
      label = 'Risk-Taker (Late Dodge)';
    } else if (earlyCount >= 3 || (avgRatio > 1.28 && stdDev <= 0.30)) {
      archetype = 'cautious';
      label = 'Cautious (Early Dodge)';
    } else {
      archetype = 'flow_master';
      label = 'Flow-Master (Optimal Flow)';
    }

    // RPG Combined Persona Title
    let personaTitle;
    if (archetype === 'risk_taker') {
      personaTitle = maneuverArchetype === 'weaver' ? '🔥 Ризиковий Слаломіст (Risk Weaver)'
                   : maneuverArchetype === 'acrobat' ? '🔥 Ризиковий Акробат (Risk Acrobat)'
                   : '🔥 Ризиковий Гонщик (Risk-Taker)';
    } else if (archetype === 'cautious') {
      personaTitle = maneuverArchetype === 'weaver' ? '🛡️ Тактичний Слаломіст (Tactical Weaver)'
                   : maneuverArchetype === 'acrobat' ? '🛡️ Тактичний Акробат (Tactical Acrobat)'
                   : '🛡️ Обережний Стратег (Tactician)';
    } else if (archetype === 'variable') {
      personaTitle = '🌀 Непередбачуваний Віртуоз (Dynamic Runner)';
    } else {
      personaTitle = maneuverArchetype === 'weaver' ? '⚡ Стрімкий Слаломіст (Flow Weaver)'
                   : maneuverArchetype === 'acrobat' ? '⚡ Стрімкий Акробат (Flow Acrobat)'
                   : '⚡ Збалансований Навігатор (Flow Master)';
    }

    return {
      archetype,
      label,
      personaTitle,
      maneuverArchetype,
      maneuverLabel,
      maneuverIcon,
      weavesPct,
      verticalsPct,
      nearMissCount: this.nearMissCount,
      regularityPct,
      avgMarginMeters,
      avgTtcMs: avgTtc,
      sampleCount: n
    };
  }

  /**
   * Comprehensive telemetry snapshot for research and UI.
   * @returns {Object}
   */
  getMetrics() {
    return {
      enabled: this.enabled,
      state: this.state,
      performanceScore: Math.round(this.performanceScore * 100) / 100,
      averageScore: Math.round(this.averageScore * 100) / 100,
      speedMultiplier: Math.round(this.speedMultiplier * 100) / 100,
      spacingMultiplier: Math.round(this.spacingMultiplier * 100) / 100,
      effectiveSpacing: this.effectiveSpacing,
      doubleFactor: Math.round(this.doubleFactor * 100) / 100,
      collisionRecoveryTimer: Math.round(this.collisionRecoveryTimer * 10) / 10,
      totalCollisions: this.totalCollisions,
      timeInAssistSec: Math.round(this.timeInAssist * 10) / 10,
      timeInOptimalSec: Math.round(this.timeInOptimal * 10) / 10,
      timeInChallengeSec: Math.round(this.timeInChallenge * 10) / 10,
      playStyle: this.getPlayStyle()
    };
  }
}
