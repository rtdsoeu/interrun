/**
 * GestureBenchmark — Calibration and empirical evaluation tool for InterRun gesture recognition.
 *
 * Evaluates:
 * - Confusion Matrix
 * - Class-level True Positives (TP), False Positives (FP), False Negatives (FN), True Negatives (TN)
 * - Precision, Recall, F1-Score, and overall Accuracy
 * - Supports Finger Gestures (Stage 4) and Hand Swipes (Stage 5)
 * - JSON and CSV export for scientific publications and thesis Section 5 & 6.
 */

export const FINGER_GESTURE_CLASSES = [
  'one_finger',   // Lane Left (-1)
  'two_fingers',  // Lane Center (0)
  'three_fingers',// Lane Right (+1)
  'palm',         // Jump (All 4 extended)
  'fist'          // Duck / Slide (0 extended)
];

export const HAND_SWIPE_CLASSES = [
  'swipe_left',
  'swipe_right',
  'swipe_up',
  'swipe_down',
  'none'
];

export class GestureBenchmark {
  constructor(storageKey = 'interrun_gesture_benchmarks') {
    this.storageKey = storageKey;
    this.samples = []; // Array of { groundTruth, predicted, latencyMs, timestamp }
  }

  _getStorage() {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  }

  reset() {
    this.samples = [];
  }

  /**
   * Adds a ground-truth vs predicted sample.
   * @param {string} groundTruth
   * @param {string} predicted
   * @param {number} latencyMs
   */
  recordSample(groundTruth, predicted, latencyMs = 0) {
    this.samples.push({
      groundTruth,
      predicted: predicted || 'none',
      latencyMs: Math.round(latencyMs),
      timestamp: Date.now()
    });
  }

  /**
   * Calculates complete confusion matrix and classification metrics.
   * @param {string[]} classList
   * @returns {Object} Complete classification report
   */
  calculateReport(classList = FINGER_GESTURE_CLASSES) {
    const total = this.samples.length;
    if (total === 0) {
      return {
        totalSamples: 0,
        accuracy: 0,
        macroPrecision: 0,
        macroRecall: 0,
        macroF1: 0,
        classes: classList,
        confusionMatrix: {},
        perClassMetrics: {}
      };
    }

    // Initialize confusion matrix
    const matrix = {};
    for (const c1 of classList) {
      matrix[c1] = {};
      for (const c2 of classList) {
        matrix[c1][c2] = 0;
      }
    }

    // Populate matrix
    let correctCount = 0;
    for (const s of this.samples) {
      const gt = matrix[s.groundTruth] ? s.groundTruth : classList[0];
      const pred = matrix[s.predicted] ? s.predicted : (classList.includes(s.predicted) ? s.predicted : classList[classList.length - 1]);
      if (matrix[gt] && matrix[gt][pred] !== undefined) {
        matrix[gt][pred]++;
      }
      if (s.groundTruth === s.predicted) {
        correctCount++;
      }
    }

    const accuracy = Number((correctCount / total).toFixed(4));
    const perClass = {};
    let sumPrecision = 0;
    let sumRecall = 0;
    let sumF1 = 0;

    for (const c of classList) {
      const tp = matrix[c]?.[c] || 0;

      // False positives: column sum excluding diagonal
      let fp = 0;
      for (const r of classList) {
        if (r !== c) fp += matrix[r]?.[c] || 0;
      }

      // False negatives: row sum excluding diagonal
      let fn = 0;
      for (const col of classList) {
        if (col !== c) fn += matrix[c]?.[col] || 0;
      }

      const tn = total - (tp + fp + fn);

      const precision = (tp + fp) > 0 ? Number((tp / (tp + fp)).toFixed(4)) : 0;
      const recall = (tp + fn) > 0 ? Number((tp / (tp + fn)).toFixed(4)) : 0;
      const f1 = (precision + recall) > 0 ? Number(((2 * precision * recall) / (precision + recall)).toFixed(4)) : 0;

      perClass[c] = {
        support: tp + fn,
        tp, fp, fn, tn,
        precision,
        recall,
        f1
      };

      sumPrecision += precision;
      sumRecall += recall;
      sumF1 += f1;
    }

    const nClasses = classList.length || 1;
    const macroPrecision = Number((sumPrecision / nClasses).toFixed(4));
    const macroRecall = Number((sumRecall / nClasses).toFixed(4));
    const macroF1 = Number((sumF1 / nClasses).toFixed(4));

    return {
      totalSamples: total,
      accuracy,
      macroPrecision,
      macroRecall,
      macroF1,
      classes: classList,
      confusionMatrix: matrix,
      perClassMetrics: perClass
    };
  }

  saveBenchmarkRun(name = 'default', classList = FINGER_GESTURE_CLASSES) {
    const report = this.calculateReport(classList);
    const storage = this._getStorage();
    if (!storage) return report;

    try {
      const existing = JSON.parse(storage.getItem(this.storageKey) || '[]');
      existing.push({
        name,
        timestamp: new Date().toISOString(),
        ...report
      });
      storage.setItem(this.storageKey, JSON.stringify(existing.slice(-20)));
    } catch {}

    return report;
  }

  exportToJson(classList = FINGER_GESTURE_CLASSES) {
    const report = this.calculateReport(classList);
    return JSON.stringify({
      benchmark: 'InterRun Gesture Recognition Evaluation',
      exportedAt: new Date().toISOString(),
      report,
      rawSamples: this.samples
    }, null, 2);
  }

  exportToCsv(classList = FINGER_GESTURE_CLASSES) {
    const report = this.calculateReport(classList);
    const lines = [
      'Class,Support,TP,FP,FN,Precision,Recall,F1-Score'
    ];

    for (const c of classList) {
      const m = report.perClassMetrics[c];
      if (m) {
        lines.push(`${c},${m.support},${m.tp},${m.fp},${m.fn},${m.precision},${m.recall},${m.f1}`);
      }
    }

    lines.push('');
    lines.push(`Overall_Accuracy,${report.accuracy}`);
    lines.push(`Macro_Precision,${report.macroPrecision}`);
    lines.push(`Macro_Recall,${report.macroRecall}`);
    lines.push(`Macro_F1,${report.macroF1}`);

    return lines.join('\n');
  }
}
