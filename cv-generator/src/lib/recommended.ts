import type { CvDocument, CvSettings } from '../types.ts';

type DisplaySettings = Pick<CvSettings, 'showPhoto' | 'showBirthDate' | 'showNationality' | 'showSignature'>;

/**
 * Réglages d'affichage recommandés pour ce CV (bouton « Recommandé ») : ce qui se fait d'habitude,
 * selon la langue du CV, le pays visé et le modèle choisi. Renvoie aussi la raison, affichée à la personne.
 */
export function recommendedDisplay(cv: CvDocument): { settings: DisplaySettings; reason: string } {
  const st = cv.settings;
  const market = cv.translation?.market;
  const none: DisplaySettings = { showPhoto: false, showBirthDate: false, showNationality: false, showSignature: false };

  if (st.template === 'canada' || market === 'us') {
    return { settings: none, reason: 'Amérique du Nord : ni photo, ni date de naissance, ni nationalité, ni signature.' };
  }
  if (st.headingLang === 'en' || market === 'uk' || market === 'international') {
    return { settings: none, reason: 'CV en anglais : l’usage est de ne mettre ni photo, ni date de naissance, ni nationalité.' };
  }
  if (st.template === 'concours') {
    return {
      settings: { showPhoto: true, showBirthDate: true, showNationality: true, showSignature: false },
      reason: 'Concours et administrations : date de naissance et nationalité sont souvent demandées.',
    };
  }
  // Photo laissée active même sans photo : elle apparaîtra dès qu'elle sera ajoutée.
  return {
    settings: { showPhoto: true, showBirthDate: false, showNationality: false, showSignature: false },
    reason: cv.photo
      ? 'Usage courant : une photo professionnelle, sans date de naissance ni nationalité (elles ne sont pas nécessaires et peuvent desservir).'
      : 'Usage courant : pas de date de naissance ni de nationalité. Une photo professionnelle est un plus : ajoutez-la dans « Mes infos ».',
  };
}

export function isRecommended(cv: CvDocument): boolean {
  const { settings } = recommendedDisplay(cv);
  return (Object.keys(settings) as (keyof DisplaySettings)[]).every((k) => cv.settings[k] === settings[k]);
}
