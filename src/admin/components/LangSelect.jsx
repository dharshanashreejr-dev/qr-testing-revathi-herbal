import { Languages } from 'lucide-react';
import { ADMIN_LANGS, useT } from '../i18n.js';

// Admin language switch: icon only (Tamil / English). Tap the icon to pick the language.
export default function LangSelect() {
  const { lang, setLang, t } = useT();
  return (
    <label className="lang-select" title={t('Language')}>
      <Languages size={18} aria-hidden="true" />
      <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('Language')}>
        {ADMIN_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </label>
  );
}
