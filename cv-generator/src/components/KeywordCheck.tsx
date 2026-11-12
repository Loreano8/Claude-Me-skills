import { useState } from 'react';
import { CheckCircle2, CircleDashed, ScanSearch } from 'lucide-react';
import { api } from '../lib/api.ts';
import { useAccount } from '../lib/account.ts';
import { coverage } from '../lib/keywords.ts';
import { jobKey } from '../lib/jobKey.ts';
import { useStore } from '../store.ts';
import type { CvDocument } from '../types.ts';
import { Button, Card, Cost, cx, Notice } from './ui.tsx';

import { t } from '../i18n.ts';
/**
 * Vérificateur gratuit : les mots-clés de l'offre déjà présents dans le CV, et ceux qui manquent.
 * Le serveur relève les mots-clés une fois par offre ; la comparaison avec le CV se fait sur l'appareil et suit chaque modification.
 */
export function KeywordCheck({ cv }: { cv: CvDocument }) {
  const job = useStore((s) => s.job);
  const saved = useStore((s) => s.jobKeywords);
  const setJobKeywords = useStore((s) => s.setJobKeywords);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = jobKey(job);
  const result = saved?.key === key ? saved.result : null;

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.keywords({ job: { text: job.text, file: job.file ? { name: job.file.name, mediaType: job.file.mediaType, data: job.file.data } : null, answers: '' } });
      setJobKeywords({ key, result: res });
    } catch (e) {
      // Pas connecté : la fenêtre de connexion s'est ouverte, rien à afficher ici.
      if (useAccount.getState().dialog !== 'account') setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const c = result ? coverage(cv, result.keywords) : null;

  return (
    <Card
      tour="keywords"
      title={
        <span className="flex items-center gap-2">
          <ScanSearch className="size-5 text-brand-600" aria-hidden="true" /> {' '}{t('Votre CV contient-il les mots de l’offre ?')}</span>
      }
      subtitle={t('Les recruteurs et leurs logiciels cherchent ces mots dans les CV.')}
    >
      {!result && (
        <>
          <Button variant="secondary" loading={busy} onClick={() => void check()}>
            {t('Vérifier mes mots-clés')}{' '}<Cost free />
          </Button>
          {error && (
            <div className="mt-3">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
        </>
      )}
      {c && result && (
        <div>
          {result.keywords.length === 0 ? (
            <Notice tone="warn">{t('Aucun mot-clé trouvé : ce texte ne ressemble pas à une offre d’emploi. Vérifiez l’annonce collée ci-dessus.')}</Notice>
          ) : (
            <>
              <p className="font-display text-2xl font-semibold text-ink">
                {t('{0} sur {1}', [c.present.length, result.keywords.length])}{' '}<span className="text-base font-normal text-slate-600">{t('mots-clés de l’offre sont dans votre CV')}</span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.percent} aria-label={t('Mots-clés présents')}>
                <div className={cx('h-full rounded-full', c.percent >= 70 ? 'bg-emerald-600' : c.percent >= 40 ? 'bg-sun-400' : 'bg-red-500')} style={{ width: `${c.percent}%` }} />
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {result.keywords.map((k) => {
                  const ok = c.present.includes(k);
                  return (
                    <li key={k.term} className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm', ok ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900')}>
                      {ok ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <CircleDashed className="size-4" aria-hidden="true" />}
                      {k.term}
                      <span className="sr-only">{ok ? t(' : présent') : ' : absent'}</span>
                    </li>
                  );
                })}
              </ul>
              {c.missing.length > 0 && (
                <p className="mt-3 text-sm text-slate-600">
                  {t('N’ajoutez que ce que vous maîtrisez vraiment. « Adapter mon CV » reprend ces mots là où votre parcours les justifie, sans rien inventer.')}</p>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
