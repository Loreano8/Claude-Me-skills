import { create } from 'zustand';

/**
 * Apparence : « auto » suit le réglage du téléphone (ou de l'ordinateur), « clair » et « sombre » le forcent.
 * Le choix est gardé sur l'appareil. Au chargement, index.html applique déjà le bon thème (pas d'éclair blanc).
 */
export type ThemePref = 'auto' | 'light' | 'dark';

const KEY = 'cvcasa-theme';
const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export const resolveTheme = (pref: ThemePref, systemDark: boolean): 'light' | 'dark' => (pref === 'auto' ? (systemDark ? 'dark' : 'light') : pref);

function apply(pref: ThemePref) {
  const theme = resolveTheme(pref, Boolean(media?.matches));
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1220' : '#2549eb');
}

export const useTheme = create<{ pref: ThemePref; setPref: (pref: ThemePref) => void }>((set) => ({
  pref: read(),
  setPref: (pref) => {
    try {
      if (pref === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch {
      /* stockage indisponible : le choix vaut pour cette visite */
    }
    apply(pref);
    set({ pref });
  },
}));

// Le téléphone passe en mode sombre (ou en clair) pendant que l'appli est ouverte : on suit, si le choix est « auto ».
const onSystemChange = () => apply(useTheme.getState().pref);
if (media) {
  if (media.addEventListener) media.addEventListener('change', onSystemChange);
  else media.addListener?.(onSystemChange);
}
if (typeof document !== 'undefined') apply(read());
