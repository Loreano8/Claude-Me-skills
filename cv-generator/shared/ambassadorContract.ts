// Contrat du programme Ambassadeur, signé en ligne lors de la demande (nom légal exact + signature tapée).
// Chaque version acceptée est enregistrée (numéro de version, date, adresse internet, signature) : si le texte change,
// on passe à une nouvelle version et les ambassadeurs la signent à nouveau.
// Texte de base, à faire relire par un juriste avant que le programme prenne de l'ampleur.

export const AMBASSADOR_CONTRACT_VERSION = '2026-11-v1';

export type ContractSection = { title: string; text: string[] };

export type ContractNumbers = {
  signupReward: number;
  signupRewardLimit: number;
  firstPurchaseReward: number;
  commissionPercent: number;
  commissionMonths: number;
  holdDays: number;
  minPayout: number;
  monthlyCap: number;
  payoutFeePercent: number;
};

const f = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;
const fe = (n: number) => `${n.toLocaleString('en-GB')} FCFA`;

/** Le contrat, dans la langue de l'interface (la version française fait foi). */
export function ambassadorContract(lang: 'fr' | 'en', r: ContractNumbers): ContractSection[] {
  if (lang === 'en') {
    return [
      { title: '1. Parties', text: ['This agreement is between CVCasa (cvcasa.com), the service publisher, and the person identified below by their legal first and last names (“the Ambassador”). The French version of this agreement prevails.'] },
      { title: '2. Purpose', text: ['The Ambassador recommends CVCasa to people around them using their personal link. In return, they receive the rewards described below. The Ambassador acts independently: this agreement is neither an employment contract nor an exclusive agency, and does not entitle them to act or sign on behalf of CVCasa.'] },
      {
        title: '3. Rewards',
        text: [
          `${fe(r.signupReward)} for each new person who signs up through the link and creates their first CV, for the Ambassador's first ${r.signupRewardLimit} referrals only.`,
          `${fe(r.firstPurchaseReward)} when a referred person makes their first purchase, then ${r.commissionPercent}% of each of their purchases for ${r.commissionMonths} months after they sign up.`,
          `Earnings become available ${r.holdDays} days after the sign-up or purchase. They are capped at ${fe(r.monthlyCap)} per month.`,
          'Nothing is due for an account created by the Ambassador themself, on their own phone, or for a person who was already a customer.',
        ],
      },
      {
        title: '4. Payment',
        text: [
          `Withdrawals can be requested from ${fe(r.minPayout)} available. CVCasa sends them by Mobile Money within a few days, only to a number registered in the Ambassador's legal name as entered in this agreement. Mobile Money transfer fees (${r.payoutFeePercent}%) are deducted from the amount sent.`,
          'Changing the payment number requires proof (identity document and proof that the number is in the Ambassador’s name). No payment is made while a change is being reviewed.',
        ],
      },
      {
        title: '5. Ambassador’s commitments',
        text: [
          'Present CVCasa honestly: no false promises (for example a guaranteed job), no misleading information about prices.',
          'Do not send unsolicited messages in bulk (spam), and respect the rules of the groups and platforms used.',
          'Do not create fake accounts, buy for oneself through another account, or use any other means to obtain undue rewards.',
          'Do not present oneself as an employee or representative of CVCasa, and do not use the CVCasa name or logo in a misleading way.',
          'Comply with the laws in force, in particular on advertising and personal data.',
        ],
      },
      { title: '6. Fraud and sanctions', text: ['In the event of fraud or breach of these commitments, CVCasa may suspend the account, cancel earnings not yet paid and end this agreement. Earnings obtained by fraud must be repaid.'] },
      { title: '7. Taxes', text: ['The Ambassador is responsible for declaring the income received under this agreement, according to the rules of their country.'] },
      { title: '8. Personal data', text: ['CVCasa keeps the Ambassador’s legal name, Mobile Money number, signature of this agreement, referral statistics and payment history, in order to run the programme and pay the rewards. Documents sent to change the payment number are deleted once the request has been processed. The Ambassador can ask to see or correct this data via “Contact us”.'] },
      { title: '9. Duration and changes', text: ['This agreement starts when CVCasa approves the application, for an indefinite period. Either party may end it at any time; earnings already available remain payable. CVCasa may change or end the programme: any change applies only after the Ambassador has been informed, and earnings already available remain payable.'] },
      { title: '10. Applicable law', text: ['This agreement is governed by Beninese law. The parties will first seek an amicable solution through “Contact us”.'] },
    ];
  }
  return [
    { title: '1. Les parties', text: ['Ce contrat est conclu entre CVCasa (cvcasa.com), éditeur du service, et la personne identifiée ci-dessous par ses nom et prénoms légaux (« l’Ambassadeur »).'] },
    { title: '2. Objet', text: ['L’Ambassadeur recommande CVCasa autour de lui grâce à son lien personnel. En échange, il reçoit les rémunérations décrites ci-dessous. L’Ambassadeur agit de façon indépendante : ce contrat n’est ni un contrat de travail ni un mandat exclusif, et ne lui permet pas d’agir ou de signer au nom de CVCasa.'] },
    {
      title: '3. Rémunération',
      text: [
        `${f(r.signupReward)} pour chaque nouvelle personne qui s’inscrit par le lien et crée son premier CV, pour les ${r.signupRewardLimit} premiers filleuls de l’Ambassadeur seulement.`,
        `${f(r.firstPurchaseReward)} au premier achat d’un filleul, puis ${r.commissionPercent} % de chacun de ses achats pendant ${r.commissionMonths} mois après son inscription.`,
        `Les gains deviennent disponibles ${r.holdDays} jours après l’inscription ou l’achat. Ils sont plafonnés à ${f(r.monthlyCap)} par mois.`,
        'Rien n’est dû pour un compte créé par l’Ambassadeur lui-même, sur son propre téléphone, ni pour une personne qui était déjà cliente.',
      ],
    },
    {
      title: '4. Paiement',
      text: [
        `Le retrait peut être demandé à partir de ${f(r.minPayout)} disponibles. CVCasa l’envoie par Mobile Money sous quelques jours, uniquement vers un numéro enregistré au nom légal de l’Ambassadeur tel qu’indiqué dans ce contrat. Les frais d’envoi Mobile Money (${r.payoutFeePercent} %) sont déduits du montant envoyé.`,
        'Le changement de numéro de paiement se fait sur justificatifs (pièce d’identité et preuve que le numéro est au nom de l’Ambassadeur). Aucun paiement n’est fait pendant l’examen d’un changement.',
      ],
    },
    {
      title: '5. Engagements de l’Ambassadeur',
      text: [
        'Présenter CVCasa honnêtement : pas de fausses promesses (par exemple un emploi garanti), pas d’informations trompeuses sur les prix.',
        'Ne pas envoyer de messages non sollicités en masse (spam) et respecter les règles des groupes et des plateformes utilisés.',
        'Ne pas créer de faux comptes, ne pas acheter pour soi-même via un autre compte, ni utiliser tout autre moyen pour obtenir des gains indus.',
        'Ne pas se présenter comme salarié ou représentant de CVCasa, et ne pas utiliser le nom ou le logo de CVCasa de façon trompeuse.',
        'Respecter les lois en vigueur, notamment sur la publicité et les données personnelles.',
      ],
    },
    { title: '6. Fraude et sanctions', text: ['En cas de fraude ou de manquement à ces engagements, CVCasa peut suspendre le compte, annuler les gains non encore versés et mettre fin à ce contrat. Les gains obtenus par fraude doivent être remboursés.'] },
    { title: '7. Fiscalité', text: ['L’Ambassadeur est responsable de la déclaration des revenus perçus au titre de ce contrat, selon les règles de son pays.'] },
    { title: '8. Données personnelles', text: ['CVCasa conserve les nom et prénoms légaux de l’Ambassadeur, son numéro Mobile Money, la signature de ce contrat, les statistiques de parrainage et l’historique des paiements, pour gérer le programme et verser les gains. Les justificatifs envoyés pour changer de numéro sont supprimés une fois la demande traitée. L’Ambassadeur peut demander à consulter ou corriger ces données depuis « Nous contacter ».'] },
    { title: '9. Durée et modifications', text: ['Le contrat commence à la validation de la demande par CVCasa, pour une durée indéterminée. Chaque partie peut y mettre fin à tout moment ; les gains déjà disponibles restent dus. CVCasa peut faire évoluer ou arrêter le programme : toute modification ne s’applique qu’après en avoir informé l’Ambassadeur, et les gains déjà disponibles restent dus.'] },
    { title: '10. Droit applicable', text: ['Ce contrat est soumis au droit béninois. Les parties chercheront d’abord une solution à l’amiable via « Nous contacter ».'] },
  ];
}

/** Compare deux noms sans tenir compte des majuscules, des accents ni des espaces en trop. */
export function sameName(a: string, b: string): boolean {
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z]+/g, ' ').trim().toLowerCase();
  return n(a) !== '' && n(a) === n(b);
}
