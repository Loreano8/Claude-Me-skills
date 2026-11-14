// Contrat du programme Ambassadeur, signé en ligne lors de la demande (nom légal exact + signature tapée).
// Chaque version acceptée est enregistrée (numéro de version, date, adresse internet, signature) : si le texte change,
// on passe à une nouvelle version et les ambassadeurs la signent à nouveau.
// Texte de base, à faire relire par un juriste avant que le programme prenne de l'ampleur.

export const AMBASSADOR_CONTRACT_VERSION = '2026-11-v1';

export type ContractSection = { title: string; text: string[] };

/** Prime au premier achat d'un filleul selon le prix du pack acheté : la prime du palier le plus haut atteint. */
export type FirstPurchaseTier = { readonly from: number; readonly reward: number };

export function firstPurchaseRewardFor(tiers: readonly FirstPurchaseTier[], amount: number): number {
  let reward = 0;
  for (const t of tiers) if (amount >= t.from) reward = Math.max(reward, t.reward);
  return reward;
}

export type ContractNumbers = {
  signupReward: number;
  signupRewardLimit: number;
  firstPurchaseReward: number;
  firstPurchaseTiers: readonly FirstPurchaseTier[];
  commissionPercent: number;
  commissionMonths: number;
  holdDays: number;
  minPayout: number;
  monthlyCap: number;
  payoutFeePercent: number;
  inactivityMonths: number;
};

const f = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;
const fe = (n: number) => `${n.toLocaleString('en-GB')} FCFA`;
/** « 100 FCFA pour un pack jusqu’à 1 499 FCFA, 200 FCFA… » */
const tiersText = (tiers: readonly FirstPurchaseTier[], money: (n: number) => string, en: boolean) =>
  tiers
    .map((t, i) => {
      const next = tiers[i + 1];
      const range = next
        ? t.from === 0
          ? en ? `under ${money(next.from)}` : `de moins de ${money(next.from)}`
          : en ? `from ${money(t.from)} to ${money(next.from - 1)}` : `de ${money(t.from)} à ${money(next.from - 1)}`
        : en ? `of ${money(t.from)} or more` : `de ${money(t.from)} ou plus`;
      return en ? `${money(t.reward)} for a pack ${range}` : `${money(t.reward)} pour un pack ${range}`;
    })
    .join(en ? ', ' : ', ');

/** Le contrat, dans la langue de l'interface (la version française fait foi). */
export function ambassadorContract(lang: 'fr' | 'en', r: ContractNumbers): ContractSection[] {
  if (lang === 'en') {
    return [
      { title: '1. Parties', text: ['This agreement is between the publisher of CVCasa (cvcasa.com), reachable through “Contact us” in the app, and the person identified below by their legal first and last names (“the Ambassador”). The Ambassador declares they are at least 18 years old and legally able to enter into this agreement. The French version of this agreement prevails.'] },
      { title: '2. Purpose', text: ['The Ambassador recommends CVCasa to people around them using their personal link. In return, they receive the rewards described below. The Ambassador acts independently: this agreement is neither an employment contract nor an exclusive agency, and does not entitle them to act or sign on behalf of CVCasa.'] },
      {
        title: '3. Rewards',
        text: [
          `${fe(r.signupReward)} for each new person who signs up through the link and creates their first CV, for the Ambassador's first ${r.signupRewardLimit} referrals only, and only if that person uses neither the Ambassador's phone nor the same internet connection.`,
          `When a referred person makes their first purchase, a one-off bonus depending on the pack bought: ${tiersText(r.firstPurchaseTiers, fe, true)}. Then ${r.commissionPercent}% of each of their following purchases for ${r.commissionMonths} months after they sign up (no percentage on the first purchase).`,
          `Earnings become available ${r.holdDays} days after the sign-up or purchase. They are capped at ${fe(r.monthlyCap)} per month.`,
          'Nothing is due for an account created by the Ambassador themself or on their own phone, for a person who signed up before the Ambassador was approved, or for a purchase that is refunded or cancelled.',
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
      { title: '8. Personal data', text: ['CVCasa keeps the Ambassador’s legal name, Mobile Money number, the signature of this agreement (typed name, drawn signature, date and internet address), referral statistics and payment history, in order to run the programme and pay the rewards. Documents sent to change the payment number are deleted once the request has been processed. The Ambassador can ask to see or correct this data via “Contact us”.'] },
      {
        title: '9. Duration, end of the agreement and changes',
        text: [
          `This agreement starts when CVCasa approves the application, for an indefinite period. It ends: (a) when the Ambassador leaves the programme from their space; (b) after ${r.inactivityMonths} months without any new referral or earnings, with a warning one month before; (c) in case of fraud, by decision of CVCasa; (d) when CVCasa ends the programme, with 30 days’ notice; (e) when the Ambassador’s CVCasa account is deleted.`,
          `Earnings when the agreement ends: available earnings of at least ${fe(r.minPayout)} must be withdrawn before leaving. In cases (a), (b) and (e), earnings not yet withdrawn below this threshold, and earnings still on hold, are lost. In case (c), nothing is paid. In case (d), all earnings become available immediately and are paid even below the threshold.`,
          'CVCasa may change the programme: any change applies only after the Ambassador has been informed and has signed the new version of this agreement.',
        ],
      },
      { title: '10. Applicable law', text: ['This agreement is governed by Beninese law. The parties will first seek an amicable solution through “Contact us”.'] },
    ];
  }
  return [
    { title: '1. Les parties', text: ['Ce contrat est conclu entre l’éditeur de CVCasa (cvcasa.com), joignable depuis « Nous contacter » dans l’application, et la personne identifiée ci-dessous par ses nom et prénoms légaux (« l’Ambassadeur »). L’Ambassadeur déclare avoir au moins 18 ans et la capacité de signer ce contrat.'] },
    { title: '2. Objet', text: ['L’Ambassadeur recommande CVCasa autour de lui grâce à son lien personnel. En échange, il reçoit les rémunérations décrites ci-dessous. L’Ambassadeur agit de façon indépendante : ce contrat n’est ni un contrat de travail ni un mandat exclusif, et ne lui permet pas d’agir ou de signer au nom de CVCasa.'] },
    {
      title: '3. Rémunération',
      text: [
        `${f(r.signupReward)} pour chaque nouvelle personne qui s’inscrit par le lien et crée son premier CV, pour les ${r.signupRewardLimit} premiers filleuls de l’Ambassadeur seulement, à condition qu’elle n’utilise ni le téléphone ni la connexion internet de l’Ambassadeur.`,
        `Au premier achat d’un filleul, une prime unique selon le pack acheté : ${tiersText(r.firstPurchaseTiers, f, false)}. Puis ${r.commissionPercent} % de chacun de ses achats suivants pendant ${r.commissionMonths} mois après son inscription (pas de pourcentage sur le premier achat).`,
        `Les gains deviennent disponibles ${r.holdDays} jours après l’inscription ou l’achat. Ils sont plafonnés à ${f(r.monthlyCap)} par mois.`,
        'Rien n’est dû pour un compte créé par l’Ambassadeur lui-même ou sur son propre téléphone, pour une personne inscrite avant la validation de l’Ambassadeur, ni pour un achat remboursé ou annulé.',
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
    { title: '8. Données personnelles', text: ['CVCasa conserve les nom et prénoms légaux de l’Ambassadeur, son numéro Mobile Money, la signature de ce contrat (nom tapé, signature dessinée, date et adresse internet), les statistiques de parrainage et l’historique des paiements, pour gérer le programme et verser les gains. Les justificatifs envoyés pour changer de numéro sont supprimés une fois la demande traitée. L’Ambassadeur peut demander à consulter ou corriger ces données depuis « Nous contacter ».'] },
    {
      title: '9. Durée, fin du contrat et modifications',
      text: [
        `Le contrat commence à la validation de la demande par CVCasa, pour une durée indéterminée. Il prend fin : (a) quand l’Ambassadeur quitte le programme depuis son espace ; (b) après ${r.inactivityMonths} mois sans nouveau filleul ni gain, avec un avertissement un mois avant ; (c) en cas de fraude, sur décision de CVCasa ; (d) quand CVCasa arrête le programme, avec un préavis de 30 jours ; (e) à la suppression du compte CVCasa de l’Ambassadeur.`,
        `Gains à la fin du contrat : les gains disponibles d’au moins ${f(r.minPayout)} doivent être retirés avant de partir. Dans les cas (a), (b) et (e), les gains non retirés sous ce seuil et les gains encore en attente sont perdus. Dans le cas (c), rien n’est versé. Dans le cas (d), tous les gains deviennent disponibles tout de suite et sont versés même sous le seuil.`,
        'CVCasa peut faire évoluer le programme : toute modification ne s’applique qu’après en avoir informé l’Ambassadeur et qu’il a signé la nouvelle version du contrat.',
      ],
    },
    { title: '10. Droit applicable', text: ['Ce contrat est soumis au droit béninois. Les parties chercheront d’abord une solution à l’amiable via « Nous contacter ».'] },
  ];
}

/** Compare deux noms sans tenir compte des majuscules, des accents ni des espaces en trop. */
export function sameName(a: string, b: string): boolean {
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z]+/g, ' ').trim().toLowerCase();
  return n(a) !== '' && n(a) === n(b);
}
