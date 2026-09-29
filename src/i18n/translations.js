/**
 * InterRun — Translations
 * Supported languages: en (English), uk (Ukrainian)
 */
export const translations = {

  // ─── MENU ───────────────────────────────────────────────────────────────────
  'menu.title':        { en: 'INTERRUN',              uk: 'INTERRUN' },
  'menu.subtitle':     { en: 'Multimodal Endless Runner', uk: 'Мультимодальний раннер' },
  'menu.play':         { en: 'PLAY NOW',              uk: 'ГРАТИ ЗАРАЗ' },
  'menu.debug':        { en: '🛠️ DEBUG LAUNCH',       uk: '🛠️ ДЕБАГ ЗАПУСК' },
  'menu.skins':        { en: 'SKINS & THEMES',        uk: 'СКІНИ & ТЕМИ' },
  'menu.settings':     { en: '⚙️ SETTINGS',           uk: '⚙️ НАЛАШТУВАННЯ' },

  // ─── STAGES ─────────────────────────────────────────────────────────────────
  'stage.0.name':      { en: 'Keyboard',              uk: 'Клавіатура' },
  'stage.1.name':      { en: 'Touch / Mouse',         uk: 'Touch / Миша' },
  'stage.2.name':      { en: 'Face Zone',             uk: 'Face Zone (Обличчя)' },
  'stage.3.name':      { en: 'Hand Zone',             uk: 'Hand Zone' },
  'stage.4.name':      { en: 'Finger Gestures',       uk: 'Жести пальців' },
  'stage.5.name':      { en: 'Hand Swipes',           uk: 'Змахи руки' },

  'stage.0.badge':     { en: 'STAGE 0: KEYBOARD',     uk: 'ЕТАП 0: КЛАВІАТУРА' },
  'stage.1.badge':     { en: 'STAGE 1: TOUCH/MOUSE',  uk: 'ЕТАП 1: TOUCH/МИША' },
  'stage.2.badge':     { en: 'STAGE 2: FACE ZONE',    uk: 'ЕТАП 2: FACE ZONE' },
  'stage.3.badge':     { en: 'STAGE 3: HAND ZONE',    uk: 'ЕТАП 3: HAND ZONE' },
  'stage.4.badge':     { en: 'STAGE 4: FINGER GESTURES', uk: 'ЕТАП 4: ЖЕСТИ ПАЛЬЦІВ' },
  'stage.5.badge':     { en: 'STAGE 5: HAND SWIPES',  uk: 'ЕТАП 5: ЗМАХИ РУКИ' },

  'stage.0.title':     { en: 'STAGE 0',               uk: 'ЕТАП 0' },
  'stage.1.title':     { en: 'STAGE 1',               uk: 'ЕТАП 1' },
  'stage.2.title':     { en: 'STAGE 2',               uk: 'ЕТАП 2' },
  'stage.3.title':     { en: 'STAGE 3',               uk: 'ЕТАП 3' },
  'stage.4.title':     { en: 'STAGE 4',               uk: 'ЕТАП 4' },
  'stage.5.title':     { en: 'STAGE 5',               uk: 'ЕТАП 5' },
  'stage.loop':        { en: 'Loop',                  uk: 'Коло' },

  'stage.0.desc':      { en: 'KEYBOARD CONTROLS',     uk: 'УПРАВЛІННЯ: КЛАВІАТУРА' },
  'stage.1.desc':      { en: 'KEYBOARD OFF → TOUCH / MOUSE', uk: 'КЛАВІАТУРА ВИКЛ → TOUCH / МИША' },
  'stage.2.desc':      { en: 'MOUSE OFF → FACE IN 3×3 GRID', uk: 'МИША ВИКЛ → ОБЛИЧЧЯ У СІТЦІ 3×3' },
  'stage.3.desc':      { en: 'HAND ZONE: move hand in grid', uk: 'HAND ZONE: рука у сітці 3×3' },
  'stage.4.desc':      { en: 'FINGERS: 1/2/3 fingers = lane, palm = jump, fist = slide', uk: 'ПАЛЬЦІ: 1/2/3 = смуга, долоня = стрибок, кулак = присід' },
  'stage.5.desc':      { en: 'AIR SWIPES: wave hand left/right/up/down', uk: 'ЗМАХИ: змах рукою ліворуч/праворуч/вгору/вниз' },

  'stage.0.hint':      { en: '<span class="hint-key">A</span>/<span class="hint-key">D</span> Lane &nbsp;|&nbsp; <span class="hint-key">W/Space</span> Jump &nbsp;|&nbsp; <span class="hint-key">S</span> Slide',
                         uk: '<span class="hint-key">A</span>/<span class="hint-key">D</span> Смуга &nbsp;|&nbsp; <span class="hint-key">W/Пробіл</span> Стрибок &nbsp;|&nbsp; <span class="hint-key">S</span> Присід' },
  'stage.1.hint':      { en: '↔ Swipe left/right &nbsp;|&nbsp; ↑ Swipe/Tap = Jump &nbsp;|&nbsp; ↓ Swipe/RMB = Slide',
                         uk: '↔ Свайп ліво/право &nbsp;|&nbsp; ↑ Свайп/Тап = Стрибок &nbsp;|&nbsp; ↓ Свайп/ПКМ = Присід' },
  'stage.2.hint':      { en: '👤 Face/Head in LEFT/CENTER/RIGHT zone → lane &nbsp;|&nbsp; BOTTOM → duck &nbsp;|&nbsp; TOP → jump',
                         uk: '👤 Голова ЗЛІВА/ПО ЦЕНТРУ/СПРАВА → смуга &nbsp;|&nbsp; ВНИЗУ → біг у присіді &nbsp;|&nbsp; ВГОРІ → стрибок' },
  'stage.3.hint':      { en: '✋ Hand in LEFT/CENTER/RIGHT → lane &nbsp;|&nbsp; TOP → jump &nbsp;|&nbsp; BOTTOM → duck',
                         uk: '✋ Долоня ЗЛІВА/ЦЕНТР/СПРАВА → смуга &nbsp;|&nbsp; ВГОРІ → стрибок &nbsp;|&nbsp; ВНИЗУ → присід' },
  'stage.4.hint':      { en: '☝️ 1 finger = left &nbsp;|&nbsp; ✌️ 2 = center &nbsp;|&nbsp; 🤟 3 = right &nbsp;|&nbsp; 🖐️ Palm = jump &nbsp;|&nbsp; ✊ Fist = duck',
                         uk: '☝️ 1 палець = ліва &nbsp;|&nbsp; ✌️ 2 = центр &nbsp;|&nbsp; 🤟 3 = права &nbsp;|&nbsp; 🖐️ Долоня = стрибок &nbsp;|&nbsp; ✊ Кулак = присід' },
  'stage.5.hint':      { en: '👋 Swipe LEFT/RIGHT → lane &nbsp;|&nbsp; Swipe UP → jump &nbsp;|&nbsp; Swipe DOWN → slide',
                         uk: '👋 Змах ЛІВО/ПРАВО → смуга &nbsp;|&nbsp; ВГОРУ → стрибок &nbsp;|&nbsp; ВНИЗ → підкат' },

  // ─── STAGE TRANSITION (COUNTDOWN) ───────────────────────────────────────────
  'transition.switching':  { en: '⚡ UPCOMING STAGE',    uk: '⚡ СКОРО ЗМІНА УПРАВЛІННЯ' },
  'transition.hint.0':     { en: '⌨️ Prepare Keyboard: A/D to steer, W to jump, S to slide', uk: '⌨️ Приготуйтеся: A/D смуга, W стрибок, S присід' },
  'transition.hint.1':     { en: '👆 Prepare Touch/Mouse: swipe left/right to steer', uk: '👆 Приготуйтеся до миші: свайп ліво/право, клік — стрибок' },
  'transition.hint.2':     { en: '👤 Camera is ready! Move your head/face into the 3×3 grid', uk: '👤 Камера готова! Керуйте головою/обличчям у сітці 3×3' },
  'transition.hint.3':     { en: '✋ Hand only in 3×3 grid: keep your palm in front of camera', uk: '✋ Лише долоня у сітці 3×3: тримайте руку перед камерою' },
  'transition.hint.4':     { en: '✌️ Finger Gestures: 1/2/3 fingers for lane, palm=jump, fist=slide', uk: '✌️ Жести: 1/2/3 пальці — смуга, долоня — стрибок, кулак — присід' },
  'transition.hint.5':     { en: '👋 Air Swipes: quick wave left/right to change lane, up to jump', uk: '👋 Змахи: різкий змах рукою ліворуч/праворуч/вгору/вниз' },

  // ─── HUD ────────────────────────────────────────────────────────────────────
  'hud.distance':      { en: 'Distance',              uk: 'Дистанція' },
  'hud.speed':         { en: 'SPEED',                 uk: 'ШВИДКІСТЬ' },
  'hud.camera':        { en: 'CAMERA',                uk: 'КАМЕРА' },
  'hud.skins':         { en: 'SKINS',                 uk: 'СКІНИ' },
  'hud.settings':      { en: 'SETTINGS',              uk: 'НАЛАШТУВАННЯ' },
  'hud.menu':          { en: 'MENU',                  uk: 'МЕНЮ' },
  'hud.debug':         { en: 'DEBUG',                 uk: 'ДЕБАГ' },
  'hud.immortal':      { en: '🛡️ GOD MODE (♾️)',      uk: '🛡️ БЕЗСМЕРТЯ (♾️)' },
  'hud.cam.active':    { en: 'CAMERA: ACTIVE',        uk: 'КАМЕРА: АКТИВНА' },
  'hud.sound':         { en: 'SOUND',                 uk: 'ЗВУК' },

  // ─── GAME OVER ──────────────────────────────────────────────────────────────
  'death.title':       { en: 'GAME OVER',             uk: 'GAME OVER' },
  'death.dist.label':  { en: 'Distance covered',      uk: 'Пройдена дистанція' },
  'death.best':        { en: 'Best:',                 uk: 'Найкращий результат:' },
  'death.coins':       { en: 'Coins:',                uk: 'Монети:' },
  'death.restart':     { en: 'PLAY AGAIN',            uk: 'ГРАТИ ЗНОВУ' },
  'death.debug':       { en: '🛠️ DEBUG MENU',         uk: '🛠️ ДЕБАГ МЕНЮ' },

  // ─── WARDROBE & LOCATIONS ───────────────────────────────────────────────────
  'skins.title':       { en: 'Wardrobe & Locations',  uk: 'Гардероб & Локації' },
  'skins.themes':      { en: 'Scene theme:',          uk: 'Тема сцени та фон:' },
  'skins.chars':       { en: 'Character skin:',       uk: 'Скін персонажа:' },
  'skins.info':        { en: 'Architecture ready for .glb models', uk: 'Архітектура готова до завантаження .glb моделей' },
  'skins.apply':       { en: 'Apply',                 uk: 'Застосувати' },

  // ─── DEBUG PANEL ────────────────────────────────────────────────────────────
  'debug.title':       { en: '🛠️ DEBUG LAUNCH',       uk: '🛠️ ДЕБАГ ЗАПУСК ТА НАЛАГОДЖЕННЯ' },
  'debug.subtitle':    { en: 'Fixed stage launch with unlimited lives', uk: 'Постійний запуск рівня з безкінечними життями' },
  'debug.stage.sel':   { en: 'SELECT STAGE TO LAUNCH:', uk: 'ВИБІР ЕТАПУ ДЛЯ ЗАПУСКУ:' },

  'debug.stage.0.sub': { en: 'A/D, W, S',             uk: 'A/D, W, S' },
  'debug.stage.1.sub': { en: 'Swipes, taps',           uk: 'Свайпи, кліки' },
  'debug.stage.2.sub': { en: 'Face in 3×3 grid',       uk: 'Обличчя у сітці 3×3' },
  'debug.stage.3.sub': { en: 'Hand in 3×3 grid',       uk: 'Долоня у сітці 3×3' },
  'debug.stage.4.sub': { en: '1/2/3 fingers, palm, fist', uk: '1/2/3 пальці, долоня, кулак' },
  'debug.stage.5.sub': { en: 'Air swipes left/right/up/down', uk: 'Змахи рукою в повітрі' },

  'debug.speed.sel':   { en: 'SPEED MULTIPLIER:',     uk: 'ВИБІР ШВИДКОСТІ:' },
  'debug.speed.slow':  { en: 'Slow',                  uk: 'Повільно' },
  'debug.speed.easy':  { en: 'Comfort',               uk: 'Комфорт' },
  'debug.speed.norm':  { en: 'Standard',              uk: 'Стандарт' },
  'debug.speed.fast':  { en: 'Fast',                  uk: 'Швидко' },
  'debug.speed.turbo': { en: 'Turbo',                 uk: 'Турбо' },

  'debug.lock.label':  { en: '🔒 Lock Stage',          uk: '🔒 Постійний рівень (Зафіксувати етап)' },
  'debug.lock.sub':    { en: 'Distance grows but stage stays fixed', uk: 'Дистанція та рахунок ростуть, але етап НЕ перемикається' },
  'debug.god.label':   { en: '🛡️ God Mode (Infinite Lives)', uk: '🛡️ Безкінечні життя (God Mode)' },
  'debug.god.sub':     { en: 'Obstacles don\'t take lives or cause Game Over', uk: 'Зіткнення з перешкодами не відбирають життя' },

  'debug.hotkeys':     { en: '💡 <strong style="color:var(--accent)">Hotkeys:</strong><br>• <kbd>0</kbd>...<kbd>5</kbd> — Switch and lock stage<br>• <kbd>G</kbd> — Toggle God Mode<br>• <kbd>L</kbd> — Toggle stage lock<br>• <kbd>~</kbd> / <kbd>F2</kbd> — Open this panel',
                         uk: '💡 <strong style="color:var(--accent)">Гарячі клавіші:</strong><br>• <kbd>0</kbd>...<kbd>5</kbd> — Переключити та зафіксувати етап<br>• <kbd>G</kbd> — Увімк/вимк безсмертя<br>• <kbd>L</kbd> — Увімк/вимк замок етапу<br>• <kbd>~</kbd> / <kbd>F2</kbd> — Відкрити цю панель' },

  'debug.apply':       { en: '⚡ Apply Live',          uk: '⚡ Застосувати на льоту' },
  'debug.launch':      { en: '🚀 LAUNCH LEVEL',        uk: '🚀 ЗАПУСТИТИ РІВЕНЬ' },

  // ─── ZONE CV DEBUG ──────────────────────────────────────────────────────────
  'zone.left':         { en: '◀ LEFT',                uk: '◀ ЛІВО' },
  'zone.right':        { en: 'RIGHT ▶',               uk: 'ПРАВО ▶' },
  'zone.center':       { en: 'CENTER',                uk: 'ЦЕНТР' },
  'zone.jump':         { en: '▲ JUMP',                uk: '▲ СТРИБОК' },
  'zone.slide':        { en: '▼ SLIDE',               uk: '▼ ПРИСІД' },
  'zone.notfound':     { en: 'Not visible...',         uk: 'Не бачу...' },

  // ─── THEMES ─────────────────────────────────────────────────────────────────
  'theme.cyber_metro':     { en: '🌃 Cyber Metro',    uk: '🌃 Кібер Метро' },
  'theme.sunset_canyon':   { en: '🏜️ Sunset Canyon',  uk: '🏜️ Захід Каньйон' },
  'theme.neon_forest':     { en: '🌲 Neon Forest',    uk: '🌲 Неон Ліс' },

  // ─── SKINS ──────────────────────────────────────────────────────────────────
  'skin.cyber_neon':       { en: '⚡ Neon Runner',    uk: '⚡ Неон Раннер' },
  'skin.subway_graffiti':  { en: '🧢 Graffiti',       uk: '🧢 Графіті' },
  'skin.shadow_shinobi':   { en: '🥷 Shinobi',        uk: '🥷 Шінобі' },

  // ─── SETTINGS ───────────────────────────────────────────────────────────────
  'settings.title':         { en: '⚙️ Performance & Camera Settings', uk: '⚙️ Налаштування графіки та камери' },
  'settings.subtitle':      { en: 'Tune target frame rate, preview overhead, and audio', uk: 'Керування цільовим FPS, навантаженням прев’ю та звуком' },
  'settings.cv_fps':        { en: 'CV Target Frame Rate:',           uk: 'Цільова частота кадрів CV:' },
  'settings.cv_fps.20':     { en: '20 FPS (Save Battery/GPU)',       uk: '20 FPS (Економія батареї/GPU)' },
  'settings.cv_fps.30':     { en: '30 FPS (Smooth Standard)',        uk: '30 FPS (Плавний стандарт)' },
  'settings.cv_fps.45':     { en: '45 FPS (Ultra-responsive)',       uk: '45 FPS (Ультра-чуйність)' },
  'settings.cv_fps.60':     { en: '60 FPS (Max Fluidity)',           uk: '60 FPS (Максимальна плавність)' },
  'settings.pip_mode':      { en: 'Webcam PIP Display:',             uk: 'Режим вікна веб-камери (PIP):' },
  'settings.pip.full':      { en: '📹 Video + Points & Grid',        uk: '📹 Відео + Точки та сітка' },
  'settings.pip.minimal':   { en: '✨ HUD Only (No Video — Saves FPS)', uk: '✨ Лише HUD (Без відео — +FPS)' },
  'settings.pip.off':       { en: '🚫 Hidden (Max Performance)',     uk: '🚫 Приховано (Макс. швидкість)' },
  'settings.audio':         { en: 'Sound & Music Volume:',           uk: 'Гучність звуку та музики:' },
  'settings.bgm_vol':       { en: '🎵 Music (BGM):',                 uk: '🎵 Музика (BGM):' },
  'settings.sfx_vol':       { en: '🔊 Effects (SFX):',               uk: '🔊 Ефекти (SFX):' },
  'settings.vol.off':       { en: 'Mute',                            uk: 'Вимк' },
  'settings.vol.low':       { en: 'Low (30%)',                       uk: 'Тихо (30%)' },
  'settings.vol.med':       { en: 'Med (70%)',                       uk: 'Середньо (70%)' },
  'settings.vol.high':      { en: 'Full (100%)',                     uk: 'Макс (100%)' },
  'settings.radio':         { en: '📻 Radio Station / BGM Track:',   uk: '📻 Радіостанція / Фонова музика:' },
  'radio.nightride':        { en: '🌃 Nightride FM (Synthwave)',     uk: '🌃 Nightride FM (Сінтвейв)' },
  'radio.chillsynth':       { en: '🌴 Chillsynth FM (Chillwave)',    uk: '🌴 Chillsynth FM (Чіллвейв)' },
  'radio.darksynth':        { en: '⚡ Darksynth FM (Cyberpunk)',     uk: '⚡ Darksynth FM (Кіберпанк)' },
  'radio.ebsm':             { en: '🔥 EBSM Cyberpunk (Industrial)',  uk: '🔥 EBSM (Індастріал / Драйв)' },
  'radio.synth':            { en: '🎛️ Offline Procedural 80s Synth', uk: '🎛️ Офлайн Синтезатор (80s Synth)' },
  'settings.save':          { en: 'Apply & Close',                   uk: 'Застосувати та закрити' },

  // ─── LANGUAGE ───────────────────────────────────────────────────────────────
  'lang.label':        { en: 'Language',              uk: 'Мова' },
};
