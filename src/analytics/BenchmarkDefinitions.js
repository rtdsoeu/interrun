/**
 * BenchmarkDefinitions — Static configurations, stage classes, icons, hints, and CV state mappers.
 */

import { i18n } from '../i18n/I18n.js';

export const BENCHMARK_CLASSES = {
  stage0: ['key_left', 'key_right', 'key_jump', 'key_duck'],
  stage1: ['swipe_left', 'swipe_right', 'swipe_up', 'swipe_down'],
  stage2: ['face_left', 'face_center', 'face_right', 'face_jump', 'face_slide'],
  stage3: ['hand_left', 'hand_center', 'hand_right', 'hand_jump', 'hand_slide'],
  stage4: ['one_finger', 'two_fingers', 'three_fingers', 'palm', 'fist'],
  stage5: ['swipe_left', 'swipe_right', 'swipe_up', 'swipe_down']
};

export const BENCHMARK_ICONS = {
  stage0: {
    key_left: '◀ [A] / [Left] (Ліворуч)',
    key_right: '▶ [D] / [Right] (Праворуч)',
    key_jump: '▲ [W] / [Space] (Стрибок)',
    key_duck: '▼ [S] / [Down] (Підкат)'
  },
  stage1: {
    swipe_left: '👈 Свайп Ліворуч',
    swipe_right: '👉 Свайп Праворуч',
    swipe_up: '👆 Свайп Вгору (Стрибок)',
    swipe_down: '👇 Свайп Вниз (Підкат)'
  },
  stage2: {
    face_left: '👤 Голова Ліворуч',
    face_center: '👤 Голова в Центрі',
    face_right: '👤 Голова Праворуч',
    face_jump: '👤 Голова Вгору (Стрибок)',
    face_slide: '👤 Голова Вниз (Підкат)'
  },
  stage3: {
    hand_left: '✋ Долоня Ліворуч',
    hand_center: '✋ Долоня в Центрі',
    hand_right: '✋ Долоня Праворуч',
    hand_jump: '✋ Долоня Вгору (Стрибок)',
    hand_slide: '✋ Долоня Вниз (Підкат)'
  },
  stage4: {
    one_finger: '☝️ 1 Палець (Ліворуч)',
    two_fingers: '✌️ 2 Пальці (Центр)',
    three_fingers: '🤟 3 Пальці (Праворуч)',
    palm: '🖐️ Відкрита долоня (Стрибок)',
    fist: '✊ Кулак (Підкат)'
  },
  stage5: {
    swipe_left: '👈 Змах Ліворуч',
    swipe_right: '👉 Змах Праворуч',
    swipe_up: '👆 Змах Вгору',
    swipe_down: '👇 Змах Вниз'
  }
};

export const BENCHMARK_BUTTON_LABELS = {
  stage0: {
    key_left: '◀ Ліворуч [A]',
    key_right: '▶ Праворуч [D]',
    key_jump: '▲ Стрибок [W]',
    key_duck: '▼ Підкат [S]'
  },
  stage1: {
    swipe_left: '👈 Свайп Ліворуч',
    swipe_right: '👉 Свайп Праворуч',
    swipe_up: '👆 Свайп Вгору',
    swipe_down: '👇 Свайп Вниз'
  },
  stage2: {
    face_left: '👤 Ліворуч',
    face_center: '👤 Центр',
    face_right: '👤 Праворуч',
    face_jump: '👤 Стрибок',
    face_slide: '👤 Підкат'
  },
  stage3: {
    hand_left: '✋ Ліворуч',
    hand_center: '✋ Центр',
    hand_right: '✋ Праворуч',
    hand_jump: '✋ Стрибок',
    hand_slide: '✋ Підкат'
  },
  stage4: {
    fist: '✊ Кулак',
    palm: '🖐️ Долоня',
    one_finger: '☝️ 1 палець',
    two_fingers: '✌️ 2 пальці',
    three_fingers: '🤟 3 пальці'
  },
  stage5: {
    swipe_left: '👈 Змах Ліворуч',
    swipe_right: '👉 Змах Праворуч',
    swipe_up: '👆 Змах Вгору',
    swipe_down: '👇 Змах Вниз'
  }
};

export const BENCHMARK_HINTS = {
  stage0: 'Натискайте клавіші на клавіатурі під час тесту (A/D, W, S, стрілки)',
  stage1: 'Свайпайте мишею або пальцем по картці в заданому напрямку',
  stage2: 'Рухайте головою/обличчям у сітці 3×3 перед вебкамерою',
  stage3: 'Переміщуйте долоню в сітці 3×3 перед вебкамерою',
  stage4: 'Показуйте пальці, долоню або кулак перед вебкамерою',
  stage5: 'Робіть швидкі змахи рукою в повітрі перед вебкамерою'
};

export const STAGE_CV_MODES = {
  stage2: 'zone',
  stage3: 'handzone',
  stage4: 'fingergesture',
  stage5: 'handswipe'
};

export function isCvStage(stageKey) {
  return Boolean(STAGE_CV_MODES[stageKey]);
}

export function getBenchmarkClasses(stageKey) {
  return BENCHMARK_CLASSES[stageKey] || BENCHMARK_CLASSES.stage4;
}

export function getBenchmarkIcons(stageKey) {
  const baseIcons = BENCHMARK_ICONS[stageKey] || BENCHMARK_ICONS.stage4;
  const result = {};
  for (const [key, fallback] of Object.entries(baseIcons)) {
    const i18nKey = `telemetry.bench.gesture.${key}`;
    const translated = i18n?.t?.(i18nKey);
    result[key] = (translated && translated !== i18nKey) ? translated : fallback;
  }
  return result;
}

export function getBenchmarkButtonLabels(stageKey) {
  const baseLabels = BENCHMARK_BUTTON_LABELS[stageKey] || BENCHMARK_BUTTON_LABELS.stage4;
  const result = {};
  for (const [key, fallback] of Object.entries(baseLabels)) {
    const i18nKey = `telemetry.bench.gesture.${key}`;
    const translated = i18n?.t?.(i18nKey);
    result[key] = (translated && translated !== i18nKey) ? translated : fallback;
  }
  return result;
}

export function getBenchmarkHints(stageKey) {
  const i18nKey = `telemetry.bench.hint.${stageKey}`;
  const translated = i18n?.t?.(i18nKey);
  if (translated && translated !== i18nKey) return translated;
  return BENCHMARK_HINTS[stageKey] || BENCHMARK_HINTS.stage4;
}

export function getModeForStage(stageKey) {
  return STAGE_CV_MODES[stageKey] || 'fingergesture';
}

/**
 * Computes or retrieves continuous confidence (0.0 .. 1.0) for a given class.
 * @param {string} stageKey
 * @param {string} targetClass
 * @param {Object} st VisionManager.currentState
 * @returns {number} 0.0 .. 1.0
 */
export function calculateConfidence(stageKey, targetClass, st) {
  if (!st) return 0;

  const detected = mapCvStateToClass(stageKey, st);

  // 1. If worker already populated continuous confidences, use it
  if (st.gestureConfidences && typeof st.gestureConfidences[targetClass] === 'number') {
    const raw = Math.max(0, Math.min(1, st.gestureConfidences[targetClass]));
    if (detected !== 'none' && detected !== targetClass) {
      return Math.min(raw, 0.15);
    }
    return raw;
  }

  // 2. Fallback heuristic from state flags
  if (detected === targetClass) return 0.95;

  return 0;
}

/**
 * Maps VisionManager state to benchmark class name for a given CV stage.
 * @param {string} stageKey
 * @param {Object} st VisionManager.currentState
 * @returns {string} Detected class or 'none'
 */
export function mapCvStateToClass(stageKey, st) {
  if (!st) return 'none';

  if (stageKey === 'stage2') {
    if (st.zoneRow === 'top') return 'face_jump';
    if (st.zoneRow === 'bot') return 'face_slide';
    if (st.zoneCol === 'L') return 'face_left';
    if (st.zoneCol === 'R') return 'face_right';
    if (st.zoneCol === 'C') return 'face_center';
  } else if (stageKey === 'stage3') {
    if (st.hzRow === 'top') return 'hand_jump';
    if (st.hzRow === 'bot') return 'hand_slide';
    if (st.hzCol === 'L') return 'hand_left';
    if (st.hzCol === 'R') return 'hand_right';
    if (st.hzCol === 'C') return 'hand_center';
  } else if (stageKey === 'stage4') {
    const fg = st.fgGesture;
    if (fg === 'lane_left') return 'one_finger';
    if (fg === 'lane_center') return 'two_fingers';
    if (fg === 'lane_right') return 'three_fingers';
    if (fg === 'jump') return 'palm';
    if (fg === 'duck') return 'fist';
  } else if (stageKey === 'stage5') {
    if (st.hsSwipe) return `swipe_${st.hsSwipe}`;
  }

  return 'none';
}
