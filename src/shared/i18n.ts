import { useEffect, useSyncExternalStore } from 'react'

// ONE language store for the whole website (landing, products, services...).
// Same key: localStorage "velvet-lang".
// Full support for all 9 languages: English, Tamil, Hindi, Malayalam, Telugu, Kannada, Marathi, Bengali, Sanskrit.
// Admin pages are excluded from language switching.

export type Lang = 'en' | 'ta' | 'hi' | 'ml' | 'te' | 'kn' | 'mr' | 'bn' | 'sa'
export type UiLang = Lang
export const LANGS: { code: UiLang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'mr', label: 'मराठी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'sa', label: 'संस्कृतम्' },
]
/** Language names written in English — used ONLY in the navbar language switch so every customer can read them. */
export const NAV_LANG_NAMES: Record<UiLang, string> = {
  en: 'English', ta: 'Tamil', hi: 'Hindi', ml: 'Malayalam', te: 'Telugu',
  kn: 'Kannada', mr: 'Marathi', bn: 'Bengali', sa: 'Sanskrit',
}
export const LANG_LOCALES: Record<UiLang, string> = {
  en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN', ml: 'ml-IN', te: 'te-IN',
  kn: 'kn-IN', mr: 'mr-IN', bn: 'bn-IN', sa: 'sa-IN',
}
/** Every language is fully supported — no content fallback needed. */
export const CONTENT_FALLBACK: Record<UiLang, Lang> = {
  en: 'en', ta: 'ta', hi: 'hi', ml: 'ml', te: 'te', kn: 'kn', mr: 'mr', bn: 'bn', sa: 'sa',
}

const KEY = 'velvet-lang'
const EVT = 'velvet-lang-change'

/** The language the visitor picked (any of the 9). */
export function getUiLang(): UiLang {
  try {
    const s = localStorage.getItem(KEY)
    if (s && LANGS.some((l) => l.code === s)) return s as UiLang
  } catch {}
  return 'en'
}
/** Content language — same as picked language (all 9 languages). */
export const getLang = (): Lang => getUiLang()

export function setLang(l: UiLang) {
  try { localStorage.setItem(KEY, l) } catch {}
  document.documentElement.lang = l
  window.dispatchEvent(new Event(EVT))
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVT, cb)
  window.addEventListener('storage', cb)
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb) }
}

/** Content language; every component using it re-renders live when the language changes. */
export function useLang(): [Lang, (l: UiLang) => void] {
  const lang = useSyncExternalStore(subscribe, getLang, () => 'en' as Lang)
  useEffect(() => { document.documentElement.lang = getUiLang() }, [lang])
  return [lang, setLang]
}
/** Same as useLang — all 9 languages are supported. */
export function useUiLang(): [UiLang, (l: UiLang) => void] {
  const lang = useSyncExternalStore(subscribe, getUiLang, () => 'en' as UiLang)
  return [lang, setLang]
}

/** Text in every language; falls back to English if one is missing. */
export type Tr = { en: string } & Partial<Record<Lang, string>>
export const tr = (d: Tr, lang: Lang) => d[lang] ?? d.en
/** Same as tr() but for any value type (arrays etc.). Falls back to English when a language has no entry. */
export const trx = <T extends { en: unknown }>(d: T, lang: Lang): T[keyof T] => ((d as Record<string, unknown>)[lang] ?? d.en) as T[keyof T]
