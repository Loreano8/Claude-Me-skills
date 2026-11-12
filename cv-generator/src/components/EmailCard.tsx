import { useState } from 'react';
import { Check, Copy, Send } from 'lucide-react';
import { mailto, type EmailDraft } from '../lib/emails.ts';
import { Button, Field, TextArea } from './ui.tsx';

/**
 * Un e-mail prêt : on peut le retoucher, le copier, ou l'ouvrir directement dans sa messagerie.
 * `onUsed` est appelé quand la personne le copie ou l'ouvre (pour noter la candidature comme envoyée, ou la relance comme faite).
 */
export function EmailCard({ draft, hint, onUsed }: { draft: EmailDraft; hint: string; onUsed?: (to: string) => void }) {
  const [to, setTo] = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = `Objet : ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Presse-papiers refusé : on sélectionne le texte pour une copie à la main.
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    onUsed?.(to);
  }

  return (
    <div className="space-y-3">
      <Field label="À (adresse du recruteur)" type="email" value={to} onChange={setTo} placeholder="Ex. recrutement@entreprise.com" />
      <Field label="Objet de l’e-mail" value={subject} onChange={setSubject} />
      <TextArea label="Texte de l’e-mail" value={body} onChange={setBody} rows={9} />
      <div className="flex flex-wrap gap-2">
        <a
          href={mailto({ to, subject, body })}
          onClick={() => onUsed?.(to)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          <Send className="size-4" aria-hidden="true" /> Ouvrir ma messagerie
        </a>
        <Button variant="secondary" icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} onClick={() => void copy()}>
          {copied ? 'Copié' : 'Copier le message'}
        </Button>
      </div>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}
