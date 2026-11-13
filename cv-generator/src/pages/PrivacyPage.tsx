import { Card } from '../components/ui.tsx';

import { t } from '../i18n.ts';
// Politique de confidentialité (lien discret en bas de l'accueil ; demandée aussi par le Play Store).

const SECTIONS: { title: string; text: string[] }[] = [
  {
    title: t('Vos CV et vos lettres'),
    text: [
      t('Vos CV, lettres et candidatures sont enregistrés sur votre appareil (téléphone ou ordinateur), pas sur nos serveurs.'),
      t('Quand vous demandez une adaptation à une offre, une lettre, une fiche entretien, une traduction ou une retranscription, le contenu nécessaire est transmis à notre serveur et à notre prestataire de traitement du texte, le temps de produire le résultat. Nous ne le conservons pas après.'),
    ],
  },
  {
    title: t('Votre compte'),
    text: [
      t('Le compte sert à gérer vos crédits. Nous gardons votre e-mail ou numéro de téléphone, votre prénom, votre mot de passe sous forme chiffrée, votre solde de crédits et l’historique de vos achats.'),
      t('Votre phrase ou question secrète est gardée sous forme chiffrée : personne ne peut la lire, elle sert seulement à vérifier votre identité si vous oubliez votre mot de passe.'),
    ],
  },
  {
    title: t('Le coffre-fort'),
    text: [
      t('Les documents du coffre-fort restent sur votre appareil et ne sont jamais envoyés sur internet.'),
      t('Avec un code, ils sont chiffrés par une clé propre à votre coffre. Pour que vous puissiez réinitialiser un code oublié, une copie de secours de cette clé est associée à votre compte. Elle ne donne accès à aucun document : ceux-ci ne quittent pas votre appareil.'),
      t('Si vous désinstallez l’application ou effacez ses données, le contenu du coffre est supprimé de l’appareil : faites d’abord une copie de secours.'),
    ],
  },
  {
    title: t('Paiements'),
    text: [t('Les paiements Mobile Money sont traités par FedaPay. Nous ne voyons ni ne gardons vos informations de paiement, seulement le montant, la date et le résultat.')],
  },
  {
    title: t('Messages et témoignages'),
    text: [
      t('Les messages envoyés dans « Nous contacter » sont gardés pour pouvoir vous répondre.'),
      t('Un témoignage n’est publié qu’avec votre accord, après vérification, et vous pouvez le retirer à tout moment.'),
    ],
  },
  {
    title: t('Programme Ambassadeur'),
    text: [
      t('Si vous devenez ambassadeur, nous gardons vos nom et prénoms légaux, votre numéro Mobile Money, la signature de votre contrat (date, version, adresse internet), vos statistiques de parrainage et l’historique de vos paiements, pour gérer le programme et vous payer.'),
      t('Les justificatifs envoyés pour changer de numéro (pièce d’identité, capture du compte) ne servent qu’à vérifier votre identité et sont supprimés dès que la demande est traitée.'),
    ],
  },
  {
    title: t('Vos droits'),
    text: [t('Vous pouvez demander à consulter, corriger ou supprimer votre compte et vos données à tout moment en nous écrivant dans « Nous contacter ».')],
  },
];

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card title={t('Confidentialité')} subtitle={t('Ce que CVCasa garde, et ce qui reste chez vous.')}>
        <div className="space-y-5">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-base font-semibold text-slate-900">{s.title}</h2>
              {s.text.map((t, i) => (
                <p key={i} className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {t}
                </p>
              ))}
            </section>
          ))}
          <p className="text-xs text-slate-500">{t('Dernière mise à jour : octobre 2026.')}</p>
        </div>
      </Card>
    </div>
  );
}
