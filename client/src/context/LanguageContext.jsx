import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { DICTIONARIES, LANGS } from '../i18n/translations';
import { setDateLocale } from '../i18n/dateLocale';

/** Roles that get the language switcher. Add 'student' here later to translate the learner pages too. */
export const LANGUAGE_ROLES = ['parent'];
const KEY = 'apacope-lang';

const LanguageContext = createContext({ lang: 'en', setLang: () => {}, t: (s) => s, enabled: false });
export const useLang = () => useContext(LanguageContext);

const read = () => { try { return localStorage.getItem(KEY) || 'en'; } catch { return 'en'; } };

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const [chosen, setChosen] = useState(read);
  const enabled = !!user && LANGUAGE_ROLES.includes(user.role);
  const lang = enabled && LANGS.some((l) => l.code === chosen) ? chosen : 'en';

  const setLang = useCallback((code) => {
    setChosen(code);
    try { localStorage.setItem(KEY, code); } catch { /* storage blocked: the choice lasts until the page closes */ }
  }, []);

  setDateLocale(LANGS.find((l) => l.code === lang)?.locale || 'en-GB'); // before children render, so dates change at once
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  /** t('English text') gives the translation, or the English text itself when there is none. {name} placeholders are filled from vars. */
  const t = useCallback((text, vars) => {
    let out = (lang !== 'en' && DICTIONARIES[lang]?.[text]) || text;
    if (vars) Object.entries(vars).forEach(([k, v]) => { out = out.replace(`{${k}}`, v); });
    return out;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t, enabled }), [lang, setLang, t, enabled]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}