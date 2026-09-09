import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { translations, type Lang } from './translations';

export type { Lang };

export const LANGS: { id: Lang; label: string; native: string }[] = [
  { id: 'fr', label: 'Français', native: 'Français' },
  { id: 'en', label: 'English', native: 'English' },
  { id: 'mg', label: 'Malagasy', native: 'Malagasy' },
];

const STORAGE_KEY = 'talkio.lang';

function initialLang(): Lang {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === 'fr' || s === 'en' || s === 'mg') return s;
  } catch {
    /* stockage indisponible */
  }
  return 'fr';
}

type Vars = Record<string, string | number>;
type TFn = (key: string, vars?: Vars) => string;

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFn;
}

const I18nContext = createContext<I18nState | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const t = useCallback<TFn>(
    (key, vars) => {
      const dict = translations[lang] ?? translations.fr;
      let str = dict[key] ?? translations.fr[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.split(`{${k}}`).join(String(v));
        }
      }
      return str;
    },
    [lang],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n doit être utilisé dans un I18nProvider');
  return ctx;
}

/** Raccourci quand seul `t` est nécessaire. */
export function useT() {
  return useI18n().t;
}
