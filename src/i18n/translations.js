/**
 * InterRun — Translations
 * Supported languages: en (English), uk (Ukrainian)
 */
export const translations = {

  // ─── META / SEO ─────────────────────────────────────────────────────────────
  'meta.title':        { en: 'InterRun — Multimodal Endless Runner', uk: 'InterRun — Мультимодальний 3D раннер' },
  'meta.description':  { en: 'Endless runner with progressive control stages: keyboard, touch/mouse, face tracking, and hand gestures.', uk: '3D раннер з прогресивним керуванням: клавіатура, свайпи, трекінг обличчя та жести рук.' },

  // ─── MENU ───────────────────────────────────────────────────────────────────
  'menu.title':        { en: 'INTERRUN',              uk: 'INTERRUN' },
  'menu.subtitle':     { en: 'Multimodal Endless Runner', uk: 'Мультимодальний раннер' },
  'menu.play':         { en: 'PLAY NOW',              uk: 'ГРАТИ ЗАРАЗ' },
  'menu.debug':        { en: '🛠️ DEBUG LAUNCH',       uk: '🛠️ ДЕБАГ ЗАПУСК' },
  'menu.skins':        { en: 'SKINS & THEMES',        uk: 'СКІНИ & ТЕМИ' },
  'menu.settings':     { en: '⚙️ SETTINGS',           uk: '⚙️ НАЛАШТУВАННЯ' },

  'menu.ai_loading':   { en: 'Loading AI Models...',  uk: 'Завантаження AI моделей...' },
  'menu.ai_ready':     { en: '⚡ AI Models: Ready',   uk: '⚡ AI Моделі: Готові' },

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

  // Mobile touch overrides for Stage 0 & 1
  'stage.0.name.touch':    { en: 'Touch D-Pad',           uk: 'Сенсорні кнопки' },
  'stage.1.name.touch':    { en: 'Touch Swipes',          uk: 'Свайпи по екрану' },
  'stage.0.badge.touch':   { en: 'STAGE 0: TOUCH D-PAD',  uk: 'ЕТАП 0: СЕНСОРНІ КНОПКИ' },
  'stage.1.badge.touch':   { en: 'STAGE 1: TOUCH SWIPES', uk: 'ЕТАП 1: СВАЙПИ ПО ЕКРАНУ' },
  'stage.0.desc.touch':    { en: 'TOUCH D-PAD BUTTONS',   uk: 'СЕНСОРНІ КНОПКИ НА ЕКРАНІ' },
  'stage.1.desc.touch':    { en: 'BUTTONS OFF → SWIPE ON SCREEN', uk: 'КНОПКИ ВИКЛ → СВАЙПИ ПО ЕКРАНУ' },
  'stage.0.hint.touch':    { en: '◀ / ▶ Lane &nbsp;|&nbsp; ▲ Jump &nbsp;|&nbsp; ▼ Slide',
                            uk: '◀ / ▶ Смуга &nbsp;|&nbsp; ▲ Стрибок &nbsp;|&nbsp; ▼ Присід' },
  'stage.1.hint.touch':    { en: '↔ Swipe left/right &nbsp;|&nbsp; ↑ Swipe/Tap = Jump &nbsp;|&nbsp; ↓ Swipe = Slide',
                            uk: '↔ Свайп ліво/право &nbsp;|&nbsp; ↑ Свайп/Тап = Стрибок &nbsp;|&nbsp; ↓ Свайп = Присід' },

  // ─── STAGE TRANSITION (COUNTDOWN) ───────────────────────────────────────────
  'transition.switching':      { en: '⚡ UPCOMING STAGE',    uk: '⚡ СКОРО ЗМІНА УПРАВЛІННЯ' },
  'transition.hint.0':         { en: '⌨️ Prepare Keyboard: A/D to steer, W to jump, S to slide', uk: '⌨️ Приготуйтеся: A/D смуга, W стрибок, S присід' },
  'transition.hint.1':         { en: '👆 Prepare Touch/Mouse: swipe left/right to steer', uk: '👆 Приготуйтеся: свайп ліво/право, клік — стрибок' },
  'transition.hint.2':         { en: '👤 Camera is ready! Move your head/face into the 3×3 grid', uk: '👤 Камера готова! Керуйте головою/обличчям у сітці 3×3' },
  'transition.hint.3':         { en: '✋ Hand only in 3×3 grid: keep your palm in front of camera', uk: '✋ Лише долоня у сітці 3×3: тримайте руку перед камерою' },
  'transition.hint.4':         { en: '✌️ Finger Gestures: 1/2/3 fingers for lane, palm=jump, fist=slide', uk: '✌️ Жести: 1/2/3 пальці — смуга, долоня — стрибок, кулак — присід' },
  'transition.hint.5':         { en: '👋 Air Swipes: quick wave left/right to change lane, up to jump', uk: '👋 Змахи: різкий змах рукою ліворуч/праворуч/вгору/вниз' },
  'transition.hint.0.touch':   { en: '📱 Prepare Touch D-Pad: tap on-screen arrows to steer', uk: '📱 Приготуйтеся: натискайте кнопки зі стрілками на екрані' },
  'transition.hint.1.touch':   { en: '👆 Prepare Touch Swipes: swipe left/right to steer, up to jump', uk: '👆 Приготуйтеся до свайпів: свайп ліво/право — смуга, вгору — стрибок' },

  // ─── HUD ────────────────────────────────────────────────────────────────────
  'hud.distance':      { en: 'Distance',              uk: 'Дистанція' },
  'hud.speed':         { en: 'SPEED',                 uk: 'ШВИДКІСТЬ' },
  'hud.camera':        { en: 'CAMERA',                uk: 'КАМЕРА' },
  'hud.skins':         { en: 'SKINS',                 uk: 'СКІНИ' },
  'hud.settings':      { en: 'SETTINGS',              uk: 'НАЛАШТУВАННЯ' },
  'hud.menu':          { en: 'MENU',                  uk: 'МЕНЮ' },
  'hud.debug':         { en: 'DEBUG',                 uk: 'ДЕБАГ' },
  'hud.immortal':      { en: '🛡️ GOD MODE (♾️)',      uk: '🛡️ БЕЗСМЕРТЯ (♾️)' },
  'hud.cam.active':          { en: 'CAMERA: ACTIVE',        uk: 'КАМЕРА: АКТИВНА' },
  'hud.cam.loading_models':  { en: 'LOADING AI MODELS...',  uk: 'ЗАВАНТАЖЕННЯ AI МОДЕЛЕЙ...' },
  'hud.cam.lowlight':        { en: 'Low FPS: adaptive eco-tracking active', uk: 'Низький FPS: адаптивний еко-трекінг активний' },
  'hud.cam.lowlight_badge':  { en: 'ECO MODE',              uk: 'ЕКО РЕЖИМ' },
  'hud.cam.offline_fallback':{ en: 'CAM OFFLINE — SWIPES ACTIVE',        uk: 'КАМЕРА ОФЛАЙН — СВАЙПИ АКТИВНІ' },
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
  'settings.track.label':   { en: '🎵 Track Playlist:',              uk: '🎵 Плейлист треків:' },
  'settings.track.prev':    { en: '⏮️ Prev',                        uk: '⏮️ Попер.' },
  'settings.track.next':    { en: 'Next ⏭️',                        uk: 'Наст. ⏭️' },
  'radio.nightride':        { en: '🌃 Nightride FM (Synthwave)',     uk: '🌃 Nightride FM (Сінтвейв)' },
  'radio.chillsynth':       { en: '🌴 Chillsynth FM (Chillwave)',    uk: '🌴 Chillsynth FM (Чіллвейв)' },
  'radio.darksynth':        { en: '⚡ Darksynth FM (Cyberpunk)',     uk: '⚡ Darksynth FM (Кіберпанк)' },
  'radio.ebsm':             { en: '🔥 EBSM Cyberpunk (Industrial)',  uk: '🔥 EBSM (Індастріал / Драйв)' },
  'radio.synth':            { en: '🎛️ Offline Procedural 80s Synth', uk: '🎛️ Офлайн Синтезатор (80s Synth)' },
  'settings.viewport_frame':{ en: '📺 Virtual Screen (Aspect Ratio):', uk: '📺 Віртуальний екран (Рамка):' },
  'settings.frame.full':    { en: 'Full / Auto',                      uk: 'Повний / Авто' },
  'settings.frame.16-9':    { en: '16:9 HD',                          uk: '16:9 HD' },
  'settings.frame.mobile':  { en: 'Mobile 9:16',                      uk: 'Мобільний 9:16' },
  'settings.frame.4-3':     { en: 'Retro 4:3',                        uk: 'Ретро 4:3' },
  'settings.render_scale':  { en: '⚡ 3D Graphics Render Scale:',      uk: '⚡ Масштаб рендера 3D:' },
  'settings.scale.100':     { en: '100% Native',                      uk: '100% Макс' },
  'settings.scale.75':      { en: '75% Balanced',                     uk: '75% Баланс' },
  'settings.scale.50':      { en: '50% Fast (+FPS)',                  uk: '50% Швидко (+FPS)' },
  'settings.save':          { en: 'Apply & Close',                   uk: 'Застосувати та закрити' },

  // ─── LANGUAGE ───────────────────────────────────────────────────────────────
  'lang.label':        { en: 'Language',              uk: 'Мова' },

  // ─── CAMERA ERROR / FALLBACK MODAL ───────────────────────────────────────────
  'modal.cam_error.title':         { en: '📹 Camera Status & Fallback',         uk: '📹 Стан камери та фолбек' },
  'modal.cam_error.subtitle':      { en: 'Camera is unavailable. Touch / swipe fallback controls are active.', uk: 'Камера недоступна. Увімкнено керування свайпами / тачем.' },
  'modal.cam_error.permission':    { en: 'Camera access was denied. You can grant access in browser/Safari permissions, or continue playing using touch swipes or mouse.', uk: 'Доступ до камери відхилено. Ви можете надати дозвіл у налаштуваннях Safari / браузера або продовжити гру свайпами чи мишею.' },
  'modal.cam_error.insecure':      { en: 'WebRTC camera requires a secure HTTPS connection. On iPhone/iOS, Safari strictly blocks camera access on unencrypted HTTP.', uk: 'Камера WebRTC вимагає захищеного з\'єднання HTTPS. На iPhone Safari блокує доступ до камери на незашифрованому HTTP.' },
  'modal.cam_error.not_found':     { en: 'No camera device found or camera is occupied by another application.', uk: 'Камеру не знайдено або вона зайнята іншим додатком.' },
  'modal.cam_error.in_use':        { en: 'Camera is currently in use by another app or tab. Please close other camera apps.', uk: 'Камера зараз використовується іншою програмою або вкладкою. Закрийте інші програми з камерою.' },
  'modal.cam_error.general':       { en: 'Failed to access camera stream. Touch / mouse fallback is active for all stages.', uk: 'Не вдалося отримати доступ до відеопотоку камери. Для всіх етапів увімкнено фолбек на свайпи/мишу.' },
  'modal.cam_error.fallback_info': { en: '⚡ Fallback active: Stages 2–5 can be fully controlled with screen swipes (touch / mouse) without any disruption!', uk: '⚡ Фолбек активний: Етапи 2–5 повноцінно керуються свайпами по екрану (або мишею) без перешкод!' },
  'modal.cam_error.continue':      { en: 'Continue with Swipes / Touch',        uk: 'Продовжити свайпами / тачем' },
  'modal.cam_error.retry':         { en: '🔄 Retry Camera',                     uk: '🔄 Спробувати камеру знову' },
};

