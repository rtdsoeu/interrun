/**
 * i18n — минималистичная система локализации InterRun.
 *
 * Использование:
 *   import { i18n } from './i18n/i18n.js';
 *   i18n.t('menu.play')          // → строка на текущем языке
 *   i18n.setLang('en')           // переключить язык
 *   i18n.onLangChange = (lang) => { ... } // callback на смену языка
 */
import { translations } from './translations.js';

const STORAGE_KEY = 'interrun_lang';
const SUPPORTED = ['en', 'ru', 'uk'];

class I18n {
  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const browser = navigator.language?.slice(0, 2).toLowerCase();

    if (saved && SUPPORTED.includes(saved)) {
      this._lang = saved;
    } else if (browser === 'uk') {
      this._lang = 'uk';
    } else if (browser === 'ru') {
      this._lang = 'ru';
    } else {
      this._lang = 'en';
    }

    /** @type {((lang: string) => void) | null} */
    this.onLangChange = null;
  }

  /** Текущий язык */
  get lang() { return this._lang; }

  /** Поддерживаемые языки */
  get supported() { return SUPPORTED; }

  /**
   * Переключить язык
   * @param {'en'|'ru'|'uk'} lang
   */
  setLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    this._lang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    if (this.onLangChange) this.onLangChange(lang);
  }

  /**
   * Получить перевод по ключу.
   * Если ключ не найден — возвращает сам ключ.
   * Если перевода на текущий язык нет — fallback на 'en'.
   * @param {string} key
   * @returns {string}
   */
  t(key) {
    const entry = translations[key];
    if (!entry) return key;
    return entry[this._lang] ?? entry['en'] ?? key;
  }
}

/** Глобальный синглтон */
export const i18n = new I18n();
