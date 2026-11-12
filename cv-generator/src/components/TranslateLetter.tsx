import { useState } from 'react';
import { Languages } from 'lucide-react';
import { useActiveCv, useStore } from '../store.ts';
import { api, ApiError } from '../lib/api.ts';
import { t } from '../i18n.ts';
import { Button, Card, Cost, Notice } from './ui.tsx';

/**
 * La lettre dans l'autre langue (français ↔ anglais), avec les usages du pays (formule d'appel, politesse).
 * La version traduite est une nouvelle lettre : l'originale reste dans « Mes documents ».
 */
export function TranslateLetter() {
  const cv = useActiveCv();
  const letter = useStore((s) => s.letter);
  const applyLetter = useStore((s) => s.applyLetter);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Langue de la version créée (gardée : la lettre affichée change de langue juste après). */
  const [done, setDone] = useState<'fr' | 'en' | null>(null);
  const target = (letter.lang ?? 'fr') === 'fr' ? 'en' : 'fr';

  async function run() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await api.translateLetter({
        targetLang: target,
        letter: {
          recipientName: letter.recipientName,
          recipientCompany: letter.recipientCompany,
          recipientAddress: letter.recipientAddress,
          subject: letter.subject,
          salutation: letter.salutation,
          paragraphs: letter.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
          closing: letter.closing,
        },
      });
      applyLetter(res, cv);
      setDone(target);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('Une erreur est survenue. Réessayez.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Languages className="size-5 text-brand-600" aria-hidden="true" /> {t('Ma lettre dans une autre langue')}
        </span>
      }
      subtitle={t('Même contenu, avec les formules d’usage du pays. Votre lettre d’origine est gardée dans « Mes documents ».')}
    >
      <Button variant="secondary" icon={<Languages className="size-4" />} loading={busy} onClick={() => void run()}>
        {target === 'en' ? t('Traduire en anglais') : t('Traduire en français')} <Cost />
      </Button>
      {busy && <p className="mt-2 text-sm text-brand-700">{t('Traduction en cours… (jusqu’à une minute)')}</p>}
      {done && (
        <div className="mt-3">
          <Notice tone="success">{done === 'en' ? t('Votre lettre en anglais est prête, ci-dessus.') : t('Votre lettre en français est prête, ci-dessus.')}</Notice>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Card>
  );
}
