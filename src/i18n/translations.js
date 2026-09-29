/**
 * InterRun — Translations
 * Поддерживаемые языки: en (English), ru (Русский), uk (Українська)
 */
export const translations = {

  // ─── МЕНЮ ───────────────────────────────────────────────────────────────────
  'menu.title':        { en: 'INTERRUN',              ru: 'INTERRUN',              uk: 'INTERRUN' },
  'menu.subtitle':     { en: 'Multimodal Endless Runner', ru: 'Мультимодальный раннер', uk: 'Мультимодальний раннер' },
  'menu.play':         { en: 'PLAY NOW',              ru: 'ИГРАТЬ СЕЙЧАС',         uk: 'ГРАТИ ЗАРАЗ' },
  'menu.debug':        { en: '🛠️ DEBUG LAUNCH',       ru: '🛠️ ДЕБАГ ЗАПУСК',        uk: '🛠️ ДЕБАГ ЗАПУСК' },
  'menu.skins':        { en: 'SKINS & THEMES',        ru: 'СКИНЫ & ТЕМЫ',          uk: 'СКІНИ & ТЕМИ' },
  'menu.settings':     { en: '⚙️ SETTINGS',           ru: '⚙️ НАСТРОЙКИ',          uk: '⚙️ НАЛАШТУВАННЯ' },

  // ─── СТАДИИ ─────────────────────────────────────────────────────────────────
  'stage.0.name':      { en: 'Keyboard',              ru: 'Клавиатура',            uk: 'Клавіатура' },
  'stage.1.name':      { en: 'Touch / Mouse',         ru: 'Touch / Мышь',          uk: 'Touch / Миша' },
  'stage.2.name':      { en: 'Face Zone',             ru: 'Face Zone (Лицо)',      uk: 'Face Zone (Обличчя)' },
  'stage.3.name':      { en: 'Hand Zone',             ru: 'Hand Zone',             uk: 'Hand Zone' },
  'stage.4.name':      { en: 'Finger Gestures',       ru: 'Жесты пальцев',         uk: 'Жести пальців' },
  'stage.5.name':      { en: 'Hand Swipes',           ru: 'Взмахи руки',           uk: 'Змахи руки' },

  'stage.0.badge':     { en: 'STAGE 0: KEYBOARD',     ru: 'ЭТАП 0: КЛАВИАТУРА',    uk: 'ЕТАП 0: КЛАВІАТУРА' },
  'stage.1.badge':     { en: 'STAGE 1: TOUCH/MOUSE',  ru: 'ЭТАП 1: TOUCH/МЫШЬ',    uk: 'ЕТАП 1: TOUCH/МИША' },
  'stage.2.badge':     { en: 'STAGE 2: FACE ZONE',    ru: 'ЭТАП 2: FACE ZONE',     uk: 'ЕТАП 2: FACE ZONE' },
  'stage.3.badge':     { en: 'STAGE 3: HAND ZONE',    ru: 'ЭТАП 3: HAND ZONE',     uk: 'ЕТАП 3: HAND ZONE' },
  'stage.4.badge':     { en: 'STAGE 4: FINGER GESTURES', ru: 'ЭТАП 4: ЖЕСТЫ ПАЛЬЦЕВ', uk: 'ЕТАП 4: ЖЕСТИ ПАЛЬЦІВ' },
  'stage.5.badge':     { en: 'STAGE 5: HAND SWIPES',  ru: 'ЭТАП 5: ВЗМАХИ РУКИ',   uk: 'ЕТАП 5: ЗМАХИ РУКИ' },

  'stage.0.title':     { en: 'STAGE 0',               ru: 'ЭТАП 0',                uk: 'ЕТАП 0' },
  'stage.1.title':     { en: 'STAGE 1',               ru: 'ЭТАП 1',                uk: 'ЕТАП 1' },
  'stage.2.title':     { en: 'STAGE 2',               ru: 'ЭТАП 2',                uk: 'ЕТАП 2' },
  'stage.3.title':     { en: 'STAGE 3',               ru: 'ЭТАП 3',                uk: 'ЕТАП 3' },
  'stage.4.title':     { en: 'STAGE 4',               ru: 'ЭТАП 4',                uk: 'ЕТАП 4' },
  'stage.5.title':     { en: 'STAGE 5',               ru: 'ЭТАП 5',                uk: 'ЕТАП 5' },

  'stage.0.desc':      { en: 'KEYBOARD CONTROLS',     ru: 'УПРАВЛЕНИЕ: КЛАВИАТУРА', uk: 'УПРАВЛІННЯ: КЛАВІАТУРА' },
  'stage.1.desc':      { en: 'KEYBOARD OFF → TOUCH / MOUSE', ru: 'КЛАВИАТУРА ВЫКЛ → TOUCH / МЫШЬ', uk: 'КЛАВІАТУРА ВИКЛ → TOUCH / МИША' },
  'stage.2.desc':      { en: 'MOUSE OFF → FACE IN 3×3 GRID', ru: 'МЫШЬ ВЫКЛ → ЛИЦО В СЕТКЕ 3×3', uk: 'МИША ВИКЛ → ОБЛИЧЧЯ У СІТЦІ 3×3' },
  'stage.3.desc':      { en: 'HAND ZONE: move hand in grid', ru: 'HAND ZONE: рука в сетке 3×3', uk: 'HAND ZONE: рука у сітці 3×3' },
  'stage.4.desc':      { en: 'FINGERS: 1/2/3 fingers = lane, palm = jump, fist = slide', ru: 'ПАЛЬЦЫ: 1/2/3 = полоса, ладонь = прыжок, кулак = присед', uk: 'ПАЛЬЦІ: 1/2/3 = смуга, долоня = стрибок, кулак = присід' },
  'stage.5.desc':      { en: 'AIR SWIPES: wave hand left/right/up/down', ru: 'ВЗМАХИ: взмах рукой влево/вправо/вверх/вниз', uk: 'ЗМАХИ: змах рукою ліворуч/праворуч/вгору/вниз' },

  'stage.0.hint':      { en: '<span class="hint-key">A</span>/<span class="hint-key">D</span> Lane &nbsp;|&nbsp; <span class="hint-key">W/Space</span> Jump &nbsp;|&nbsp; <span class="hint-key">S</span> Slide',
                         ru: '<span class="hint-key">A</span>/<span class="hint-key">D</span> Полоса &nbsp;|&nbsp; <span class="hint-key">W/Пробел</span> Прыжок &nbsp;|&nbsp; <span class="hint-key">S</span> Присед',
                         uk: '<span class="hint-key">A</span>/<span class="hint-key">D</span> Смуга &nbsp;|&nbsp; <span class="hint-key">W/Пробіл</span> Стрибок &nbsp;|&nbsp; <span class="hint-key">S</span> Присід' },
  'stage.1.hint':      { en: '↔ Swipe left/right &nbsp;|&nbsp; ↑ Swipe/Tap = Jump &nbsp;|&nbsp; ↓ Swipe/RMB = Slide',
                         ru: '↔ Свайп влево/вправо &nbsp;|&nbsp; ↑ Свайп/Клик = Прыжок &nbsp;|&nbsp; ↓ Свайп/ПКМ = Присед',
                         uk: '↔ Свайп ліво/право &nbsp;|&nbsp; ↑ Свайп/Тап = Стрибок &nbsp;|&nbsp; ↓ Свайп/ПКМ = Присід' },
  'stage.2.hint':      { en: '👤 Face/Head in LEFT/CENTER/RIGHT zone → lane &nbsp;|&nbsp; BOTTOM → duck &nbsp;|&nbsp; TOP → jump',
                         ru: '👤 Голова СЛЕВА/В ЦЕНТРЕ/СПРАВА → полоса &nbsp;|&nbsp; ВНИЗУ → бег в приседе &nbsp;|&nbsp; ВВЕРХУ → прыжок',
                         uk: '👤 Голова ЗЛІВА/ПО ЦЕНТРУ/СПРАВА → смуга &nbsp;|&nbsp; ВНИЗУ → біг у присіді &nbsp;|&nbsp; ВГОРІ → стрибок' },
  'stage.3.hint':      { en: '✋ Hand in LEFT/CENTER/RIGHT → lane &nbsp;|&nbsp; TOP → jump &nbsp;|&nbsp; BOTTOM → duck',
                         ru: '✋ Ладонь СЛЕВА/ЦЕНТР/СПРАВА → полоса &nbsp;|&nbsp; ВВЕРХУ → прыжок &nbsp;|&nbsp; ВНИЗУ → присед',
                         uk: '✋ Долоня ЗЛІВА/ЦЕНТР/СПРАВА → смуга &nbsp;|&nbsp; ВГОРІ → стрибок &nbsp;|&nbsp; ВНИЗУ → присід' },
  'stage.4.hint':      { en: '☝️ 1 finger = left &nbsp;|&nbsp; ✌️ 2 = center &nbsp;|&nbsp; 🤟 3 = right &nbsp;|&nbsp; 🖐️ Palm = jump &nbsp;|&nbsp; ✊ Fist = duck',
                         ru: '☝️ 1 палец = левая &nbsp;|&nbsp; ✌️ 2 = центр &nbsp;|&nbsp; 🤟 3 = правая &nbsp;|&nbsp; 🖐️ Ладонь = прыжок &nbsp;|&nbsp; ✊ Кулак = присед',
                         uk: '☝️ 1 палець = ліва &nbsp;|&nbsp; ✌️ 2 = центр &nbsp;|&nbsp; 🤟 3 = права &nbsp;|&nbsp; 🖐️ Долоня = стрибок &nbsp;|&nbsp; ✊ Кулак = присід' },
  'stage.5.hint':      { en: '👋 Swipe LEFT/RIGHT → lane &nbsp;|&nbsp; Swipe UP → jump &nbsp;|&nbsp; Swipe DOWN → slide',
                         ru: '👋 Взмах ВЛЕВО/ВПРАВО → полоса &nbsp;|&nbsp; ВВЕРХ → прыжок &nbsp;|&nbsp; ВНИЗ → подкат',
                         uk: '👋 Змах ЛІВО/ПРАВО → смуга &nbsp;|&nbsp; ВГОРУ → стрибок &nbsp;|&nbsp; ВНИЗ → підкат' },

  // ─── ПЕРЕХОД МЕЖДУ ЭТАПАМИ (COUNTDOWN) ─────────────────────────────────────
  'transition.switching':  { en: '⚡ UPCOMING STAGE',    ru: '⚡ СКОРО СМЕНА УПРАВЛЕНИЯ', uk: '⚡ СКОРО ЗМІНА УПРАВЛІННЯ' },
  'transition.hint.0':     { en: '⌨️ Prepare Keyboard: A/D to steer, W to jump, S to slide', ru: '⌨️ Приготовьтесь: A/D полоса, W прыжок, S присед', uk: '⌨️ Приготуйтеся: A/D смуга, W стрибок, S присід' },
  'transition.hint.1':     { en: '👆 Prepare Touch/Mouse: swipe left/right to steer', ru: '👆 Приготовьтесь к мыши: свайп влево/вправо, клик — прыжок', uk: '👆 Приготуйтеся до миші: свайп ліво/право, клік — стрибок' },
  'transition.hint.2':     { en: '👤 Camera is ready! Move your head/face into the 3×3 grid', ru: '👤 Камера готова! Управляйте головой/лицом в сетке 3×3', uk: '👤 Камера готова! Керуйте головою/обличчям у сітці 3×3' },
  'transition.hint.3':     { en: '✋ Hand only in 3×3 grid: keep your palm in front of camera', ru: '✋ Только ладонь в сетке 3×3: держите руку перед камерой', uk: '✋ Лише долоня у сітці 3×3: тримайте руку перед камерою' },
  'transition.hint.4':     { en: '✌️ Finger Gestures: 1/2/3 fingers for lane, palm=jump, fist=slide', ru: '✌️ Жесты: 1/2/3 пальца — полоса, ладонь — прыжок, кулак — присед', uk: '✌️ Жести: 1/2/3 пальці — смуга, долоня — стрибок, кулак — присід' },
  'transition.hint.5':     { en: '👋 Air Swipes: quick wave left/right to change lane, up to jump', ru: '👋 Взмахи: резкий взмах рукой влево/вправо/вверх/вниз', uk: '👋 Змахи: різкий змах рукою ліворуч/праворуч/вгору/вниз' },

  // ─── HUD ────────────────────────────────────────────────────────────────────
  'hud.distance':      { en: 'Distance',              ru: 'Дистанция',             uk: 'Дистанція' },
  'hud.speed':         { en: 'SPEED',                 ru: 'СКОРОСТЬ',              uk: 'ШВИДКІСТЬ' },
  'hud.camera':        { en: 'CAMERA',                ru: 'КАМЕРА',                uk: 'КАМЕРА' },
  'hud.skins':         { en: 'SKINS',                 ru: 'СКИНЫ',                 uk: 'СКІНИ' },
  'hud.settings':      { en: 'SETTINGS',              ru: 'НАСТРОЙКИ',             uk: 'НАЛАШТУВАННЯ' },
  'hud.menu':          { en: 'MENU',                  ru: 'МЕНЮ',                  uk: 'МЕНЮ' },
  'hud.debug':         { en: 'DEBUG',                 ru: 'ДЕБАГ',                 uk: 'ДЕБАГ' },
  'hud.immortal':      { en: '🛡️ GOD MODE (♾️)',      ru: '🛡️ БЕССМЕРТИЕ (♾️)',    uk: '🛡️ БЕЗСМЕРТЯ (♾️)' },
  'hud.cam.active':    { en: 'CAMERA: ACTIVE',        ru: 'КАМЕРА: АКТИВНА',       uk: 'КАМЕРА: АКТИВНА' },
  'hud.sound':         { en: 'SOUND',                 ru: 'ЗВУК',                  uk: 'ЗВУК' },

  // ─── GAME OVER ───────────────────────────────────────────────────────────────
  'death.title':       { en: 'GAME OVER',             ru: 'GAME OVER',             uk: 'GAME OVER' },
  'death.dist.label':  { en: 'Distance covered',      ru: 'Пройденная дистанция',  uk: 'Пройдена дистанція' },
  'death.best':        { en: 'Best:',                 ru: 'Лучший рекорд:',        uk: 'Найкращий результат:' },
  'death.coins':       { en: 'Coins:',                ru: 'Монеты:',               uk: 'Монети:' },
  'death.restart':     { en: 'PLAY AGAIN',            ru: 'ИГРАТЬ СНОВА',          uk: 'ГРАТИ ЗНОВУ' },
  'death.debug':       { en: '🛠️ DEBUG MENU',         ru: '🛠️ ДЕБАГ МЕНЮ',         uk: '🛠️ ДЕБАГ МЕНЮ' },

  // ─── ГАРДЕРОБ ────────────────────────────────────────────────────────────────
  'skins.title':       { en: 'Wardrobe & Locations',  ru: 'Гардероб & Локации',    uk: 'Гардероб & Локації' },
  'skins.themes':      { en: 'Scene theme:',          ru: 'Тема сцены и фон:',     uk: 'Тема сцени та фон:' },
  'skins.chars':       { en: 'Character skin:',       ru: 'Скин персонажа:',       uk: 'Скін персонажа:' },
  'skins.info':        { en: 'Architecture ready for .glb models', ru: 'Архитектура готова к загрузке .glb моделей', uk: 'Архітектура готова до завантаження .glb моделей' },
  'skins.apply':       { en: 'Apply',                 ru: 'Применить',             uk: 'Застосувати' },

  // ─── ДЕБАГ ПАНЕЛЬ ────────────────────────────────────────────────────────────
  'debug.title':       { en: '🛠️ DEBUG LAUNCH',       ru: '🛠️ ДЕБАГ ЗАПУСК И ОТЛАДКА', uk: '🛠️ ДЕБАГ ЗАПУСК ТА НАЛАГОДЖЕННЯ' },
  'debug.subtitle':    { en: 'Fixed stage launch with unlimited lives', ru: 'Постоянный запуск уровня с бесконечными жизнями', uk: 'Постійний запуск рівня з безкінечними життями' },
  'debug.stage.sel':   { en: 'SELECT STAGE TO LAUNCH:', ru: 'ВЫБОР ЭТАПА ДЛЯ ЗАПУСКА:', uk: 'ВИБІР ЕТАПУ ДЛЯ ЗАПУСКУ:' },

  'debug.stage.0.sub': { en: 'A/D, W, S',             ru: 'A/D, W, S',             uk: 'A/D, W, S' },
  'debug.stage.1.sub': { en: 'Swipes, taps',           ru: 'Свайпы, клики',         uk: 'Свайпи, кліки' },
  'debug.stage.2.sub': { en: 'Face in 3×3 grid',       ru: 'Лицо в сетке 3×3',      uk: 'Обличчя у сітці 3×3' },
  'debug.stage.3.sub': { en: 'Hand in 3×3 grid',       ru: 'Ладонь в сетке 3×3',    uk: 'Долоня у сітці 3×3' },
  'debug.stage.4.sub': { en: '1/2/3 fingers, palm, fist', ru: '1/2/3 пальца, ладонь, кулак', uk: '1/2/3 пальці, долоня, кулак' },
  'debug.stage.5.sub': { en: 'Air swipes left/right/up/down', ru: 'Взмахи рукой в воздухе', uk: 'Змахи рукою в повітрі' },

  'debug.speed.sel':   { en: 'SPEED MULTIPLIER:',     ru: 'ВЫБОР СКОРОСТИ:',       uk: 'ВИБІР ШВИДКОСТІ:' },
  'debug.speed.slow':  { en: 'Slow',                  ru: 'Медленно',              uk: 'Повільно' },
  'debug.speed.easy':  { en: 'Comfort',               ru: 'Комфорт',               uk: 'Комфорт' },
  'debug.speed.norm':  { en: 'Standard',              ru: 'Стандарт',              uk: 'Стандарт' },
  'debug.speed.fast':  { en: 'Fast',                  ru: 'Быстро',                uk: 'Швидко' },
  'debug.speed.turbo': { en: 'Turbo',                 ru: 'Турбо',                 uk: 'Турбо' },

  'debug.lock.label':  { en: '🔒 Lock Stage',          ru: '🔒 Постоянный уровень (Зафиксировать этап)', uk: '🔒 Постійний рівень (Зафіксувати етап)' },
  'debug.lock.sub':    { en: 'Distance grows but stage stays fixed', ru: 'Дистанция и счет растут бесконечно, но этап НЕ переключается', uk: 'Дистанція та рахунок ростуть, але етап НЕ перемикається' },
  'debug.god.label':   { en: '🛡️ God Mode (Infinite Lives)', ru: '🛡️ Бесконечные жизни (God Mode)', uk: '🛡️ Безкінечні життя (God Mode)' },
  'debug.god.sub':     { en: 'Obstacles don\'t take lives or cause Game Over', ru: 'Столкновения с препятствиями не отнимают жизни', uk: 'Зіткнення з перешкодами не відбирають життя' },

  'debug.hotkeys':     { en: '💡 <strong style="color:var(--accent)">Hotkeys:</strong><br>• <kbd>0</kbd>...<kbd>5</kbd> — Switch and lock stage<br>• <kbd>G</kbd> — Toggle God Mode<br>• <kbd>L</kbd> — Toggle stage lock<br>• <kbd>~</kbd> / <kbd>F2</kbd> — Open this panel',
                         ru: '💡 <strong style="color:var(--accent)">Горячие клавиши:</strong><br>• <kbd>0</kbd>...<kbd>5</kbd> — Переключить и зафиксировать этап<br>• <kbd>G</kbd> — Вкл/выкл бессмертие<br>• <kbd>L</kbd> — Вкл/выкл замок этапа<br>• <kbd>~</kbd> / <kbd>F2</kbd> — Открыть эту панель',
                         uk: '💡 <strong style="color:var(--accent)">Гарячі клавіші:</strong><br>• <kbd>0</kbd>...<kbd>5</kbd> — Переключити та зафіксувати етап<br>• <kbd>G</kbd> — Увімк/вимк безсмертя<br>• <kbd>L</kbd> — Увімк/вимк замок етапу<br>• <kbd>~</kbd> / <kbd>F2</kbd> — Відкрити цю панель' },

  'debug.apply':       { en: '⚡ Apply Live',          ru: '⚡ Применить на ходу',   uk: '⚡ Застосувати на льоту' },
  'debug.launch':      { en: '🚀 LAUNCH LEVEL',        ru: '🚀 ЗАПУСТИТЬ УРОВЕНЬ',   uk: '🚀 ЗАПУСТИТИ РІВЕНЬ' },

  // ─── ZONE CV DEBUG ───────────────────────────────────────────────────────────
  'zone.left':         { en: '◀ LEFT',                ru: '◀ ВЛЕВО',               uk: '◀ ЛІВО' },
  'zone.right':        { en: 'RIGHT ▶',               ru: 'ВПРАВО ▶',              uk: 'ПРАВО ▶' },
  'zone.center':       { en: 'CENTER',                ru: 'ЦЕНТР',                 uk: 'ЦЕНТР' },
  'zone.jump':         { en: '▲ JUMP',                ru: '▲ ПРЫЖОК',              uk: '▲ СТРИБОК' },
  'zone.slide':        { en: '▼ SLIDE',               ru: '▼ ПРИСЕД',              uk: '▼ ПРИСІД' },
  'zone.notfound':     { en: 'Not visible...',         ru: 'Не вижу...',            uk: 'Не бачу...' },

  // ─── ТЕМЫ ────────────────────────────────────────────────────────────────────
  'theme.cyber_metro':     { en: '🌃 Cyber Metro',    ru: '🌃 Кибер Метро',        uk: '🌃 Кібер Метро' },
  'theme.sunset_canyon':   { en: '🏜️ Sunset Canyon',  ru: '🏜️ Закат Каньон',       uk: '🏜️ Захід Каньйон' },
  'theme.neon_forest':     { en: '🌲 Neon Forest',    ru: '🌲 Неон Лес',           uk: '🌲 Неон Ліс' },

  // ─── СКИНЫ ───────────────────────────────────────────────────────────────────
  'skin.cyber_neon':       { en: '⚡ Neon Runner',    ru: '⚡ Неон Раннер',        uk: '⚡ Неон Раннер' },
  'skin.subway_graffiti':  { en: '🧢 Graffiti',       ru: '🧢 Граффити',           uk: '🧢 Графіті' },
  'skin.shadow_shinobi':   { en: '🥷 Shinobi',        ru: '🥷 Шиноби',             uk: '🥷 Шінобі' },

  // ─── НАСТРОЙКИ ───────────────────────────────────────────────────────────────
  'settings.title':         { en: '⚙️ Performance & Camera Settings', ru: '⚙️ Настройки графики и камеры', uk: '⚙️ Налаштування графіки та камери' },
  'settings.subtitle':      { en: 'Tune computer vision resolution, target frame rate, and preview overhead', ru: 'Управление разрешением CV, целевым FPS и нагрузкой окна превью', uk: 'Керування роздільною здатністю CV, цільовим FPS та навантаженням прев’ю' },
  'settings.cv_res':        { en: 'Computer Vision Resolution:',     ru: 'Разрешение кадра нейросети (CV):', uk: 'Роздільна здатність кадру нейромережі (CV):' },
  'settings.cv_res.eco':    { en: '⚡ Eco (160×120) — Max FPS',       ru: '⚡ Эко (160×120) — Макс. FPS',    uk: '⚡ Еко (160×120) — Макс. FPS' },
  'settings.cv_res.balanced': { en: '⚖️ Balanced (256×192) — Standard', ru: '⚖️ Баланс (256×192) — Стандарт', uk: '⚖️ Баланс (256×192) — Стандарт' },
  'settings.cv_res.high':   { en: '🎯 High (320×240) — Best Accuracy', ru: '🎯 Высокое (320×240) — Точность', uk: '🎯 Висока (320×240) — Точність' },
  'settings.cv_fps':        { en: 'CV Target Frame Rate:',           ru: 'Целевая частота кадров CV:',     uk: 'Цільова частота кадрів CV:' },
  'settings.cv_fps.20':     { en: '20 FPS (Save Battery/GPU)',       ru: '20 FPS (Экономия батареи/GPU)',  uk: '20 FPS (Економія батареї/GPU)' },
  'settings.cv_fps.30':     { en: '30 FPS (Smooth Standard)',        ru: '30 FPS (Плавный стандарт)',      uk: '30 FPS (Плавний стандарт)' },
  'settings.cv_fps.45':     { en: '45 FPS (Ultra-responsive)',       ru: '45 FPS (Ультра-отзывчивость)',   uk: '45 FPS (Ультра-чуйність)' },
  'settings.cv_fps.60':     { en: '60 FPS (Max Fluidity)',           ru: '60 FPS (Максимальная плавность)', uk: '60 FPS (Максимальна плавність)' },
  'settings.pip_mode':      { en: 'Webcam PIP Display:',             ru: 'Режим окна веб-камеры (PIP):',   uk: 'Режим вікна веб-камери (PIP):' },
  'settings.pip.full':      { en: '📹 Video + Points & Grid',        ru: '📹 Видео + Точки и сетка',       uk: '📹 Відео + Точки та сітка' },
  'settings.pip.minimal':   { en: '✨ HUD Only (No Video — Saves FPS)', ru: '✨ Только HUD (Без видео — +FPS)', uk: '✨ Лише HUD (Без відео — +FPS)' },
  'settings.pip.off':       { en: '🚫 Hidden (Max Performance)',     ru: '🚫 Скрыто (Макс. скорость)',     uk: '🚫 Приховано (Макс. швидкість)' },
  'settings.audio':         { en: 'Sound & Music Volume:',           ru: 'Громкость звука и музыки:',      uk: 'Гучність звуку та музики:' },
  'settings.bgm_vol':       { en: '🎵 Music (BGM):',                 ru: '🎵 Музыка (BGM):',               uk: '🎵 Музика (BGM):' },
  'settings.sfx_vol':       { en: '🔊 Effects (SFX):',               ru: '🔊 Эффекты (SFX):',              uk: '🔊 Ефекти (SFX):' },
  'settings.vol.off':       { en: 'Mute',                            ru: 'Выкл',                           uk: 'Вимк' },
  'settings.vol.low':       { en: 'Low (30%)',                       ru: 'Тихо (30%)',                     uk: 'Тихо (30%)' },
  'settings.vol.med':       { en: 'Med (70%)',                       ru: 'Средне (70%)',                   uk: 'Середньо (70%)' },
  'settings.vol.high':      { en: 'Full (100%)',                     ru: 'Макс (100%)',                    uk: 'Макс (100%)' },
  'settings.radio':         { en: '📻 Radio Station / BGM Track:',   ru: '📻 Радиостанция / Фоновая музыка:', uk: '📻 Радіостанція / Фонова музика:' },
  'radio.nightride':        { en: '🌃 Nightride FM (Synthwave)',     ru: '🌃 Nightride FM (Синтвейв)',        uk: '🌃 Nightride FM (Сінтвейв)' },
  'radio.chillsynth':       { en: '🌴 Chillsynth FM (Chillwave)',    ru: '🌴 Chillsynth FM (Чиллвейв)',       uk: '🌴 Chillsynth FM (Чіллвейв)' },
  'radio.darksynth':        { en: '⚡ Darksynth FM (Cyberpunk)',     ru: '⚡ Darksynth FM (Киберпанк)',       uk: '⚡ Darksynth FM (Кіберпанк)' },
  'radio.ebsm':             { en: '🔥 EBSM Cyberpunk (Industrial)',  ru: '🔥 EBSM (Индастриал / Драйв)',      uk: '🔥 EBSM (Індастріал / Драйв)' },
  'radio.synth':            { en: '🎛️ Offline Procedural 80s Synth', ru: '🎛️ Офлайн Синтезатор (80s Synth)',  uk: '🎛️ Офлайн Синтезатор (80s Synth)' },
  'settings.save':          { en: 'Apply & Close',                   ru: 'Применить и закрыть',            uk: 'Застосувати та закрити' },

  // ─── ЯЗЫК ────────────────────────────────────────────────────────────────────
  'lang.label':        { en: 'Language',              ru: 'Язык',                  uk: 'Мова' },
};
