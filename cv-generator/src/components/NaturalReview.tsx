import { CheckCircle2, Feather } from 'lucide-react';
import type { ClicheHit } from '../lib/naturalCheck.ts';
import { Card } from './ui.tsx';

/** « Relecture naturelle » : les formules toutes faites à reformuler soi-même (gratuit, sans IA). */
export function NaturalReview({ hits, edit }: { hits: ClicheHit[]; edit: string }) {
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Feather className="size-5 text-emerald-600" /> Relecture naturelle
        </span>
      }
      subtitle="Les formules qu’on lit dans tous les CV et toutes les lettres. Remplacez-les par vos propres mots ou par un fait : votre texte sonnera vraiment comme vous."
    >
      {hits.length === 0 ? (
        <p className="flex gap-2 text-sm text-slate-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> Aucune formule toute faite repérée.
        </p>
      ) : (
        <>
          <ul className="space-y-2.5">
            {hits.map((h) => (
              <li key={h.label} className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">« {h.label} »</span>
                <span className="text-slate-500"> · {h.where.join(', ')}</span>
                <br />
                {h.tip}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">{edit}</p>
        </>
      )}
    </Card>
  );
}
