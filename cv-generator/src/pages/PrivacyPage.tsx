import { Card } from '../components/ui.tsx';

// Politique de confidentialité (lien discret en bas de l'accueil ; demandée aussi par le Play Store).

const SECTIONS: { title: string; text: string[] }[] = [
  {
    title: 'Vos CV et vos lettres',
    text: [
      'Vos CV, lettres et candidatures sont enregistrés sur votre appareil (téléphone ou ordinateur), pas sur nos serveurs.',
      'Quand vous demandez une adaptation à une offre, une lettre, une fiche entretien, une traduction ou une retranscription, le contenu nécessaire est transmis à notre serveur et à notre prestataire de traitement du texte, le temps de produire le résultat. Nous ne le conservons pas après.',
    ],
  },
  {
    title: 'Votre compte',
    text: [
      'Le compte sert à gérer vos crédits. Nous gardons votre e-mail ou numéro de téléphone, votre prénom, votre mot de passe sous forme chiffrée, votre solde de crédits et l’historique de vos achats.',
      'Votre phrase ou question secrète est gardée sous forme chiffrée : personne ne peut la lire, elle sert seulement à vérifier votre identité si vous oubliez votre mot de passe.',
    ],
  },
  {
    title: 'Le coffre-fort',
    text: [
      'Les documents du coffre-fort restent sur votre appareil et ne sont jamais envoyés sur internet.',
      'Avec un code, ils sont chiffrés par une clé propre à votre coffre. Pour que vous puissiez réinitialiser un code oublié, une copie de secours de cette clé est associée à votre compte. Elle ne donne accès à aucun document : ceux-ci ne quittent pas votre appareil.',
      'Si vous désinstallez l’application ou effacez ses données, le contenu du coffre est supprimé de l’appareil : faites d’abord une copie de secours.',
    ],
  },
  {
    title: 'Paiements',
    text: ['Les paiements Mobile Money sont traités par FedaPay. Nous ne voyons ni ne gardons vos informations de paiement, seulement le montant, la date et le résultat.'],
  },
  {
    title: 'Messages et témoignages',
    text: [
      'Les messages envoyés dans « Nous contacter » sont gardés pour pouvoir vous répondre.',
      'Un témoignage n’est publié qu’avec votre accord, après vérification, et vous pouvez le retirer à tout moment.',
    ],
  },
  {
    title: 'Vos droits',
    text: ['Vous pouvez demander à consulter, corriger ou supprimer votre compte et vos données à tout moment en nous écrivant dans « Nous contacter ».'],
  },
];

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card title="Confidentialité" subtitle="Ce que CV Studio garde, et ce qui reste chez vous.">
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
          <p className="text-xs text-slate-400">Dernière mise à jour : octobre 2026.</p>
        </div>
      </Card>
    </div>
  );
}
