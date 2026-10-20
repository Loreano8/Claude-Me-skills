import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AdaptResult, CoverLetterResult } from '../shared/schema.ts';
import type { CoverLetter, CvDocument, JobPostingDraft } from './types.ts';
import { applyAiContent, emptyCv, emptyLetter, uid } from './lib/cv.ts';

interface State {
  cvs: CvDocument[];
  activeId: string;
  letter: CoverLetter;
  job: JobPostingDraft;

  updateCv: (recipe: (cv: CvDocument) => CvDocument) => void;
  setActive: (id: string) => void;
  newCv: () => void;
  duplicateCv: (id: string) => void;
  deleteCv: (id: string) => void;
  renameCv: (id: string, label: string) => void;
  addAdaptedCv: (base: CvDocument, result: AdaptResult) => string;
  setJob: (job: JobPostingDraft) => void;
  updateLetter: (patch: Partial<CoverLetter>) => void;
  applyLetter: (result: CoverLetterResult, cv: CvDocument) => void;
}

const first = emptyCv();

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      cvs: [first],
      activeId: first.id,
      letter: emptyLetter(),
      job: { text: '', file: null },

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
        const copy: CvDocument = { ...structuredClone(src), id: uid(), label: `${src.label} (copie)`, updatedAt: Date.now() };
        set((s) => ({ cvs: [...s.cvs, copy], activeId: copy.id }));
      },

      deleteCv: (id) =>
        set((s) => {
          const cvs = s.cvs.filter((c) => c.id !== id);
          if (cvs.length === 0) cvs.push(emptyCv());
          return { cvs, activeId: s.activeId === id ? cvs[0].id : s.activeId };
        }),

      renameCv: (id, label) => set((s) => ({ cvs: s.cvs.map((c) => (c.id === id ? { ...c, label } : c)) })),

      addAdaptedCv: (base, result) => {
        const adapted = applyAiContent({ ...structuredClone(base), id: uid() }, result.cv, { keepPersonal: true });
        const where = [result.job.title, result.job.company].filter(Boolean).join(' – ');
        adapted.label = where ? `Adapté : ${where}` : 'CV adapté';
        adapted.adaptation = { job: result.job, analysis: result.analysis, createdAt: Date.now() };
        set((s) => ({ cvs: [...s.cvs, adapted], activeId: adapted.id }));
        return adapted.id;
      },

      setJob: (job) => set({ job }),

      updateLetter: (patch) => set((s) => ({ letter: { ...s.letter, ...patch } })),

      applyLetter: (result, cv) =>
        set((s) => ({
          letter: {
            ...s.letter,
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
      }),
    },
  ),
);

export const useActiveCv = (): CvDocument => useStore((s) => s.cvs.find((c) => c.id === s.activeId) ?? s.cvs[0]);
