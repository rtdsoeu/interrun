/**
 * UI HTML Templates for InterRun HUD and Modals.
 * Extracted from HUD.js to maintain modularity, readability, and clean architecture.
 */
import { RADIO_STATIONS } from '../audio/MusicPlayer.js';

export function getHUDHtml(t, i18n, state = {}) {
  const isMuted = !!state.soundMuted;
  const currentRadio = state.radioStation || 'nightride';

  return `
    <!-- HUD Во время игры -->
    <div id="hud" class="hidden">
      <div id="hud-top">
        <div class="hud-panel hud-dist-panel">
          <div class="hud-label">${t('hud.distance')}</div>
          <div class="hud-value"><span id="hud-dist">0</span><span class="unit">m</span></div>
        </div>

        <div id="hud-top-right">
          <!-- Stats: coins, stage, fps -->
          <div id="hud-stats-group">
            <div class="hud-panel hud-coin-panel">
              <span class="hud-coin-icon">🪙</span>
              <div class="hud-value hud-coin-val" id="hud-coins">0</div>
            </div>

            <div id="stage-badge">${t('stage.0.badge')}</div>

            <div class="hud-panel hud-fps-panel">
              <span id="hud-fps" class="hud-fps-num">60</span>
              <span class="hud-fps-label">FPS</span>
            </div>

            <div class="hud-panel hud-cv-panel" id="hud-cv-panel" style="display:none;">
              <span style="font-size:13px;">👁️</span>
              <span id="hud-cv-fps" class="hud-cv-num">--</span>
              <span class="hud-fps-label">CV</span>
            </div>
          </div>

          <!-- Action buttons -->
          <div id="hud-actions-group" data-no-swipe="true">
            <button id="btn-toggle-cam" class="hud-panel hud-btn" data-no-swipe="true" title="${t('hud.camera')}">
              <span class="hud-btn-icon">📹</span>
              <span class="hud-btn-text" data-i18n="hud.camera">${t('hud.camera')}</span>
            </button>

            <button id="btn-hud-settings" class="hud-panel hud-btn" data-no-swipe="true" title="${t('hud.settings')}">
              <span class="hud-btn-icon">⚙️</span>
              <span class="hud-btn-text" data-i18n="hud.settings">${t('hud.settings')}</span>
            </button>

            <button id="btn-skin-modal" class="hud-panel hud-btn" data-no-swipe="true" title="${t('hud.skins')}">
              <span class="hud-btn-icon">🎨</span>
              <span class="hud-btn-text" data-i18n="hud.skins">${t('hud.skins')}</span>
            </button>

            <button id="btn-debug-hud" class="hud-panel hud-btn hud-btn-debug" data-no-swipe="true" title="${t('hud.debug')}">
              <span class="hud-btn-icon">🛠️</span>
              <span class="hud-btn-text" data-i18n="hud.debug">${t('hud.debug')}</span>
            </button>

            <button id="btn-toggle-sound" class="hud-panel hud-btn" data-no-swipe="true" title="${t('hud.sound')}">
              <span class="hud-btn-icon" id="hud-sound-icon">${isMuted ? '🔇' : '🔊'}</span>
              <span class="hud-btn-text" data-i18n="hud.sound">${t('hud.sound')}</span>
            </button>

            <button id="btn-hud-menu" class="hud-panel hud-btn hud-btn-menu" data-no-swipe="true" title="${t('hud.menu')}">
              <span class="hud-btn-icon">🏠</span>
              <span class="hud-btn-text" data-i18n="hud.menu">${t('hud.menu')}</span>
            </button>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div id="lives-container" style="display:flex; align-items:center; gap:10px;">
          <div id="lives-row">
            <div class="life-dot" id="life-1"></div>
            <div class="life-dot" id="life-2"></div>
            <div class="life-dot" id="life-3"></div>
          </div>
          <div id="god-badge" class="god-badge hidden">
            <span data-i18n="hud.immortal">${t('hud.immortal')}</span>
          </div>
        </div>

        <div id="speed-bar-wrap" style="width:160px;">
          <span style="font-size:10px; font-weight:700; color:rgba(255,255,255,0.4);" data-i18n="hud.speed">${t('hud.speed')}</span>
          <div id="speed-bar-bg">
            <div id="speed-bar-fill"></div>
          </div>
        </div>
      </div>

      <div id="control-hint" class="visible">${t('stage.0.hint')}</div>

      <!-- PIP вебкамеры -->
      <div id="webcam-pip" class="hidden" style="position:fixed; bottom:20px; right:20px; width:200px; height:150px; background:rgba(0,0,0,0.85); border:1px solid rgba(0,229,255,0.4); border-radius:12px; overflow:hidden; z-index:40; pointer-events:all; box-shadow:0 8px 32px rgba(0,0,0,0.6);">
        <canvas id="webcam-canvas" style="width:100%; height:100%; object-fit:cover; display:block;"></canvas>
        <div id="webcam-fps-badge" style="position:absolute; top:6px; right:6px; font-size:10px; font-weight:800; color:#00e5ff; background:rgba(0,0,0,0.7); border:1px solid rgba(0,229,255,0.4); border-radius:6px; padding:2px 6px; font-family:monospace; pointer-events:none;">-- FPS</div>
        <div id="webcam-status" style="position:absolute; bottom:4px; left:6px; right:6px; font-size:9px; font-weight:700; color:#00e5ff; text-transform:uppercase; letter-spacing:1px; text-shadow:0 1px 3px #000; text-align:center;" data-i18n="hud.cam.active">${t('hud.cam.active')}</div>
      </div>

      <!-- Баннер обратного отсчёта до смены этапа -->
      <div id="stage-countdown-banner" class="hidden" style="position:fixed; top:72px; left:50%; transform:translateX(-50%); z-index:50; pointer-events:none; display:flex; flex-direction:column; align-items:center;">
        <div style="background:rgba(10,15,30,0.94); border:1px solid rgba(0,229,255,0.6); box-shadow:0 8px 32px rgba(0,0,0,0.8), 0 0 24px rgba(0,229,255,0.3); border-radius:18px; padding:10px 24px; display:flex; align-items:center; gap:16px; backdrop-filter:blur(12px);">
          <div style="position:relative; width:46px; height:46px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg style="position:absolute; inset:0; width:100%; height:100%; transform:rotate(-90deg);" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9155" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="3"></circle>
              <circle id="transition-timer-circle" cx="18" cy="18" r="15.9155" fill="none" stroke="#00e5ff" stroke-width="3" stroke-dasharray="100, 100" stroke-dashoffset="0" stroke-linecap="round"></circle>
            </svg>
            <span id="transition-timer-num" style="font-size:15px; font-weight:900; color:#00e5ff; font-family:monospace;">3.5</span>
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:10px; font-weight:800; letter-spacing:2px; text-transform:uppercase; color:#ffd700;" data-i18n="transition.switching">${t('transition.switching')}</span>
              <span id="transition-next-badge" style="background:rgba(0,229,255,0.18); border:1px solid rgba(0,229,255,0.5); border-radius:6px; padding:2px 8px; font-size:11px; font-weight:800; color:#00e5ff;">STAGE 2</span>
            </div>
            <div id="transition-next-hint" style="font-size:12px; font-weight:600; color:rgba(255,255,255,0.9); margin-top:3px;">...</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Анонс нового этапа -->
    <div id="stage-transition">
      <div id="stage-announce">
        <span id="stage-title">${t('stage.1.title')}</span>
        <span class="sub" id="stage-desc">${t('stage.1.desc')}</span>
      </div>
    </div>

    <!-- Главное меню -->
    <div id="menu">
      <h1 class="menu-title">INTERRUN</h1>
      <div class="menu-sub" data-i18n="menu.subtitle">${t('menu.subtitle')}</div>
      <div class="menu-buttons">
        <button id="btn-play" class="btn btn-primary" data-i18n="menu.play">${t('menu.play')}</button>
        <button id="btn-open-settings" class="btn btn-ghost" style="border-color:rgba(255,255,255,0.25);" data-i18n="menu.settings">${t('menu.settings')}</button>
        <button id="btn-debug-menu" class="btn btn-ghost" style="border-color:rgba(0,229,255,0.4); color:var(--accent);" data-i18n="menu.debug">${t('menu.debug')}</button>
        <button id="btn-open-skins" class="btn btn-ghost" data-i18n="menu.skins">${t('menu.skins')}</button>
      </div>

      <!-- Переключатель языка -->
      <div id="lang-switcher" style="display:flex; gap:8px; justify-content:center; margin-top:12px;">
        <button class="lang-btn ${i18n.lang === 'en' ? 'active' : ''}" data-lang="en">🇬🇧 EN</button>
        <button class="lang-btn ${i18n.lang === 'ru' ? 'active' : ''}" data-lang="ru">🇷🇺 RU</button>
        <button class="lang-btn ${i18n.lang === 'uk' ? 'active' : ''}" data-lang="uk">🇺🇦 UA</button>
      </div>

      <div class="menu-stages">
        <div class="stage-chip active">0: ${t('stage.0.name')}</div>
        <div class="stage-chip">1: ${t('stage.1.name')}</div>
        <div class="stage-chip" style="border-color:rgba(108,99,255,0.5); color:#a89cff;">2: ${t('stage.2.name')} 🎯</div>
        <div class="stage-chip" style="border-color:rgba(0,255,136,0.5); color:#00ff88;">3: ${t('stage.3.name')} ✋</div>
        <div class="stage-chip" style="border-color:rgba(255,107,53,0.5); color:#ff6b35;">4: ${t('stage.4.name')} ✌️</div>
        <div class="stage-chip" style="border-color:rgba(255,215,0,0.5); color:#ffd700;">5: ${t('stage.5.name')} 👋</div>
      </div>
    </div>

    <!-- Game Over -->
    <div id="death-screen">
      <div class="death-title" data-i18n="death.title">${t('death.title')}</div>
      <div class="death-score-label" data-i18n="death.dist.label">${t('death.dist.label')}</div>
      <div class="death-score-value"><span id="death-dist">0</span> <span style="font-size:24px; font-weight:400; color:rgba(255,255,255,0.5);">m</span></div>
      <div class="death-best">
        <span data-i18n="death.best">${t('death.best')}</span> <span id="death-best">0</span> m
        &nbsp;•&nbsp;
        <span data-i18n="death.coins">${t('death.coins')}</span> <span id="death-coins">0</span>
      </div>
      <div class="death-buttons">
        <button id="btn-restart" class="btn btn-primary" data-i18n="death.restart">${t('death.restart')}</button>
        <button id="btn-debug-restart" class="btn btn-ghost" style="border-color:rgba(0,229,255,0.4); color:var(--accent);" data-i18n="death.debug">${t('death.debug')}</button>
      </div>
    </div>

    <!-- Гардероб & Темы -->
    <div id="skin-modal" class="hidden" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(16px); z-index:100; display:flex; align-items:center; justify-content:center; pointer-events:all;">
      <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:20px; padding:32px; width:90%; max-width:580px; display:flex; flex-direction:column; gap:22px; color:#fff;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h2 style="font-size:24px; font-weight:800; letter-spacing:-0.5px;" data-i18n="skins.title">${t('skins.title')}</h2>
          <button id="btn-close-modal" style="background:none; border:none; color:rgba(255,255,255,0.6); font-size:24px; cursor:pointer;">✕</button>
        </div>

        <div>
          <div style="font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--accent); margin-bottom:10px;" data-i18n="skins.themes">${t('skins.themes')}</div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">
            <button class="theme-select-btn btn-ghost" data-theme="cyber_metro" style="padding:12px; font-size:13px; border-radius:12px; cursor:pointer;" data-i18n="theme.cyber_metro">${t('theme.cyber_metro')}</button>
            <button class="theme-select-btn btn-ghost" data-theme="sunset_canyon" style="padding:12px; font-size:13px; border-radius:12px; cursor:pointer;" data-i18n="theme.sunset_canyon">${t('theme.sunset_canyon')}</button>
            <button class="theme-select-btn btn-ghost" data-theme="neon_forest" style="padding:12px; font-size:13px; border-radius:12px; cursor:pointer;" data-i18n="theme.neon_forest">${t('theme.neon_forest')}</button>
          </div>
        </div>

        <div>
          <div style="font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--accent2); margin-bottom:10px;" data-i18n="skins.chars">${t('skins.chars')}</div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">
            <button class="skin-select-btn btn-ghost" data-skin="cyber_neon" style="padding:12px; font-size:13px; border-radius:12px; cursor:pointer;" data-i18n="skin.cyber_neon">${t('skin.cyber_neon')}</button>
            <button class="skin-select-btn btn-ghost" data-skin="subway_graffiti" style="padding:12px; font-size:13px; border-radius:12px; cursor:pointer;" data-i18n="skin.subway_graffiti">${t('skin.subway_graffiti')}</button>
            <button class="skin-select-btn btn-ghost" data-skin="shadow_shinobi" style="padding:12px; font-size:13px; border-radius:12px; cursor:pointer;" data-i18n="skin.shadow_shinobi">${t('skin.shadow_shinobi')}</button>
          </div>
        </div>

        <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:14px; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:12px; color:rgba(255,255,255,0.5);" data-i18n="skins.info">${t('skins.info')}</div>
          <button id="btn-modal-apply" class="btn btn-primary" style="padding:10px 24px; font-size:14px;" data-i18n="skins.apply">${t('skins.apply')}</button>
        </div>
      </div>
    </div>

    <!-- Debug Modal -->
    <div id="debug-modal" class="hidden" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(16px); z-index:110; display:flex; align-items:center; justify-content:center; pointer-events:all;">
      <div style="background:rgba(20,24,36,0.95); border:1px solid rgba(0,229,255,0.3); box-shadow:0 16px 48px rgba(0,0,0,0.8), 0 0 30px rgba(0,229,255,0.15); border-radius:20px; padding:28px; width:92%; max-width:520px; display:flex; flex-direction:column; gap:18px; color:#fff;">

        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:22px; font-weight:800; color:var(--accent); display:flex; align-items:center; gap:8px;">
              <span data-i18n="debug.title">${t('debug.title')}</span>
            </div>
            <div style="font-size:12px; color:rgba(255,255,255,0.5); margin-top:2px;" data-i18n="debug.subtitle">${t('debug.subtitle')}</div>
          </div>
          <button id="btn-close-debug" style="background:none; border:none; color:rgba(255,255,255,0.6); font-size:24px; cursor:pointer;">✕</button>
        </div>

        <!-- Выбор этапа -->
        <div>
          <div style="font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--accent); margin-bottom:8px;" data-i18n="debug.stage.sel">${t('debug.stage.sel')}</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px;" id="debug-stage-selector">
            <button class="debug-stage-btn btn-ghost selected" data-stage="0" style="padding:10px; font-size:12px; border-radius:10px; cursor:pointer; text-align:left;">
              <div style="font-weight:700; color:#fff;">[0] ⌨️ ${t('stage.0.name')}</div>
              <div style="font-size:10px; color:rgba(255,255,255,0.5);" data-i18n="debug.stage.0.sub">${t('debug.stage.0.sub')}</div>
            </button>
            <button class="debug-stage-btn btn-ghost" data-stage="1" style="padding:10px; font-size:12px; border-radius:10px; cursor:pointer; text-align:left;">
              <div style="font-weight:700; color:#fff;">[1] 👆 ${t('stage.1.name')}</div>
              <div style="font-size:10px; color:rgba(255,255,255,0.5);" data-i18n="debug.stage.1.sub">${t('debug.stage.1.sub')}</div>
            </button>
            <button class="debug-stage-btn btn-ghost" data-stage="2" style="padding:10px; font-size:12px; border-radius:10px; cursor:pointer; text-align:left; border-color:rgba(108,99,255,0.4);">
              <div style="font-weight:700; color:#a89cff;">[2] 🎯 ${t('stage.2.name')}</div>
              <div style="font-size:10px; color:rgba(168,156,255,0.6);" data-i18n="debug.stage.2.sub">${t('debug.stage.2.sub')}</div>
            </button>
            <button class="debug-stage-btn btn-ghost" data-stage="3" style="padding:10px; font-size:12px; border-radius:10px; cursor:pointer; text-align:left; border-color:rgba(0,255,136,0.4);">
              <div style="font-weight:700; color:#00ff88;">[3] ✋ ${t('stage.3.name')}</div>
              <div style="font-size:10px; color:rgba(0,255,136,0.6);" data-i18n="debug.stage.3.sub">${t('debug.stage.3.sub')}</div>
            </button>
            <button class="debug-stage-btn btn-ghost" data-stage="4" style="padding:10px; font-size:12px; border-radius:10px; cursor:pointer; text-align:left; border-color:rgba(255,107,53,0.4);">
              <div style="font-weight:700; color:#ff6b35;">[4] ✌️ ${t('stage.4.name')}</div>
              <div style="font-size:10px; color:rgba(255,107,53,0.6);" data-i18n="debug.stage.4.sub">${t('debug.stage.4.sub')}</div>
            </button>
            <button class="debug-stage-btn btn-ghost" data-stage="5" style="padding:10px; font-size:12px; border-radius:10px; cursor:pointer; text-align:left; border-color:rgba(255,215,0,0.4);">
              <div style="font-weight:700; color:#ffd700;">[5] 👋 ${t('stage.5.name')}</div>
              <div style="font-size:10px; color:rgba(255,215,0,0.6);" data-i18n="debug.stage.5.sub">${t('debug.stage.5.sub')}</div>
            </button>
          </div>
        </div>

        <!-- Выбор скорости (Speed Multiplier) -->
        <div>
          <div style="font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#00ff88; margin-bottom:8px;" data-i18n="debug.speed.sel">${t('debug.speed.sel')}</div>
          <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px;" id="debug-speed-selector">
            <button class="debug-speed-btn btn-ghost" data-speed="0.5" style="padding:8px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
              <div style="font-weight:700;">0.5x</div>
              <div style="font-size:9px; color:rgba(255,255,255,0.5);" data-i18n="debug.speed.slow">${t('debug.speed.slow')}</div>
            </button>
            <button class="debug-speed-btn btn-ghost" data-speed="0.75" style="padding:8px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
              <div style="font-weight:700;">0.75x</div>
              <div style="font-size:9px; color:rgba(255,255,255,0.5);" data-i18n="debug.speed.easy">${t('debug.speed.easy')}</div>
            </button>
            <button class="debug-speed-btn btn-ghost selected" data-speed="1.0" style="padding:8px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
              <div style="font-weight:700;">1.0x</div>
              <div style="font-size:9px; color:rgba(255,255,255,0.5);" data-i18n="debug.speed.norm">${t('debug.speed.norm')}</div>
            </button>
            <button class="debug-speed-btn btn-ghost" data-speed="1.35" style="padding:8px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
              <div style="font-weight:700;">1.35x</div>
              <div style="font-size:9px; color:rgba(255,255,255,0.5);" data-i18n="debug.speed.fast">${t('debug.speed.fast')}</div>
            </button>
            <button class="debug-speed-btn btn-ghost" data-speed="1.75" style="padding:8px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
              <div style="font-weight:700;">1.75x</div>
              <div style="font-size:9px; color:rgba(255,255,255,0.5);" data-i18n="debug.speed.turbo">${t('debug.speed.turbo')}</div>
            </button>
          </div>
        </div>

        <!-- Опции -->
        <div style="display:flex; flex-direction:column; gap:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:14px 18px;">
          <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; user-select:none;">
            <div>
              <div style="font-size:14px; font-weight:700; color:#fff;" data-i18n="debug.lock.label">${t('debug.lock.label')}</div>
              <div style="font-size:11px; color:rgba(255,255,255,0.5);" data-i18n="debug.lock.sub">${t('debug.lock.sub')}</div>
            </div>
            <input type="checkbox" id="debug-opt-lock" checked style="width:20px; height:20px; accent-color:var(--accent); cursor:pointer;">
          </label>

          <div style="height:1px; background:rgba(255,255,255,0.06);"></div>

          <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; user-select:none;">
            <div>
              <div style="font-size:14px; font-weight:700; color:#ffd700;" data-i18n="debug.god.label">${t('debug.god.label')}</div>
              <div style="font-size:11px; color:rgba(255,255,255,0.5);" data-i18n="debug.god.sub">${t('debug.god.sub')}</div>
            </div>
            <input type="checkbox" id="debug-opt-god" checked style="width:20px; height:20px; accent-color:#ffd700; cursor:pointer;">
          </label>
        </div>

        <!-- Подсказка горячих клавиш -->
        <div style="font-size:11px; color:rgba(255,255,255,0.5); line-height:1.7; background:rgba(0,229,255,0.04); border:1px solid rgba(0,229,255,0.12); border-radius:10px; padding:10px 14px;">
          <span data-i18n="debug.hotkeys">${t('debug.hotkeys')}</span>
        </div>

        <!-- Кнопки действий -->
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
          <button id="btn-debug-live-apply" class="btn btn-ghost" style="padding:10px 16px; font-size:13px; border-color:rgba(0,229,255,0.3);" data-i18n="debug.apply">
            ${t('debug.apply')}
          </button>
          <button id="btn-debug-launch-exec" class="btn btn-primary" style="padding:12px 28px; font-size:14px; background:linear-gradient(135deg, #00e5ff, #0088ff); border:none; box-shadow:0 4px 20px rgba(0,229,255,0.4);" data-i18n="debug.launch">
            ${t('debug.launch')}
          </button>
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <div id="settings-modal" class="hidden" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(16px); z-index:115; display:flex; align-items:center; justify-content:center; pointer-events:all;">
      <div style="background:rgba(20,24,36,0.95); border:1px solid rgba(0,229,255,0.3); box-shadow:0 16px 48px rgba(0,0,0,0.8), 0 0 30px rgba(0,229,255,0.15); border-radius:20px; padding:28px; width:92%; max-width:540px; display:flex; flex-direction:column; gap:18px; color:#fff;">

        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:22px; font-weight:800; color:var(--accent); display:flex; align-items:center; gap:8px;">
              <span data-i18n="settings.title">${t('settings.title')}</span>
            </div>
            <div style="font-size:12px; color:rgba(255,255,255,0.5); margin-top:2px;" data-i18n="settings.subtitle">${t('settings.subtitle')}</div>
          </div>
          <button id="btn-close-settings" style="background:none; border:none; color:rgba(255,255,255,0.6); font-size:24px; cursor:pointer;">✕</button>
        </div>

        <!-- Разрешение нейросети (CV Resolution) -->
        <div>
          <div style="font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--accent); margin-bottom:8px;" data-i18n="settings.cv_res">${t('settings.cv_res')}</div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;" id="settings-res-group">
            <button class="setting-opt-btn btn-ghost" data-group="resolution" data-val="eco" style="padding:10px 6px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
              <div style="font-weight:700;" data-i18n="settings.cv_res.eco">${t('settings.cv_res.eco')}</div>
            </button>
            <button class="setting-opt-btn btn-ghost" data-group="resolution" data-val="balanced" style="padding:10px 6px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
              <div style="font-weight:700;" data-i18n="settings.cv_res.balanced">${t('settings.cv_res.balanced')}</div>
            </button>
            <button class="setting-opt-btn btn-ghost" data-group="resolution" data-val="high" style="padding:10px 6px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
              <div style="font-weight:700;" data-i18n="settings.cv_res.high">${t('settings.cv_res.high')}</div>
            </button>
          </div>
        </div>

        <!-- Целевой FPS нейросети (Target FPS) -->
        <div>
          <div style="font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#ffd700; margin-bottom:8px;" data-i18n="settings.cv_fps">${t('settings.cv_fps')}</div>
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;" id="settings-fps-group">
            <button class="setting-opt-btn btn-ghost" data-group="targetFps" data-val="20" style="padding:10px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
              <div style="font-weight:700;" data-i18n="settings.cv_fps.20">${t('settings.cv_fps.20')}</div>
            </button>
            <button class="setting-opt-btn btn-ghost" data-group="targetFps" data-val="30" style="padding:10px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
              <div style="font-weight:700;" data-i18n="settings.cv_fps.30">${t('settings.cv_fps.30')}</div>
            </button>
            <button class="setting-opt-btn btn-ghost" data-group="targetFps" data-val="45" style="padding:10px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
              <div style="font-weight:700;" data-i18n="settings.cv_fps.45">${t('settings.cv_fps.45')}</div>
            </button>
            <button class="setting-opt-btn btn-ghost" data-group="targetFps" data-val="60" style="padding:10px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
              <div style="font-weight:700;" data-i18n="settings.cv_fps.60">${t('settings.cv_fps.60')}</div>
            </button>
          </div>
        </div>

        <!-- Режим отображения вебкамеры (PIP Mode) -->
        <div>
          <div style="font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#00ff88; margin-bottom:8px;" data-i18n="settings.pip_mode">${t('settings.pip_mode')}</div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;" id="settings-pip-group">
            <button class="setting-opt-btn btn-ghost" data-group="pipMode" data-val="full" style="padding:10px 6px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
              <div style="font-weight:700;" data-i18n="settings.pip.full">${t('settings.pip.full')}</div>
            </button>
            <button class="setting-opt-btn btn-ghost" data-group="pipMode" data-val="minimal" style="padding:10px 6px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
              <div style="font-weight:700;" data-i18n="settings.pip.minimal">${t('settings.pip.minimal')}</div>
            </button>
            <button class="setting-opt-btn btn-ghost" data-group="pipMode" data-val="off" style="padding:10px 6px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
              <div style="font-weight:700;" data-i18n="settings.pip.off">${t('settings.pip.off')}</div>
            </button>
          </div>
        </div>

        <!-- Радиостанция и фоновая музыка (Online Radio / BGM) -->
        <div>
          <div style="font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#00e5ff; margin-bottom:8px;" data-i18n="settings.radio">${t('settings.radio')}</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:6px;" id="settings-radio-group">
            ${RADIO_STATIONS.map(st => `
              <button class="setting-opt-btn btn-ghost ${st.id === currentRadio ? 'selected' : ''}" data-group="radioStation" data-val="${st.id}" style="padding:8px 6px; font-size:11px; border-radius:10px; cursor:pointer; text-align:left;">
                <div style="font-weight:700; color:#fff;" data-i18n="radio.${st.id}">${t('radio.' + st.id)}</div>
                <div style="font-size:9px; color:rgba(255,255,255,0.5);">${st.genre}</div>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Звук и Музыка (Audio & Music) -->
        <div>
          <div style="font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#ff6b35; margin-bottom:8px;" data-i18n="settings.audio">${t('settings.audio')}</div>

          <!-- BGM Volume -->
          <div style="margin-bottom:10px;">
            <div style="font-size:11px; color:rgba(255,255,255,0.7); margin-bottom:4px;" data-i18n="settings.bgm_vol">${t('settings.bgm_vol')}</div>
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;" id="settings-bgm-group">
              <button class="setting-opt-btn btn-ghost" data-group="bgmVolume" data-val="0" style="padding:8px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
                <div style="font-weight:700;" data-i18n="settings.vol.off">${t('settings.vol.off')}</div>
              </button>
              <button class="setting-opt-btn btn-ghost" data-group="bgmVolume" data-val="0.3" style="padding:8px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
                <div style="font-weight:700;" data-i18n="settings.vol.low">${t('settings.vol.low')}</div>
              </button>
              <button class="setting-opt-btn btn-ghost" data-group="bgmVolume" data-val="0.6" style="padding:8px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
                <div style="font-weight:700;" data-i18n="settings.vol.med">${t('settings.vol.med')}</div>
              </button>
              <button class="setting-opt-btn btn-ghost" data-group="bgmVolume" data-val="1.0" style="padding:8px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
                <div style="font-weight:700;" data-i18n="settings.vol.high">${t('settings.vol.high')}</div>
              </button>
            </div>
          </div>

          <!-- SFX Volume -->
          <div>
            <div style="font-size:11px; color:rgba(255,255,255,0.7); margin-bottom:4px;" data-i18n="settings.sfx_vol">${t('settings.sfx_vol')}</div>
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;" id="settings-sfx-group">
              <button class="setting-opt-btn btn-ghost" data-group="sfxVolume" data-val="0" style="padding:8px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
                <div style="font-weight:700;" data-i18n="settings.vol.off">${t('settings.vol.off')}</div>
              </button>
              <button class="setting-opt-btn btn-ghost" data-group="sfxVolume" data-val="0.3" style="padding:8px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
                <div style="font-weight:700;" data-i18n="settings.vol.low">${t('settings.vol.low')}</div>
              </button>
              <button class="setting-opt-btn btn-ghost" data-group="sfxVolume" data-val="0.7" style="padding:8px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
                <div style="font-weight:700;" data-i18n="settings.vol.med">${t('settings.vol.med')}</div>
              </button>
              <button class="setting-opt-btn btn-ghost" data-group="sfxVolume" data-val="1.0" style="padding:8px 4px; font-size:11px; border-radius:10px; cursor:pointer; text-align:center;">
                <div style="font-weight:700;" data-i18n="settings.vol.high">${t('settings.vol.high')}</div>
              </button>
            </div>
          </div>
        </div>

        <!-- Кнопка применить -->
        <div style="display:flex; justify-content:flex-end; gap:12px; align-items:center; margin-top:4px;">
          <button id="btn-settings-save" class="btn btn-primary" style="padding:12px 28px; font-size:14px; background:linear-gradient(135deg, #00e5ff, #0088ff); border:none;" data-i18n="settings.save">
            ${t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  `;
}
