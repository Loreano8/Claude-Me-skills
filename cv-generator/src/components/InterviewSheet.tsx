import { useState } from 'react';
import { AlertTriangle, ChevronDown, Copy, HelpCircle, Lightbulb, MessageSquareQuote } from 'lucide-react';
import type { InterviewResult } from '../../shared/schema.ts';
import { Button, cx } from './ui.tsx';

function asText(sheet: InterviewResult, title: string): string {
  const lines = [`Fiche entretien – ${title}`, ''];
  sheet.questions.forEach((q, i) => lines.push(`${i + 1}. ${q.question}`, `   Pourquoi : ${q.why}`, `   Ma réponse : ${q.answer}`, ''));
  if (sheet.weakPoints.length) lines.push('Points à préparer :', ...sheet.weakPoints.map((w) => `- ${w.gap} → ${w.howToAddress}`), '');
  if (sheet.questionsToAsk.length) lines.push('Mes questions au recruteur :', ...sheet.questionsToAsk.map((q) => `- ${q}`), '');
  if (sheet.tips.length) lines.push('Conseils :', ...sheet.tips.map((t) => `- ${t}`));
  return lines.join('\n');
}

/** Fiche de préparation à l'entretien : questions probables, réponses tirées du CV, points faibles. */
export function InterviewSheet({ sheet, title }: { sheet: InterviewResult; title: string }) {
  const [open, setOpen] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(asText(sheet, title));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <MessageSquareQuote className="size-4 text-brand-600" /> Questions probables et réponses
        </p>
        <div className="space-y-2">
          {sheet.questions.map((q, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white">
              <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-start gap-2 px-3 py-2.5 text-left">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span>
                <span className="flex-1 text-sm font-medium text-slate-900">{q.question}</span>
                <ChevronDown className={cx('mt-0.5 size-4 shrink-0 text-slate-400 transition-transform', open === i && 'rotate-180')} />
              </button>
              {open === i && (
                <div className="space-y-2 border-t border-slate-100 px-3 py-2.5 text-sm">
                  <p className="text-slate-500">
                    <span className="font-medium text-slate-600">Pourquoi : </span>
                    {q.why}
                  </p>
                  <p className="rounded-lg bg-emerald-50 p-2.5 text-emerald-950">
                    <span className="font-semibold">Votre réponse : </span>
                    {q.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {sheet.weakPoints.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-3">
          <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="size-4" /> Les points à préparer
          </p>
          <ul className="space-y-1.5 text-sm text-amber-950">
            {sheet.weakPoints.map((w, i) => (
              <li key={i}>
                <span className="font-medium">{w.gap}</span> — {w.howToAddress}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheet.questionsToAsk.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <HelpCircle className="size-4 text-brand-600" /> Vos questions au recruteur
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {sheet.questionsToAsk.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {sheet.tips.length > 0 && (
        <div className="rounded-xl bg-sky-50 p-3">
          <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-sky-900">
            <Lightbulb className="size-4" /> Conseils pour le jour J
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-sky-900">
            {sheet.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <Button variant="secondary" size="sm" icon={<Copy className="size-4" />} onClick={copy}>
        {copied ? 'Copié !' : 'Copier la fiche (pour WhatsApp, notes…)'}
      </Button>
    </div>
  );
}
