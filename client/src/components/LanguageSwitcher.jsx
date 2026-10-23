import { Languages } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { LANGS } from '../i18n/translations';

/** Small language picker for the top bar. Only shown to roles that have translations. */
export default function LanguageSwitcher() {
  const { lang, setLang, enabled, t } = useLang();
  if (!enabled) return null;
  return (
    <label className="flex items-center gap-1.5 text-sm text-ink-500">
      <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t('Language')}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('Language')}
        className="rounded-md border border-ink-200 bg-white py-1 pl-2 pr-6 text-sm text-ink-900 hover:border-ink-300 focus:outline-none focus:ring-2 focus:ring-navy-700/15">
        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </label>
  );
}