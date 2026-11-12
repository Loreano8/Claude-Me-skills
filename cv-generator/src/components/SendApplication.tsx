import { Mail } from 'lucide-react';
import { applicationEmail, findEmail } from '../lib/emails.ts';
import { isPlaceholderTitle, useActiveCv, useStore } from '../store.ts';
import { EmailCard } from './EmailCard.tsx';
import { Card, Cost } from './ui.tsx';

import { t } from '../i18n.ts';
/** Sous la lettre : l'e-mail qui accompagne la candidature, prêt à envoyer. Gratuit, préparé sur l'appareil. */
export function SendApplication() {
  const cv = useActiveCv();
  const letter = useStore((s) => s.letter);
  const job = useStore((s) => s.job);
  const app = useStore((s) => s.applications.find((a) => a.cvId === cv.id) ?? null);
  const updateApplication = useStore((s) => s.updateApplication);

  const position = app?.title && !isPlaceholderTitle(app.title) ? app.title : cv.adaptation?.job.title || cv.personal.title;
  const company = app?.company || letter.recipientCompany || cv.adaptation?.job.company || '';
  const draft = applicationEmail(cv, { position, company, withLetter: true, to: app?.contactEmail || findEmail(job.text), lang: letter.lang });

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Mail className="size-5 text-brand-600" aria-hidden="true" /> {' '}{t('L’e-mail pour envoyer votre candidature')}{' '}<Cost free />
        </span>
      }
      subtitle={t('Le message à mettre dans l’e-mail, avec votre CV et votre lettre en pièces jointes.')}
    >
      <EmailCard
        draft={draft}
        hint={t('Pensez à joindre votre CV et votre lettre en PDF (boutons « PDF » ci-dessus). Une fois envoyée, la candidature passe en « Envoyée » dans le suivi : nous vous proposerons une relance dans 7 jours.')}
        onUsed={(to) => app && updateApplication(app.id, { status: app.status === 'preparation' ? 'envoyee' : app.status, contactEmail: to || app.contactEmail })}
      />
    </Card>
  );
}
