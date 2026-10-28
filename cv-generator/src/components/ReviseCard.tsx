import { useState } from 'react';
import { MessageSquareText, PenLine, Undo2 } from 'lucide-react';
import { useActiveCv, useStore } from '../store.ts';
import type { CvDocument } from '../types.ts';
import { api } from '../lib/api.ts';
import { applyAiContent, toAiContent } from '../lib/cv.ts';
import { appendSpoken, MicButton } from './MicButton.tsx';
import { Button, Card, Notice, TextArea } from './ui.tsx';

const PLACEHOLDER = `Dites ou écrivez ce qu’il faut changer, par exemple :
« Mets mon expérience chez MTN en premier »
« Enlève le permis de conduire »
« Mon accroche est trop longue, raccourcis-la »
« Ajoute que je parle aussi fon, niveau courant »`;

/** Corrections du CV en langage naturel, dictées ou écrites, appliquées par l'IA. */
export function ReviseCard() {
  const cv = useActiveCv();
  const updateCv = useStore((s) => s.updateCv);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ changes: string[]; notDone: string[] } | null>(null);
  const [undo, setUndo] = useState<CvDocument | null>(null);

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const before = structuredClone(cv);
      const res = await api.revise({ cv: toAiContent(cv), instructions: text, lang: cv.settings.headingLang });
      updateCv((c) => applyAiContent(c, res.cv));
      setUndo(before);
      setResult({ changes: res.changes, notDone: res.notDone });
      setText('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className="border-brand-100"
      title={
        <span className="flex items-center gap-2">
          <MessageSquareText className="size-5 text-brand-600" /> Corriger mon CV en parlant
        </span>
      }
      subtitle="Dites simplement ce que vous voulez changer, comme vous le diriez à un ami : CV Studio fait les changements."
    >
      <div className="mb-3">
        <MicButton onText={(t) => setText((cur) => appendSpoken(cur, t))} lang={cv.settings.headingLang} label="Dicter mes corrections" />
      </div>
      <TextArea value={text} onChange={setText} rows={4} placeholder={PLACEHOLDER} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="ai" icon={<PenLine className="size-4" />} loading={busy} disabled={busy || !text.trim()} onClick={apply}>
          Appliquer les corrections
        </Button>
        {undo && !busy && (
          <Button
            variant="ghost"
            icon={<Undo2 className="size-4" />}
            onClick={() => {
              updateCv(() => undo);
              setUndo(null);
              setResult(null);
            }}
          >
            Annuler
          </Button>
        )}
        <span className="text-xs text-slate-500">1 crédit</span>
      </div>
      {busy && <p className="mt-3 text-sm text-brand-700">Corrections en cours…</p>}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {result && (
        <div className="mt-4 space-y-2 rounded-xl bg-white p-3 text-sm ring-1 ring-brand-100">
          {result.changes.length > 0 && (
            <>
              <p className="font-semibold text-slate-800">C’est fait :</p>
              <ul className="list-disc space-y-1 pl-5 text-slate-700">
                {result.changes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </>
          )}
          {result.notDone.length > 0 && (
            <>
              <p className="font-semibold text-amber-800">À préciser :</p>
              <ul className="list-disc space-y-1 pl-5 text-amber-900">
                {result.notDone.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
