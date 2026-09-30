/**
 * i18n — minimal localization system for InterRun.
 *
 * Usage:
 *   import { i18n } from './i18n/i18n.js';
 *   i18n.t('menu.play')          // -> string in active language
 *   i18n.setLang('en')           // switch language
 *   i18n.onLangChange = (lang) => { ... } // language change callback
 */
import { translations } from './translations.js';

const STORAGE_KEY = 'interrun_lang';
const SUPPORTED = ['en', 'uk'];

class I18n {
  constructor() {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const browser = typeof navigator !== 'undefined' ? navigator.language?.slice(0, 2).toLowerCase() : 'en';

    if (saved && SUPPORTED.includes(saved)) {
      this._lang = saved;
    } else if (browser === 'uk') {
      this._lang = 'uk';
    } else {
      this._lang = 'en';
    }

    /** @type {((lang: string) => void) | null} */
    this.onLangChange = null;
  }

  /** Current language */
  get lang() { return this._lang; }

  /** Supported languages */
  get supported() { return SUPPORTED; }

  /**
   * Switch language
   * @param {'en'|'uk'} lang
   */
  setLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    this._lang = lang;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
    }
    if (this.onLangChange) this.onLangChange(lang);
  }

  /**
   * Get translation by key.
   * If key is not found, returns the key itself.
   * If translation is missing in the current language, falls back to 'en'.
   * @param {string} key
   * @returns {string}
   */
  t(key) {
    const entry = translations[key];
    if (!entry) return key;
    return entry[this._lang] ?? entry['en'] ?? key;
  }
}

/** Global singleton */
export const i18n = new I18n();
