import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AdaptResult, CoverLetterResult, InterviewResult, Lang, Market, TranslateResult } from '../shared/schema.ts';
import type { Application, CoverLetter, CvDocument, JobPostingDraft } from './types.ts';
import { applyAiContent, emptyCv, emptyLetter, letterDate, uid } from './lib/cv.ts';

interface State {
  cvs: CvDocument[];
  activeId: string;
  letter: CoverLetter;
  job: JobPostingDraft;
  applications: Application[];

  updateCv: (recipe: (cv: CvDocument) => CvDocument) => void;
  setActive: (id: string) => void;
  newCv: () => void;
  duplicateCv: (id: string) => void;
  deleteCv: (id: string) => void;
  /** Passe un CV en version Pro (après paiement d'un crédit). */
  unlockCv: (id: string) => void;
  renameCv: (id: string, label: string) => void;
  addAdaptedCv: (base: CvDocument, result: AdaptResult) => string;
  addTranslatedCv: (base: CvDocument, result: TranslateResult, lang: Lang, market: Market) => string;
  setJob: (job: JobPostingDraft) => void;
  addApplication: (fields: Partial<Application> & Pick<Application, 'title'>) => string;
  updateApplication: (id: string, patch: Partial<Application>) => void;
  deleteApplication: (id: string) => void;
  /** Range la fiche d'entretien dans la candidature correspondante (créée si besoin). */
  saveInterview: (applicationId: string | null, title: string, interview: InterviewResult) => string;
  updateLetter: (patch: Partial<CoverLetter>) => void;
  applyLetter: (result: CoverLetterResult, cv: CvDocument) => void;
}

export const MARKET_LABELS: Record<Market, string> = {
  international: 'English (international)',
  uk: 'English (UK)',
  us: 'English (US / Canada)',
  france: 'Français (France)',
  afrique: 'Français (Afrique)',
};

/**
 * Réglages d'affichage selon la langue : un CV anglophone n'affiche ni photo,
 * ni date de naissance, ni nationalité, ni signature (règles anti-discrimination).
 */
function settingsForLang(lang: Lang): Partial<CvDocument['settings']> {
  return lang === 'en'
    ? { headingLang: 'en', showPhoto: false, showBirthDate: false, showNationality: false, showSignature: false }
    : { headingLang: 'fr' };
}

const first = emptyCv();

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      cvs: [first],
      activeId: first.id,
      letter: emptyLetter(),
      job: { text: '', file: null },
      applications: [],

      updateCv: (recipe) =>
        set((s) => ({
          cvs: s.cvs.map((c) => (c.id === s.activeId ? { ...recipe(c), updatedAt: Date.now() } : c)),
        })),

      setActive: (id) => set({ activeId: id }),

      newCv: () => {
        const cv = emptyCv(`CV ${get().cvs.length + 1}`);
        set((s) => ({ cvs: [...s.cvs, cv], activeId: cv.id }));
      },

      duplicateCv: (id) => {
        const src = get().cvs.find((c) => c.id === id);
        if (!src) return;
        // Une copie repart en version gratuite : la version Pro est propre au CV débloqué.
        const copy: CvDocument = { ...structuredClone(src), id: uid(), label: `${src.label} (copie)`, updatedAt: Date.now(), unlocked: undefined };
        set((s) => ({ cvs: [...s.cvs, copy], activeId: copy.id }));
      },

      unlockCv: (id) => set((s) => ({ cvs: s.cvs.map((c) => (c.id === id ? { ...c, unlocked: { at: Date.now() } } : c)) })),
      deleteCv: (id) =>
        set((s) => {
          const cvs = s.cvs.filter((c) => c.id !== id);
          if (cvs.length === 0) cvs.push(emptyCv());
          return { cvs, activeId: s.activeId === id ? cvs[0].id : s.activeId };
        }),

      renameCv: (id, label) => set((s) => ({ cvs: s.cvs.map((c) => (c.id === id ? { ...c, label } : c)) })),

      addAdaptedCv: (base, result) => {
        const adapted = applyAiContent({ ...structuredClone(base), id: uid() }, result.cv, { mode: 'keepPersonal' });
        const where = [result.job.title, result.job.company].filter(Boolean).join(' – ');
        adapted.label = where ? `Adapté : ${where}` : 'CV adapté';
        adapted.adaptation = { job: result.job, analysis: result.analysis, createdAt: Date.now() };
        // Le CV adapté garde le statut du CV de départ (Pro seulement si celui-ci l'était).
        if (result.language !== base.settings.headingLang) {
          adapted.settings = { ...adapted.settings, ...settingsForLang(result.language) };
        }
        // Chaque adaptation ouvre une candidature dans le suivi.
        const now = Date.now();
        const application: Application = {
          id: uid(),
          title: result.job.title || 'Offre sans titre',
          company: result.job.company,
          location: result.job.location,
          status: 'preparation',
          createdAt: now,
          updatedAt: now,
          date: '',
          notes: '',
          cvId: adapted.id,
          score: { before: result.analysis.matchScore, after: result.analysis.matchScoreAfter },
        };
        set((s) => ({ cvs: [...s.cvs, adapted], activeId: adapted.id, applications: [application, ...s.applications] }));
        return adapted.id;
      },

      addTranslatedCv: (base, result, lang, market) => {
        const translated = applyAiContent({ ...structuredClone(base), id: uid() }, result.cv, { mode: 'keepContact' });
        // La version traduite garde le statut du CV de départ (Pro seulement si celui-ci l'était).
        translated.label = `${base.label} – ${MARKET_LABELS[market]}`;
        translated.settings = { ...translated.settings, ...settingsForLang(lang) };
        translated.translation = { lang, market, notes: result.notes, createdAt: Date.now() };
        set((s) => ({ cvs: [...s.cvs, translated], activeId: translated.id }));
        return translated.id;
      },

      setJob: (job) => set({ job }),

      addApplication: (fields) => {
        const now = Date.now();
        const application: Application = {
          company: '',
          location: '',
          status: 'preparation',
          date: '',
          notes: '',
          ...fields,
          id: uid(),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ applications: [application, ...s.applications] }));
        return application.id;
      },

      updateApplication: (id, patch) =>
        set((s) => ({ applications: s.applications.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a)) })),

      deleteApplication: (id) => set((s) => ({ applications: s.applications.filter((a) => a.id !== id) })),

      saveInterview: (applicationId, title, interview) => {
        const existing = applicationId && get().applications.find((a) => a.id === applicationId);
        if (existing) {
          get().updateApplication(existing.id, { interview });
          return existing.id;
        }
        return get().addApplication({ title, interview });
      },

      updateLetter: (patch) => set((s) => ({ letter: { ...s.letter, ...patch } })),

      applyLetter: (result, cv) =>
        set((s) => ({
          letter: {
            ...s.letter,
            lang: result.language,
            date: result.language === (s.letter.lang ?? 'fr') ? s.letter.date : letterDate(result.language),
            recipientName: result.recipientName,
            recipientCompany: result.recipientCompany,
            recipientAddress: result.recipientAddress,
            subject: result.subject,
            salutation: result.salutation,
            body: result.paragraphs.join('\n\n'),
            closing: result.closing,
            place: s.letter.place || cv.personal.city,
            accent: cv.settings.accent,
          },
        })),
    }),
    {
      name: 'cv-studio',
      version: 1,
      // Le fichier joint à l'offre peut être lourd : on ne le garde pas dans le stockage local.
      partialize: (s) => ({
        cvs: s.cvs,
        activeId: s.activeId,
        letter: s.letter,
        job: { text: s.job.text, file: null },
        applications: s.applications,
      }),
    },
  ),
);

export const useActiveCv = (): CvDocument => useStore((s) => s.cvs.find((c) => c.id === s.activeId) ?? s.cvs[0]);
