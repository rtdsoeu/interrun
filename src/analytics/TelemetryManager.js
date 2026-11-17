/**
 * TelemetryManager — In-game real-time metrics and session telemetry collector for InterRun.
 *
 * Tracks empirical metrics for HCI research and qualification thesis (Sections 5 & 6):
 * - Live and average Three.js render FPS & MediaPipe CV inference FPS per stage.
 * - Stage-by-stage error rate (collisions per 100 meters).
 * - Player reaction time (time delta between obstacle entering active horizon and player evasive maneuver).
 * - Longitudinal learning curve across consecutive play sessions.
 * - Session engagement: duration, distance, coins, retry count, retention timestamps.
 * - JSON and CSV export capabilities.
 */

export class TelemetryManager {
  constructor(storageKey = 'interrun_telemetry_runs') {
    this.storageKey = storageKey;
    this.currentSession = null;
    this.maxStoredSessions = 50;

    // Obstacle horizon tracking for reaction time calculation
    this._pendingObstacles = new Map(); // id -> { detectedTime, distance, lane, type }
    this._seenObstacleIds = new Set(); // prevents re-inserting already consumed obstacle IDs
    this._reactionSamples = []; // { stage, deltaMs }

    // Event hooks for adaptive managers (e.g. AdaptiveDifficultyManager)
    this.onReactionRecorded = null; // callback({ stage, ttcMs, actionType })
    this.onCollisionRecorded = null; // callback({ stage, distance, obstacleType })

    // Memory cache for saved sessions
    this._history = this._loadHistory();
    this._lastSessionActions = null;
  }

  _getStorage() {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  }

  _loadHistory() {
    const storage = this._getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _saveHistory() {
    const storage = this._getStorage();
    if (!storage) return;
    try {
      if (this._history.length > this.maxStoredSessions) {
        this._history = this._history.slice(-this.maxStoredSessions);
      }
      storage.setItem(this.storageKey, JSON.stringify(this._history));
    } catch {
      // Storage quota or restricted access fallback
    }
  }

  /**
   * Starts tracking a new game session.
   * @param {number} initialStage
   * @param {boolean} isLocked
   * @param {number} speedMultiplier
   */
  startSession(initialStage = 0, isLocked = false, speedMultiplier = 1.0) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._pendingObstacles.clear();
    this._seenObstacleIds.clear();
    this._reactionSamples = [];

    this.currentSession = {
      id: 'run_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      sessionNumber: this._history.length + 1,
      timestamp: new Date().toISOString(),
      startPerfTime: now,
      endPerfTime: null,
      durationSec: 0,
      initialStage,
      isLocked,
      speedMultiplier,
      totalDistance: 0,
      coins: 0,
      totalCollisions: 0,

      // Per-stage metrics (0..5)
      stages: {
        0: this._createStageRecord(0),
        1: this._createStageRecord(1),
        2: this._createStageRecord(2),
        3: this._createStageRecord(3),
        4: this._createStageRecord(4),
        5: this._createStageRecord(5)
      },

      currentStage: initialStage,
      stageEnterTime: now,
      stageEnterDistance: 0,

      // Physical interaction action counters
      actions: {
        buttonPresses: 0,
        headTiltsLeftRight: 0,
        headTiltsUpDown: 0,
        handGestures: 0,
        nearMisses: 0
      },

      // Kinematic trajectory & movement excursion tracking
      kinematics: {
        totalHeadPathNorm: 0,
        totalHandPathNorm: 0,
        headSamples: 0,
        handSamples: 0,
        nearMisses: 0
      }
    };
  }

  _createStageRecord(stageNum) {
    return {
      stage: stageNum,
      distance: 0,
      durationSec: 0,
      collisions: 0,
      errorRatePer100m: 0,
      reactionTimesMs: [],
      avgReactionTimeMs: 0,
      avgTtcMs: 0,
      fpsSamples: [],
      cvFpsSamples: [],
      avgGameFps: 0,
      avgCvFps: 0,
      minCvFps: 999,
      maxCvFps: 0
    };
  }

  /**
   * Records stage switch or loop transition.
   * @param {number} newStage
   * @param {number} currentDistance
   */
  recordStageTransition(newStage, currentDistance) {
    if (!this.currentSession) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const oldStage = this.currentSession.currentStage;
    const record = this.currentSession.stages[oldStage];

    if (record) {
      const deltaDist = Math.max(0, currentDistance - this.currentSession.stageEnterDistance);
      const deltaSec = Math.max(0, (now - this.currentSession.stageEnterTime) / 1000);
      record.distance += deltaDist;
      record.durationSec += deltaSec;
      record.errorRatePer100m = record.distance > 0 ? (record.collisions / (record.distance / 100)) : 0;
    }

    this.currentSession.currentStage = newStage;
    this.currentSession.stageEnterTime = now;
    this.currentSession.stageEnterDistance = currentDistance;
  }

  /**
   * Samples Game and CV FPS during gameplay.
   * @param {number} gameFps
   * @param {number} cvFps
   * @param {number} stage
   */
  sampleFps(gameFps, cvFps, stage) {
    if (!this.currentSession) return;
    const record = this.currentSession.stages[stage];
    if (!record) return;

    if (gameFps > 0) record.fpsSamples.push(gameFps);
    if (cvFps > 0) {
      record.cvFpsSamples.push(cvFps);
      if (cvFps < record.minCvFps) record.minCvFps = cvFps;
      if (cvFps > record.maxCvFps) record.maxCvFps = cvFps;
    }
  }

  /**
   * Records when an obstacle enters the player's active reaction horizon (e.g. 18m to 28m ahead).
   * @param {string|number} obstacleId
   * @param {number} distance
   * @param {number} lane
   * @param {string} type
   * @param {number} [zPos] Initial Z position
   */
  recordObstacleHorizon(obstacleId, distance, lane, type, zPos = null) {
    if (!this.currentSession) return;
    if (this._seenObstacleIds.has(obstacleId)) return;
    this._seenObstacleIds.add(obstacleId);
    if (this._seenObstacleIds.size > 300) {
      const oldest = this._seenObstacleIds.values().next().value;
      this._seenObstacleIds.delete(oldest);
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._pendingObstacles.set(obstacleId, {
      detectedTime: now,
      distance,
      lane,
      type,
      z: typeof zPos === 'number' ? zPos : -25,
      stage: this.currentSession.currentStage
    });
  }

  /**
   * Records a user evasive action (lane switch, jump, slide).
   * Calculates physical Time-To-Collision (TTC) to the nearest oncoming obstacle.
   * @param {'lane'|'jump'|'slide'} actionType
   * @param {number} [currentSpeed] Current runner forward speed in m/s
   * @param {number} [runnerZ] Current runner Z position (typically 0)
   * @param {number} [nearestObsZ] Optional exact Z position of nearest obstacle ahead
   */
  recordPlayerAction(actionType, currentSpeed = null, runnerZ = null, nearestObsZ = null) {
    if (!this.currentSession || this._pendingObstacles.size === 0) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // Match with the earliest unconsumed obstacle
    let earliestKey = null;
    let earliestTime = Infinity;
    for (const [id, obs] of this._pendingObstacles.entries()) {
      if (obs.detectedTime < earliestTime) {
        earliestTime = obs.detectedTime;
        earliestKey = id;
      }
    }

    if (earliestKey !== null) {
      const obs = this._pendingObstacles.get(earliestKey);
      this._pendingObstacles.delete(earliestKey);

      let ttcMs;
      let distAhead = null;
      if (typeof nearestObsZ === 'number' && typeof runnerZ === 'number' && typeof currentSpeed === 'number' && currentSpeed > 0) {
        // Physical TTC based on live obstacle distance ahead: TTC = (runnerZ - nearestObsZ) / speed
        distAhead = Math.max(0.1, runnerZ - nearestObsZ);
        ttcMs = Math.round((distAhead / currentSpeed) * 1000);
      } else if (typeof runnerZ === 'number' && typeof currentSpeed === 'number' && currentSpeed > 0 && typeof obs.z === 'number') {
        // Kinematic TTC: obstacle moved forward by speed * dt since detected
        const elapsedSec = (now - obs.detectedTime) / 1000;
        const currentZ = obs.z + elapsedSec * currentSpeed;
        distAhead = Math.max(0.1, runnerZ - currentZ);
        ttcMs = Math.round((distAhead / currentSpeed) * 1000);
      } else {
        // Fallback to timestamp delta
        ttcMs = Math.round(now - obs.detectedTime);
        if (typeof currentSpeed === 'number' && currentSpeed > 0) {
          distAhead = Math.round(((ttcMs / 1000) * currentSpeed) * 10) / 10;
        }
      }

      // Valid physical TTC range: 80ms (extreme near-miss) to 2000ms (early safe dodge)
      if (ttcMs >= 80 && ttcMs <= 2000) {
        const record = this.currentSession.stages[obs.stage];
        if (record) {
          record.reactionTimesMs.push(ttcMs);
        }
        this._reactionSamples.push({ stage: obs.stage, deltaMs: ttcMs, ttcMs, actionType });

        if (this.onReactionRecorded) {
          try {
            this.onReactionRecorded({ stage: obs.stage, ttcMs, actionType, currentSpeed, distAhead });
          } catch (err) {
            console.warn('[TelemetryManager] onReactionRecorded callback error:', err);
          }
        }
      }
    }
  }

  /**
   * Records a kinematic motion delta from computer vision tracking.
   * @param {{ source: 'face'|'hands', deltaDist: number, speed: number }} kinematics
   */
  recordKinematics(kinematics) {
    if (!this.currentSession || !kinematics || typeof kinematics.deltaDist !== 'number') return;
    const k = this.currentSession.kinematics;
    if (!k) return;

    if (kinematics.source === 'face') {
      k.totalHeadPathNorm += kinematics.deltaDist;
      k.headSamples++;
    } else if (kinematics.source === 'hands') {
      k.totalHandPathNorm += kinematics.deltaDist;
      k.handSamples++;
    }
  }

  /**
   * Records a physical button press (keyboard or virtual touch D-pad).
   */
  recordButtonPress() {
    if (this.currentSession?.actions) {
      this.currentSession.actions.buttonPresses++;
    }
  }

  /**
   * Records a head tilt event (left/right or up/down).
   * @param {'lr'|'ud'|'left'|'right'|'up'|'down'} [axisOrDir='lr']
   */
  recordHeadTilt(axisOrDir = 'lr') {
    if (!this.currentSession?.actions) return;
    if (axisOrDir === 'ud' || axisOrDir === 'up' || axisOrDir === 'down') {
      this.currentSession.actions.headTiltsUpDown++;
    } else {
      this.currentSession.actions.headTiltsLeftRight++;
    }
  }

  /**
   * Records a hand gesture event (zone transition, finger gesture, or air swipe).
   */
  recordHandGesture() {
    if (this.currentSession?.actions) {
      this.currentSession.actions.handGestures++;
    }
  }

  /**
   * Increments near-miss count in active session.
   */
  recordNearMiss() {
    if (this.currentSession?.actions) {
      this.currentSession.actions.nearMisses++;
    }
    if (this.currentSession?.kinematics) {
      this.currentSession.kinematics.nearMisses++;
    }
  }

  /**
   * Returns empirical action counters for current or last finalized session.
   * @returns {{ buttonPresses: number, headTiltsLeftRight: number, headTiltsUpDown: number, totalHeadTilts: number, handGestures: number, nearMisses: number, totalActions: number }}
   */
  getActionCounters() {
    const act = this.currentSession?.actions || this._lastSessionActions || {
      buttonPresses: 0,
      headTiltsLeftRight: 0,
      headTiltsUpDown: 0,
      handGestures: 0,
      nearMisses: 0
    };
    const lr = act.headTiltsLeftRight || 0;
    const ud = act.headTiltsUpDown || 0;
    const buttons = act.buttonPresses || 0;
    const hands = act.handGestures || 0;
    const nearMisses = act.nearMisses || 0;
    return {
      buttonPresses: buttons,
      headTiltsLeftRight: lr,
      headTiltsUpDown: ud,
      totalHeadTilts: lr + ud,
      handGestures: hands,
      nearMisses,
      totalActions: buttons + lr + ud + hands
    };
  }

  /**
   * Generates a kinematic trajectory excursion and movement economy summary.
   * @returns {Object|null}
   */
  getKinematicSummary() {
    const k = this.currentSession?.kinematics;
    if (!k) return null;

    // Convert normalized travel to approximate real-world meters (camera FOV approx 0.50m)
    const headMeters = Math.round(k.totalHeadPathNorm * 0.50 * 10) / 10;
    const handMeters = Math.round(k.totalHandPathNorm * 0.50 * 10) / 10;
    const totalSamples = k.headSamples + k.handSamples;
    const avgDelta = totalSamples > 0 ? (k.totalHeadPathNorm + k.totalHandPathNorm) / totalSamples : 0;

    let style = 'balanced';
    let styleLabel = 'Збалансований';
    let icon = '⚖️';
    if (totalSamples > 25) {
      if (avgDelta < 0.012) {
        style = 'minimalist';
        styleLabel = 'Мінімаліст (економічні мікро-рухи)';
        icon = '🎯';
      } else if (avgDelta > 0.038) {
        style = 'expressive';
        styleLabel = 'Експресивний (широкі енергійні жести)';
        icon = '⚡';
      }
    }

    return {
      headMeters,
      handMeters,
      totalMeters: Math.round((headMeters + handMeters) * 10) / 10,
      nearMisses: k.nearMisses,
      style,
      styleLabel,
      icon
    };
  }

  /**
   * Records player collision / error.
   * @param {number} stage
   * @param {number} distance
   * @param {string} obstacleType
   */
  recordCollision(stage, distance, obstacleType = '') {
    if (!this.currentSession) return;
    this.currentSession.totalCollisions++;

    const record = this.currentSession.stages[stage];
    if (record) {
      record.collisions++;
    }

    if (this.onCollisionRecorded) {
      this.onCollisionRecorded({ stage, distance, obstacleType });
    }
  }

  /**
   * Concludes session tracking on Game Over.
   * @param {number} finalDistance
   * @param {number} bestScore
   * @param {number} coins
   * @param {Object} [ddaMetrics=null]
   * @returns {Object} Finalized session object
   */
  endSession(finalDistance, bestScore, coins, ddaMetrics = null) {
    if (!this.currentSession) return null;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.currentSession.endPerfTime = now;
    this.currentSession.durationSec = Math.max(0.5, Math.round(((now - this.currentSession.startPerfTime) / 1000) * 10) / 10);
    this.currentSession.totalDistance = Math.floor(finalDistance);
    this.currentSession.coins = coins;
    if (ddaMetrics) {
      this.currentSession.dda = ddaMetrics;
    }

    // Finalize the active stage record
    const curStage = this.currentSession.currentStage;
    const curRecord = this.currentSession.stages[curStage];
    if (curRecord) {
      const deltaDist = Math.max(0, finalDistance - this.currentSession.stageEnterDistance);
      const deltaSec = Math.max(0, (now - this.currentSession.stageEnterTime) / 1000);
      curRecord.distance += deltaDist;
      curRecord.durationSec += deltaSec;
    }

    // Final calculations per stage
    for (let s = 0; s <= 5; s++) {
      const rec = this.currentSession.stages[s];
      rec.distance = Math.round(rec.distance);
      rec.durationSec = Math.round(rec.durationSec * 10) / 10;
      rec.errorRatePer100m = rec.distance > 0 ? Number(((rec.collisions / (rec.distance / 100))).toFixed(2)) : 0;

      // Reaction times / Time-To-Collision (TTC)
      if (rec.reactionTimesMs.length > 0) {
        const sum = rec.reactionTimesMs.reduce((a, b) => a + b, 0);
        rec.avgReactionTimeMs = Math.round(sum / rec.reactionTimesMs.length);
        rec.avgTtcMs = rec.avgReactionTimeMs;
      } else {
        rec.avgReactionTimeMs = null;
        rec.avgTtcMs = null;
      }

      // Game FPS
      if (rec.fpsSamples.length > 0) {
        rec.avgGameFps = Math.round(rec.fpsSamples.reduce((a, b) => a + b, 0) / rec.fpsSamples.length);
      }
      // CV FPS
      if (rec.cvFpsSamples.length > 0) {
        rec.avgCvFps = Math.round(rec.cvFpsSamples.reduce((a, b) => a + b, 0) / rec.cvFpsSamples.length);
      } else {
        rec.minCvFps = null;
        rec.maxCvFps = null;
      }

      // Clean up raw sample arrays to save localStorage quota
      rec.fpsSamples = undefined;
      rec.cvFpsSamples = undefined;
      rec.reactionTimesMs = undefined;
    }

    this._lastSessionActions = this.currentSession.actions ? { ...this.currentSession.actions } : null;
    const completed = {
      ...this.currentSession,
      actions: this._lastSessionActions ? { ...this._lastSessionActions } : undefined
    };
    this._history.push(completed);
    this._saveHistory();
    this.currentSession = null;
    return completed;
  }

  /**
   * Returns all stored sessions.
   */
  getHistory() {
    return [...this._history];
  }

  /**
   * Computes the longitudinal learning curve across stored sessions.
   * Groups error rates and distances chronologically by run.
   */
  getLearningCurve() {
    return this._history.map((run, idx) => {
      const stageErrors = {};
      for (let s = 0; s <= 5; s++) {
        stageErrors[`stage${s}`] = run.stages?.[s]?.errorRatePer100m ?? 0;
      }
      return {
        runIndex: idx + 1,
        date: run.timestamp,
        distance: run.totalDistance,
        durationSec: run.durationSec,
        stageErrors
      };
    });
  }

  /**
   * Aggregates HCI metrics for Section 5 and 6 tables.
   */
  getAggregatedMetrics() {
    const totalRuns = this._history.length;
    if (totalRuns === 0) return null;

    const stageSums = {
      0: { distance: 0, collisions: 0, duration: 0, reactionTimes: [], avgFps: [], avgCvFps: [] },
      1: { distance: 0, collisions: 0, duration: 0, reactionTimes: [], avgFps: [], avgCvFps: [] },
      2: { distance: 0, collisions: 0, duration: 0, reactionTimes: [], avgFps: [], avgCvFps: [] },
      3: { distance: 0, collisions: 0, duration: 0, reactionTimes: [], avgFps: [], avgCvFps: [] },
      4: { distance: 0, collisions: 0, duration: 0, reactionTimes: [], avgFps: [], avgCvFps: [] },
      5: { distance: 0, collisions: 0, duration: 0, reactionTimes: [], avgFps: [], avgCvFps: [] }
    };

    let totalDist = 0;
    let totalDur = 0;

    for (const run of this._history) {
      totalDist += run.totalDistance || 0;
      totalDur += run.durationSec || 0;
      for (let s = 0; s <= 5; s++) {
        const r = run.stages?.[s];
        if (!r) continue;
        stageSums[s].distance += r.distance || 0;
        stageSums[s].collisions += r.collisions || 0;
        stageSums[s].duration += r.durationSec || 0;
        if (r.avgReactionTimeMs) stageSums[s].reactionTimes.push(r.avgReactionTimeMs);
        if (r.avgGameFps) stageSums[s].avgFps.push(r.avgGameFps);
        if (r.avgCvFps) stageSums[s].avgCvFps.push(r.avgCvFps);
      }
    }

    const stageStats = {};
    for (let s = 0; s <= 5; s++) {
      const data = stageSums[s];
      const errorRate = data.distance > 0 ? Number(((data.collisions / (data.distance / 100))).toFixed(2)) : 0;
      const avgReaction = data.reactionTimes.length > 0
        ? Math.round(data.reactionTimes.reduce((a, b) => a + b, 0) / data.reactionTimes.length)
        : null;
      const meanGameFps = data.avgFps.length > 0
        ? Math.round(data.avgFps.reduce((a, b) => a + b, 0) / data.avgFps.length)
        : 60;
      const meanCvFps = data.avgCvFps.length > 0
        ? Math.round(data.avgCvFps.reduce((a, b) => a + b, 0) / data.avgCvFps.length)
        : null;

      stageStats[s] = {
        totalDistance: data.distance,
        totalCollisions: data.collisions,
        totalDurationSec: Math.round(data.duration),
        errorRatePer100m: errorRate,
        avgReactionTimeMs: avgReaction,
        avgTtcMs: avgReaction,
        meanGameFps,
        meanCvFps
      };
    }

    return {
      totalRuns,
      totalDistanceKm: Number((totalDist / 1000).toFixed(2)),
      avgSessionDurationSec: Math.round(totalDur / totalRuns),
      stages: stageStats
    };
  }

  /**
   * Generates a downloadable JSON export of all telemetry data.
   */
  exportToJson() {
    return JSON.stringify({
      appName: 'InterRun',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      aggregated: this.getAggregatedMetrics(),
      learningCurve: this.getLearningCurve(),
      sessions: this._history
    }, null, 2);
  }

  /**
   * Generates CSV format for Excel / SPSS / Google Sheets.
   */
  exportToCsv() {
    const headers = [
      'RunIndex',
      'Timestamp',
      'TotalDistance_m',
      'Duration_sec',
      'Coins',
      'DDA_State', 'DDA_Score', 'DDA_AssistSec', 'DDA_OptimalSec', 'DDA_ChallengeSec',
      'Stage0_Dist', 'Stage0_ErrorRate', 'Stage0_ReactionMs', 'Stage0_FPS',
      'Stage1_Dist', 'Stage1_ErrorRate', 'Stage1_ReactionMs', 'Stage1_FPS',
      'Stage2_Dist', 'Stage2_ErrorRate', 'Stage2_ReactionMs', 'Stage2_CV_FPS',
      'Stage3_Dist', 'Stage3_ErrorRate', 'Stage3_ReactionMs', 'Stage3_CV_FPS',
      'Stage4_Dist', 'Stage4_ErrorRate', 'Stage4_ReactionMs', 'Stage4_CV_FPS',
      'Stage5_Dist', 'Stage5_ErrorRate', 'Stage5_ReactionMs', 'Stage5_CV_FPS'
    ];

    const rows = this._history.map((run, i) => {
      const s = (idx) => run.stages?.[idx] || {};
      const dda = run.dda || {};
      return [
        i + 1,
        `"${run.timestamp}"`,
        run.totalDistance,
        run.durationSec,
        run.coins,
        dda.state || 'optimal',
        dda.averageScore ?? '',
        dda.timeInAssistSec ?? '',
        dda.timeInOptimalSec ?? '',
        dda.timeInChallengeSec ?? '',
        s(0).distance || 0, s(0).errorRatePer100m || 0, s(0).avgReactionTimeMs || '', s(0).avgGameFps || 60,
        s(1).distance || 0, s(1).errorRatePer100m || 0, s(1).avgReactionTimeMs || '', s(1).avgGameFps || 60,
        s(2).distance || 0, s(2).errorRatePer100m || 0, s(2).avgReactionTimeMs || '', s(2).avgCvFps || '',
        s(3).distance || 0, s(3).errorRatePer100m || 0, s(3).avgReactionTimeMs || '', s(3).avgCvFps || '',
        s(4).distance || 0, s(4).errorRatePer100m || 0, s(4).avgReactionTimeMs || '', s(4).avgCvFps || '',
        s(5).distance || 0, s(5).errorRatePer100m || 0, s(5).avgReactionTimeMs || '', s(5).avgCvFps || ''
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  clearHistory() {
    this._history = [];
    const storage = this._getStorage();
    if (storage) {
      try {
        storage.removeItem(this.storageKey);
      } catch { }
    }
  }
}
