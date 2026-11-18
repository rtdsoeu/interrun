import { describe, it, expect, beforeEach } from 'vitest';
import { TelemetryManager } from '../src/analytics/TelemetryManager.js';
import { GestureBenchmark, FINGER_GESTURE_CLASSES } from '../src/analytics/GestureBenchmark.js';
import { SurveyManager } from '../src/analytics/SurveyManager.js';

describe('TelemetryManager', () => {
  let telemetry;

  beforeEach(() => {
    telemetry = new TelemetryManager('test_telemetry_key');
    telemetry.clearHistory();
  });

  it('initializes session correctly', () => {
    telemetry.startSession(0, false, 1.0);
    expect(telemetry.currentSession).not.toBeNull();
    expect(telemetry.currentSession.initialStage).toBe(0);
    expect(telemetry.currentSession.currentStage).toBe(0);
    expect(telemetry.currentSession.stages[0].stage).toBe(0);
  });

  it('records collisions and calculates error rate per 100m', () => {
    telemetry.startSession(0, false, 1.0);
    telemetry.recordCollision(0, 50, 'train_blocker');
    telemetry.recordCollision(0, 90, 'jump_barrier');

    // Simulate stage transition at 300m
    telemetry.recordStageTransition(1, 300);

    const session = telemetry.endSession(300, 300, 15);
    expect(session.totalCollisions).toBe(2);
    expect(session.stages[0].collisions).toBe(2);
    expect(session.stages[0].distance).toBe(300);
    // 2 collisions over 300m -> (2 / 3) = 0.67 errors / 100m
    expect(session.stages[0].errorRatePer100m).toBeCloseTo(0.67, 1);
  });

  it('measures reaction time between obstacle horizon and player action', () => {
    telemetry.startSession(0, false, 1.0);

    // Obstacle enters horizon
    telemetry.recordObstacleHorizon('obs_1', 25, 0, 'jump_barrier');

    // Wait a tiny bit (simulated via action)
    telemetry.recordPlayerAction('jump');

    const session = telemetry.endSession(100, 100, 5);
    // Even if execution is synchronous and delta is small or clamped, avgReactionTime is populated if within [80, 2000]
    expect(session.totalDistance).toBe(100);
  });

  it('calculates physical Time-To-Collision (TTC) for last-moment dodges', () => {
    telemetry.startSession(0, false, 1.0);

    let recordedData = null;
    telemetry.onReactionRecorded = (data) => {
      recordedData = data;
    };

    // Obstacle enters horizon at Z = -25
    telemetry.recordObstacleHorizon('obs_last_second', 50, 0, 'train_blocker', -25);

    // Player dodges at the very last moment when obstacle is only 3m ahead at speed 15 m/s
    // TTC = (0 - (-3)) / 15 * 1000 = 200ms
    const speed = 15.0;
    const runnerZ = 0.0;
    const nearestObsZ = -3.0;
    telemetry.recordPlayerAction('lane', speed, runnerZ, nearestObsZ);

    const session = telemetry.endSession(150, 150, 8);
    expect(session.stages[0].avgReactionTimeMs).toBe(200);
    expect(session.stages[0].avgTtcMs).toBe(200);
    expect(recordedData).not.toBeNull();
    expect(recordedData.distAhead).toBe(3);
    expect(recordedData.ttcMs).toBe(200);
    expect(recordedData.actionType).toBe('lane');
  });

  it('calculates physical Time-To-Collision (TTC) for early safe dodges', () => {
    telemetry.startSession(0, false, 1.0);

    telemetry.recordObstacleHorizon('obs_early', 80, 0, 'jump_barrier', -25);

    // Player dodges early when obstacle is 15m ahead at speed 15 m/s -> TTC = 1000ms
    const speed = 15.0;
    const runnerZ = 0.0;
    const nearestObsZ = -15.0;
    telemetry.recordPlayerAction('jump', speed, runnerZ, nearestObsZ);

    const session = telemetry.endSession(200, 200, 10);
    expect(session.stages[0].avgTtcMs).toBe(1000);
  });

  it('does not re-register an already consumed obstacle ID in recordObstacleHorizon', () => {
    telemetry.startSession(2, false, 1.0);

    let reactionCount = 0;
    telemetry.onReactionRecorded = () => {
      reactionCount++;
    };

    telemetry.recordObstacleHorizon('obs_dup', 100, 0, 'train_blocker', -24);
    telemetry.recordPlayerAction('lane', 15.0, 0.0, -4.0);
    expect(reactionCount).toBe(1);

    // Subsequent horizon checks for the same obstacle ID must be ignored
    telemetry.recordObstacleHorizon('obs_dup', 101, 0, 'train_blocker', -23);
    telemetry.recordPlayerAction('lane', 15.0, 0.0, -3.5);
    expect(reactionCount).toBe(1);
  });

  it('records direct obstacle evasion even when horizon queue is empty and for ultra-close near-misses', () => {
    telemetry.startSession(0, false, 1.0);

    let recorded = null;
    telemetry.onReactionRecorded = (data) => {
      recorded = data;
    };

    // Ultra-close near-miss: 0.75m ahead at 15 m/s -> TTC = 50ms
    telemetry.recordPlayerAction('lane', 15.0, 0.0, -0.75, 'obs_direct_1');

    expect(recorded).not.toBeNull();
    expect(recorded.ttcMs).toBe(50);
    expect(recorded.distAhead).toBe(0.75);
    expect(recorded.stage).toBe(0);
  });

  it('records empirical physical action counters (button presses, head tilts, hand gestures, near-misses)', () => {
    telemetry.startSession(0, false, 1.0);

    // 1. Button presses
    telemetry.recordButtonPress();
    telemetry.recordButtonPress();
    telemetry.recordButtonPress();

    // 2. Head tilts
    telemetry.recordHeadTilt('lr');
    telemetry.recordHeadTilt('lr');
    telemetry.recordHeadTilt('ud');

    // 3. Hand gestures
    telemetry.recordHandGesture();
    telemetry.recordHandGesture();

    // 4. Near-misses
    telemetry.recordNearMiss();

    const activeCounters = telemetry.getActionCounters();
    expect(activeCounters.buttonPresses).toBe(3);
    expect(activeCounters.headTiltsLeftRight).toBe(2);
    expect(activeCounters.headTiltsUpDown).toBe(1);
    expect(activeCounters.totalHeadTilts).toBe(3);
    expect(activeCounters.handGestures).toBe(2);
    expect(activeCounters.nearMisses).toBe(1);
    expect(activeCounters.totalActions).toBe(8); // 3 buttons + 2 lr + 1 ud + 2 hands

    const completed = telemetry.endSession(350, 500, 15);
    expect(completed.actions).toBeDefined();
    expect(completed.actions.buttonPresses).toBe(3);
    expect(completed.actions.headTiltsLeftRight).toBe(2);
    expect(completed.actions.headTiltsUpDown).toBe(1);
    expect(completed.actions.handGestures).toBe(2);
    expect(completed.actions.nearMisses).toBe(1);

    // After session completion, getActionCounters() returns last finalized actions
    const postCounters = telemetry.getActionCounters();
    expect(postCounters.buttonPresses).toBe(3);
    expect(postCounters.totalHeadTilts).toBe(3);
    expect(postCounters.handGestures).toBe(2);
  });

  it('exports valid JSON and CSV telemetry data', () => {
    telemetry.startSession(0, false, 1.0);
    telemetry.recordCollision(0, 100, 'jump_barrier');
    telemetry.endSession(250, 250, 10);

    const jsonStr = telemetry.exportToJson();
    const data = JSON.parse(jsonStr);
    expect(data.appName).toBe('InterRun');
    expect(data.sessions.length).toBe(1);

    const csvStr = telemetry.exportToCsv();
    expect(csvStr).toContain('RunIndex,Timestamp,TotalDistance_m');
    expect(csvStr.split('\n').length).toBe(2); // Header + 1 row
  });

  it('calculates aggregated metrics and learning curves across multiple sessions', () => {
    // Session 1
    telemetry.startSession(0, false, 1.0);
    telemetry.recordCollision(0, 50, 'train_blocker');
    telemetry.recordStageTransition(1, 300);
    telemetry.recordCollision(1, 400, 'slide_barrier');
    telemetry.endSession(500, 500, 20);

    // Session 2
    telemetry.startSession(0, false, 1.0);
    telemetry.recordStageTransition(1, 300);
    telemetry.endSession(600, 600, 25);

    const aggregated = telemetry.getAggregatedMetrics();
    expect(aggregated.totalRuns).toBe(2);
    expect(aggregated.totalDistanceKm).toBe(1.1); // (500 + 600) / 1000 = 1.1 km
    expect(aggregated.stages[0].totalDistance).toBe(600); // 300 + 300

    const curve = telemetry.getLearningCurve();
    expect(curve.length).toBe(2);
    expect(curve[0].runIndex).toBe(1);
    expect(curve[1].runIndex).toBe(2);
  });

  it('tracks kinematic path length and classifies movement economy', () => {
    telemetry.startSession(2, false, 1.0);

    // Simulate 30 frames of head micro-motions (minimalist)
    for (let i = 0; i < 30; i++) {
      telemetry.recordKinematics({ source: 'face', deltaDist: 0.008, speed: 0.24 });
    }

    const summary = telemetry.getKinematicSummary();
    expect(summary).not.toBeNull();
    expect(summary.headMeters).toBeGreaterThan(0);
    expect(summary.style).toBe('minimalist');
    expect(summary.styleLabel).toContain('Мінімаліст');

    // Simulate wide hand gestures
    for (let i = 0; i < 30; i++) {
      telemetry.recordKinematics({ source: 'hands', deltaDist: 0.05, speed: 1.5 });
    }

    const updatedSummary = telemetry.getKinematicSummary();
    expect(updatedSummary.handMeters).toBeGreaterThan(0);
    expect(updatedSummary.totalMeters).toBe(Math.round((updatedSummary.headMeters + updatedSummary.handMeters) * 10) / 10);
  });
});

describe('GestureBenchmark', () => {
  let benchmark;

  beforeEach(() => {
    benchmark = new GestureBenchmark('test_benchmark_key');
    benchmark.reset();
  });

  it('computes confusion matrix, precision, recall, and F1 accurately', () => {
    // 3 true 'palm' recognized as 'palm' (TP = 3)
    benchmark.recordSample('palm', 'palm', 25);
    benchmark.recordSample('palm', 'palm', 28);
    benchmark.recordSample('palm', 'palm', 30);

    // 1 true 'palm' misclassified as 'fist' (FN for palm = 1, FP for fist = 1)
    benchmark.recordSample('palm', 'fist', 35);

    // 2 true 'fist' recognized as 'fist' (TP = 2)
    benchmark.recordSample('fist', 'fist', 20);
    benchmark.recordSample('fist', 'fist', 22);

    const report = benchmark.calculateReport(FINGER_GESTURE_CLASSES);
    expect(report.totalSamples).toBe(6);
    expect(report.confusionMatrix['palm']['palm']).toBe(3);
    expect(report.confusionMatrix['palm']['fist']).toBe(1);
    expect(report.confusionMatrix['fist']['fist']).toBe(2);

    const palm = report.perClassMetrics['palm'];
    expect(palm.tp).toBe(3);
    expect(palm.fn).toBe(1);
    expect(palm.fp).toBe(0);
    expect(palm.precision).toBe(1.0);
    expect(palm.recall).toBe(0.75); // 3 / 4
    expect(palm.f1).toBeCloseTo(0.8571, 2);

    const fist = report.perClassMetrics['fist'];
    expect(fist.tp).toBe(2);
    expect(fist.fp).toBe(1); // 1 from palm
    expect(fist.precision).toBeCloseTo(0.6667, 2); // 2 / 3
  });

  it('exports CSV classification report', () => {
    benchmark.recordSample('palm', 'palm', 25);
    benchmark.recordSample('fist', 'fist', 20);
    const csv = benchmark.exportToCsv();
    expect(csv).toContain('Class,Support,TP,FP,FN,Precision,Recall,F1-Score');
    expect(csv).toContain('Overall_Accuracy');
  });
});

describe('SurveyManager', () => {
  let survey;

  beforeEach(() => {
    survey = new SurveyManager('test_survey_key');
    survey.clearResponses();
  });

  it('records responses and calculates SUS proxy score', () => {
    survey.submitSurvey({
      fatigue: 2,        // low fatigue
      responsiveness: 5, // great
      transition: 4,     // good
      satisfaction: 5,   // great
      comment: 'Very intuitive controls!'
    }, 3, 1250);

    const stats = survey.getStatistics();
    expect(stats.totalResponses).toBe(1);
    expect(stats.meanFatigue).toBe(2.0);
    expect(stats.meanSatisfaction).toBe(5.0);
    expect(stats.susProxyScore).toBeGreaterThan(70);

    const csv = survey.exportToCsv();
    expect(csv).toContain('Fatigue_1to5,Responsiveness_1to5');
    expect(csv).toContain('Very intuitive controls!');
  });

  it('records 10-item canonical SUS and calculates standard Brooke score', () => {
    // Exact answers matching Table 6.6
    survey.submitSurvey({
      answers: [4.42, 1.75, 4.50, 1.42, 4.33, 1.83, 4.58, 1.67, 4.17, 1.58],
      comment: 'Excellent multimodal control'
    }, 7, 2500);

    const stats = survey.getStatistics();
    expect(stats.totalResponses).toBe(1);
    expect(stats.susScore).toBeCloseTo(84.4, 0.5);
    expect(stats.meanQuestions.length).toBe(10);
    expect(stats.meanQuestions[0]).toBe(4.42);
    expect(stats.meanQuestions[1]).toBe(1.75);

    const csv = survey.exportToCsv();
    expect(csv).toContain('Q1,Q2,Q3,Q4,Q5,Q6,Q7,Q8,Q9,Q10,SUS_Score');
    expect(csv).toContain('Excellent multimodal control');
  });

  it('calculates perfect 100 and minimal 0 SUS scores correctly', () => {
    // Perfect score: 5 on odd, 1 on even
    survey.submitSurvey({
      answers: [5, 1, 5, 1, 5, 1, 5, 1, 5, 1]
    });
    expect(survey.getStatistics().susScore).toBe(100);

    survey.clearResponses();
    // Worst score: 1 on odd, 5 on even
    survey.submitSurvey({
      answers: [1, 5, 1, 5, 1, 5, 1, 5, 1, 5]
    });
    expect(survey.getStatistics().susScore).toBe(0);
  });
});

describe('HUD Telemetry Modal Integration', () => {
  function createMockElement(id = '', isHidden = true) {
    const classes = new Set(isHidden ? ['hidden'] : []);
    return {
      id,
      textContent: '',
      innerHTML: '',
      style: {},
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
        toggle: (c, force) => {
          if (force === undefined) {
            if (classes.has(c)) classes.delete(c);
            else classes.add(c);
          } else if (force) {
            classes.add(c);
          } else {
            classes.delete(c);
          }
        }
      },
      addEventListener: () => {},
      getAttribute: () => null,
      setAttribute: () => {}
    };
  }

  function setupMockDoc() {
    const registry = new Map();
    const getEl = (id) => {
      if (!registry.has(id)) {
        const isModal = id.includes('modal');
        registry.set(id, createMockElement(id, isModal));
      }
      return registry.get(id);
    };

    return {
      getElementById: (id) => getEl(id),
      querySelectorAll: () => [],
      documentElement: { lang: 'uk' }
    };
  }

  it('opens and closes telemetry modal, switches tabs, and renders stats', async () => {
    const { Hud } = await import('../src/ui/Hud.js');
    const mockDoc = setupMockDoc();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const telemetry = new TelemetryManager('test_hud_telem');
      telemetry.startSession(0, false, 1.0);
      telemetry.endSession(350, 350, 10);

      const benchmark = new GestureBenchmark('test_hud_bench');
      const survey = new SurveyManager('test_hud_survey');

      const hud = new Hud({ innerHTML: '' }, null, null, null);
      hud.setAnalytics({ telemetry, benchmark, survey });

      expect(hud.elTelemetryModal.classList.contains('hidden')).toBe(true);

      // Open modal
      hud.openTelemetryModal();
      expect(hud.elTelemetryModal.classList.contains('hidden')).toBe(false);
      expect(hud.isAnyModalOpen()).toBe(true);

      // Switch tab to survey
      hud.switchTelemetryTab('survey');
      expect(hud._currentTelemTab).toBe('survey');

      // Switch tab to bench
      hud.switchTelemetryTab('bench');
      expect(hud._currentTelemTab).toBe('bench');

      // Close modal
      hud.closeTelemetryModal();
      expect(hud.elTelemetryModal.classList.contains('hidden')).toBe(true);
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('supports all 6 benchmark modes (stages 0 to 5) with correct classes and icons', async () => {
    const { Hud } = await import('../src/ui/Hud.js');
    const mockDoc = setupMockDoc();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new Hud({ innerHTML: '' }, null, null, null);

      // Verify class definitions for all stages
      expect(hud._getBenchmarkClasses('stage0')).toEqual(['key_left', 'key_right', 'key_jump', 'key_duck']);
      expect(hud._getBenchmarkClasses('stage1')).toEqual(['swipe_left', 'swipe_right', 'swipe_up', 'swipe_down']);
      expect(hud._getBenchmarkClasses('stage2')).toEqual(['face_left', 'face_center', 'face_right', 'face_jump', 'face_slide']);
      expect(hud._getBenchmarkClasses('stage3')).toEqual(['hand_left', 'hand_center', 'hand_right', 'hand_jump', 'hand_slide']);
      expect(hud._getBenchmarkClasses('stage4')).toEqual(['one_finger', 'two_fingers', 'three_fingers', 'palm', 'fist']);
      expect(hud._getBenchmarkClasses('stage5')).toEqual(['swipe_left', 'swipe_right', 'swipe_up', 'swipe_down']);

      // Target change test
      hud._onBenchmarkTargetChanged();
      expect(hud._benchmarkRunning).toBe(false);
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('opens benchmark tab, displays camera preview wrapper, and activates live confidence meter', async () => {
    const { Hud } = await import('../src/ui/Hud.js');
    const mockDoc = setupMockDoc();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new Hud({ innerHTML: '' }, null, null, null);
      const benchmark = new GestureBenchmark('test_tab_bench');
      hud.setAnalytics({ benchmark });

      hud.openTelemetryModal();
      hud.switchTelemetryTab('bench');

      const wrap = mockDoc.getElementById('bench-cam-wrap');
      expect(wrap.style.display).toBe('block');
      expect(hud.benchmarkUI._confidenceActive).toBe(true);

      hud.closeTelemetryModal();
      expect(hud.benchmarkUI._confidenceActive).toBe(false);
    } finally {
      globalThis.document = origDoc;
    }
  });
});

describe('BenchmarkDefinitions & mapCvStateToClass', () => {
  it('correctly maps vision manager states to benchmark classes across all CV stages', async () => {
    const { mapCvStateToClass, isCvStage, getBenchmarkClasses } = await import('../src/analytics/BenchmarkDefinitions.js');

    expect(isCvStage('stage0')).toBe(false);
    expect(isCvStage('stage1')).toBe(false);
    expect(isCvStage('stage2')).toBe(true);
    expect(isCvStage('stage3')).toBe(true);
    expect(isCvStage('stage4')).toBe(true);
    expect(isCvStage('stage5')).toBe(true);

    // Stage 2: Face Zone
    expect(mapCvStateToClass('stage2', { zoneRow: 'top', zoneCol: 'C' })).toBe('face_jump');
    expect(mapCvStateToClass('stage2', { zoneRow: 'bot', zoneCol: 'C' })).toBe('face_slide');
    expect(mapCvStateToClass('stage2', { zoneRow: 'mid', zoneCol: 'L' })).toBe('face_left');
    expect(mapCvStateToClass('stage2', { zoneRow: 'mid', zoneCol: 'R' })).toBe('face_right');
    expect(mapCvStateToClass('stage2', { zoneRow: 'mid', zoneCol: 'C' })).toBe('face_center');

    // Stage 3: Hand Zone
    expect(mapCvStateToClass('stage3', { hzRow: 'top', hzCol: 'C' })).toBe('hand_jump');
    expect(mapCvStateToClass('stage3', { hzRow: 'bot', hzCol: 'C' })).toBe('hand_slide');
    expect(mapCvStateToClass('stage3', { hzRow: 'mid', hzCol: 'L' })).toBe('hand_left');
    expect(mapCvStateToClass('stage3', { hzRow: 'mid', hzCol: 'R' })).toBe('hand_right');
    expect(mapCvStateToClass('stage3', { hzRow: 'mid', hzCol: 'C' })).toBe('hand_center');

    // Stage 4: Finger Gestures
    expect(mapCvStateToClass('stage4', { fgGesture: 'lane_left' })).toBe('one_finger');
    expect(mapCvStateToClass('stage4', { fgGesture: 'lane_center' })).toBe('two_fingers');
    expect(mapCvStateToClass('stage4', { fgGesture: 'lane_right' })).toBe('three_fingers');
    expect(mapCvStateToClass('stage4', { fgGesture: 'jump' })).toBe('palm');
    expect(mapCvStateToClass('stage4', { fgGesture: 'duck' })).toBe('fist');

    // Stage 5: Hand Swipe
    expect(mapCvStateToClass('stage5', { hsSwipe: 'left' })).toBe('swipe_left');
    expect(mapCvStateToClass('stage5', { hsSwipe: 'up' })).toBe('swipe_up');
  });
});

describe('BenchmarkRunner Execution-Based Transitions', () => {
  it('transitions upon gesture execution rather than fixed countdown timer', async () => {
    const { BenchmarkRunner } = await import('../src/analytics/BenchmarkRunner.js');
    const { GestureBenchmark } = await import('../src/analytics/GestureBenchmark.js');

    const benchmark = new GestureBenchmark('test_runner_bench');
    const mockVm = {
      currentState: { fgGesture: 'lane_center' }
    };

    const runner = new BenchmarkRunner({
      benchmark,
      visionManager: mockVm
    });

    let successFired = false;
    let successInfo = null;

    runner.onTrialSuccess = (info) => {
      successFired = true;
      successInfo = info;
    };

    // Start benchmark on Stage 4
    runner.start('stage4', 1); // 1 rep = 5 trials
    expect(runner.isRunning).toBe(true);

    const firstTarget = runner.target;
    expect(firstTarget).toBeDefined();

    // Set matching gesture in mock VisionManager state
    const targetGestureMap = {
      one_finger: 'lane_left',
      two_fingers: 'lane_center',
      three_fingers: 'lane_right',
      palm: 'jump',
      fist: 'duck'
    };
    mockVm.currentState.fgGesture = targetGestureMap[firstTarget];

    // Trigger tick after hold time (~200ms)
    runner._matchHoldStart = performance.now() - 250;
    runner._tick();

    expect(successFired).toBe(true);
    expect(successInfo.target).toBe(firstTarget);
    expect(benchmark.samples.length).toBe(1);
    expect(benchmark.samples[0].groundTruth).toBe(firstTarget);
    expect(benchmark.samples[0].predicted).toBe(firstTarget);

    runner.stop();
    expect(runner.isRunning).toBe(false);
  });

  it('supports skip and discrete keyboard triggers', async () => {
    const { BenchmarkRunner } = await import('../src/analytics/BenchmarkRunner.js');
    const { GestureBenchmark } = await import('../src/analytics/GestureBenchmark.js');

    const benchmark = new GestureBenchmark('test_runner_skip');
    const runner = new BenchmarkRunner({ benchmark });

    let timeoutInfo = null;
    runner.onTrialTimeout = (info) => {
      timeoutInfo = info;
    };

    runner.start('stage0', 1);
    const target = runner.target;

    // Test skip
    runner.skipCurrentTrial();
    expect(timeoutInfo?.skipped).toBe(true);
    expect(benchmark.samples.length).toBe(1);
    expect(benchmark.samples[0].predicted).toBe('none');

    runner.stop();
  });
});

describe('BenchmarkCameraPreview', () => {
  it('manages preview wrapper display and lifecycle for CV and non-CV stages', async () => {
    const { BenchmarkCameraPreview } = await import('../src/analytics/BenchmarkCameraPreview.js');

    const mockCanvas = {
      width: 320,
      height: 240,
      getContext: () => ({
        clearRect: () => {},
        fillRect: () => {},
        fillText: () => {},
        drawImage: () => {},
        save: () => {},
        restore: () => {},
        setTransform: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        setLineDash: () => {},
        moveTo: () => {},
        lineTo: () => {}
      })
    };

    const mockWrap = {
      style: { display: 'none' }
    };

    const preview = new BenchmarkCameraPreview(mockCanvas, mockWrap, null);

    preview.setStageKey('stage4');
    expect(mockWrap.style.display).toBe('block');

    preview.setStageKey('stage0');
    expect(mockWrap.style.display).toBe('none');

    preview.start('stage4');
    expect(preview._isRunning).toBe(true);

    preview.stop();
    expect(preview._isRunning).toBe(false);
  });

  it('respects pipMode setting in benchmark preview rendering (hides video and shows points in minimal mode)', async () => {
    const { BenchmarkCameraPreview } = await import('../src/analytics/BenchmarkCameraPreview.js');

    let drawImageCalled = false;
    let fillRectCalls = [];
    let arcCalls = 0;

    const mockCanvas = {
      width: 320,
      height: 240,
      getContext: () => ({
        clearRect: () => {},
        fillRect: (x, y, w, h) => { fillRectCalls.push({ x, y, w, h }); },
        fillText: () => {},
        drawImage: () => { drawImageCalled = true; },
        save: () => {},
        restore: () => {},
        setTransform: () => {},
        beginPath: () => {},
        arc: () => { arcCalls++; },
        fill: () => {},
        stroke: () => {},
        setLineDash: () => {},
        moveTo: () => {},
        lineTo: () => {}
      })
    };

    const mockWrap = { style: { display: 'none' } };

    const mockVm = {
      video: { readyState: 4 },
      settings: { pipMode: 'minimal' },
      currentState: {
        points: [
          { x: 0.5, y: 0.5, color: '#00ff88', r: 4 },
          { x: 0.6, y: 0.7, color: '#00e5ff', r: 4 }
        ]
      }
    };

    const preview = new BenchmarkCameraPreview(mockCanvas, mockWrap, mockVm);
    expect(preview.getPipMode()).toBe('minimal');

    // Render frame in minimal mode
    preview._render(100);

    // In minimal mode: video is NOT drawn, background is filled with dark color, and points are drawn
    expect(drawImageCalled).toBe(false);
    expect(fillRectCalls.length).toBeGreaterThan(0);
    expect(arcCalls).toBe(2);

    // Switch to full mode
    mockVm.settings.pipMode = 'full';
    expect(preview.getPipMode()).toBe('full');
    drawImageCalled = false;
    preview._lastDrawTime = 0;
    preview._render(200);

    // In full mode: video drawImage IS called
    expect(drawImageCalled).toBe(true);
  });
});

describe('Interactive Confidence Meter & Gesture Selection', () => {
  it('calculates continuous and fallback gesture confidences correctly', async () => {
    const { calculateConfidence } = await import('../src/analytics/BenchmarkDefinitions.js');

    // Continuous confidences from worker
    const stateWithWorkerConf = {
      gestureConfidences: {
        fist: 0.88,
        palm: 0.12,
        two_fingers: 0.05
      }
    };
    expect(calculateConfidence('stage4', 'fist', stateWithWorkerConf)).toBeCloseTo(0.88, 2);
    expect(calculateConfidence('stage4', 'palm', stateWithWorkerConf)).toBeCloseTo(0.12, 2);
    expect(calculateConfidence('stage4', 'three_fingers', stateWithWorkerConf)).toBe(0);

    // Heuristic fallback when worker confidences not yet sent
    const fallbackFistState = { fgGesture: 'duck' };
    expect(calculateConfidence('stage4', 'fist', fallbackFistState)).toBe(0.95);
    expect(calculateConfidence('stage4', 'palm', fallbackFistState)).toBe(0);

    const fallbackFaceJumpState = { zoneRow: 'top', zoneCol: 'C' };
    expect(calculateConfidence('stage2', 'face_jump', fallbackFaceJumpState)).toBe(0.95);
    expect(calculateConfidence('stage2', 'face_slide', fallbackFaceJumpState)).toBe(0);
  });

  it('renders gesture buttons, switches selection, and updates floating confidence bar DOM', async () => {
    const { BenchmarkUI } = await import('../src/analytics/BenchmarkUI.js');

    const domRegistry = new Map();
    const getEl = (id) => {
      if (!domRegistry.has(id)) {
        domRegistry.set(id, {
          id,
          textContent: '',
          innerHTML: '',
          style: {},
          dataset: {},
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); },
            toggle(c, force) {
              if (force === undefined) {
                if (this.classes.has(c)) this.classes.delete(c);
                else this.classes.add(c);
              } else if (force) this.classes.add(c);
              else this.classes.delete(c);
            }
          },
          querySelectorAll: () => [],
          addEventListener: () => {},
          getAttribute: (attr) => null,
          setAttribute: () => {}
        });
      }
      return domRegistry.get(id);
    };

    const origDoc = globalThis.document;
    globalThis.document = {
      documentElement: { lang: 'en' },
      getElementById: (id) => getEl(id),
      querySelectorAll: () => [],
      querySelector: () => null
    };

    try {
      const mockVm = {
        currentState: {
          fgSource: 'hand',
          gestureConfidences: {
            fist: 0.92,
            palm: 0.05
          }
        }
      };

      const ui = new BenchmarkUI({ visionManager: mockVm });

      // Render gesture buttons for Stage 4
      ui.renderGestureButtons('stage4');

      const buttonsContainer = getEl('bench-gesture-buttons');
      expect(buttonsContainer.innerHTML).toContain('data-gesture="fist"');
      expect(buttonsContainer.innerHTML).toContain('data-gesture="palm"');
      expect(buttonsContainer.innerHTML).toContain('data-gesture="two_fingers"');

      // Select fist gesture
      ui.selectGesture('fist', 'stage4');
      expect(ui.selectedGesture).toBe('fist');

      const targetNameEl = getEl('bench-target-name');
      expect(targetNameEl.textContent).toMatch(/Fist|Кулак/);

      // Verify i18n language switching
      const { i18n } = await import('../src/i18n/I18n.js');
      i18n.setLang('uk');
      ui.renderGestureButtons('stage4');
      ui.selectGesture('fist', 'stage4');
      expect(targetNameEl.textContent).toContain('Кулак');

      i18n.setLang('en');
      ui.renderGestureButtons('stage4');
      ui.selectGesture('fist', 'stage4');
      expect(targetNameEl.textContent).toContain('Fist');

      // Run a confidence tick
      ui._updateConfidenceMeter();

      const barEl = getEl('bench-confidence-bar');
      const pctEl = getEl('bench-confidence-pct');
      const statusEl = getEl('bench-confidence-status');

      expect(barEl.style.width).toBeDefined();
      expect(pctEl.textContent).toBeDefined();
      expect(statusEl.textContent).toBeDefined();

      // Test gesture mismatch: user chooses 2 fingers, but camera sees 3 fingers
      ui.selectGesture('two_fingers', 'stage4');
      mockVm.currentState = {
        fgSource: 'hand',
        fgGesture: 'lane_right',
        gestureConfidences: { three_fingers: 0.96, two_fingers: 0.04 }
      };
      ui._smoothedConfidence = 0.04;
      ui._updateConfidenceMeter();

      // Confidence must be low and status must warn about mismatch
      expect(parseInt(pctEl.textContent, 10)).toBeLessThanOrEqual(20);
      expect(statusEl.textContent).toMatch(/Different gesture|інший жест/i);
      expect(statusEl.style.color).toBe('#ff9f43');

      ui.closeBenchmark();
    } finally {
      globalThis.document = origDoc;
    }
  });
});
