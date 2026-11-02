import { useSyncExternalStore } from 'react';
import { getUiLang } from '../shared/i18n';
import { DICT } from './i18n-dict.js';

// Admin translations. CRS 6: the back-office is a Tamil / English toggle only.
// It has its OWN language setting (so changing it never changes the customer website).
//   const { t } = useT();   t('Save changes')   t('Welcome back, {name}.', { name })
// The ENGLISH TEXT IS THE KEY, so unknown text simply stays English.
// Add new text to i18n-dict.js as ['English', 'ta', 'hi', 'ml', 'te'] (only ta is used in admin).

const ORDER = ['ta', 'hi', 'ml', 'te'];
const MAP = new Map(DICT.map(([en, ...rest]) => [en, Object.fromEntries(ORDER.map((l, i) => [l, rest[i]]))]));

export const ADMIN_LANGS = [{ code: 'en', label: 'English' }, { code: 'ta', label: 'தமிழ்' }];
const KEY = 'rhbc-admin-lang';
const EVT = 'rhbc-admin-lang-change';
const subscribe = (cb) => { window.addEventListener(EVT, cb); window.addEventListener('storage', cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb); }; };
// First visit: start in Tamil if the visitor already chose Tamil on the website, otherwise English.
export const getAdminLang = () => { try { const s = localStorage.getItem(KEY); if (s === 'en' || s === 'ta') return s; } catch { /* ignore */ } return getUiLang() === 'ta' ? 'ta' : 'en'; };
export const setAdminLang = (l) => { try { localStorage.setItem(KEY, l); } catch { /* ignore */ } window.dispatchEvent(new Event(EVT)); };

export function translate(text, lang, vars) {
  let out = lang === 'en' ? text : MAP.get(text)?.[lang] || text;
  if (vars) for (const k of Object.keys(vars)) out = out.split(`{${k}}`).join(String(vars[k]));
  return out;
}

export function useT() {
  const lang = useSyncExternalStore(subscribe, getAdminLang, () => 'en');
  return { lang, setLang: setAdminLang, t: (text, vars) => translate(text, lang, vars) };
}
