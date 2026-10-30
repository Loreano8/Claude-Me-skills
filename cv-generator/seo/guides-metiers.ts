import type { Guide } from './guides.ts';

// Métiers supplémentaires (recherches « CV + métier » fréquentes).

export const METIERS: Guide[] = [
  {
    slug: 'cv-agent-de-banque',
    kind: 'metier',
    label: 'CV agent de banque',
    h1: 'CV d’agent de banque, de guichetier ou de chargé de clientèle',
    title: 'CV agent de banque, chargé de clientèle : modèle | CVCasa',
    description: 'Banque et microfinance : comment présenter votre portefeuille, vos opérations et vos résultats dans un CV d’agent de banque ou de chargé de clientèle.',
    intro: [
      'Dans la banque et la microfinance, le recruteur cherche deux choses : de la rigueur avec l’argent et un bon contact avec les clients. Votre CV doit montrer les deux avec des chiffres.',
    ],
    sections: [
      {
        h: 'Ce qu’il faut montrer',
        list: [
          'Le type de poste : guichet, caisse, chargé de clientèle particuliers ou entreprises, crédit, recouvrement.',
          'Le volume : nombre d’opérations par jour, taille du portefeuille, montants gérés.',
          'Les résultats : ouvertures de comptes, crédits accordés, taux de remboursement.',
          'Les outils : logiciel bancaire, Excel, procédures de conformité.',
        ],
      },
      {
        h: 'La confiance avant tout',
        p: [
          'Les métiers de la banque demandent de la fiabilité. « Aucun écart de caisse en 3 ans » ou « Taux de remboursement du portefeuille de 97 % » rassurent bien plus qu’une liste de qualités.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Chargé de clientèle · Institution de microfinance · 2021 à aujourd’hui',
        'Portefeuille de 350 clients particuliers et petits commerçants',
        'Plus de 200 crédits accordés en 2024, taux de remboursement de 97 %',
        '60 nouveaux comptes ouverts par trimestre en moyenne',
      ],
    },
    faq: [
      { q: 'Faut-il un diplôme en banque ?', a: 'Pas toujours. Une formation en gestion, en finance ou en commerce est souvent acceptée si vous montrez de la rigueur et un bon sens du contact client.' },
    ],
  },
  {
    slug: 'cv-juriste',
    kind: 'metier',
    label: 'CV juriste',
    h1: 'CV de juriste : droit des affaires, droit social, contentieux',
    title: 'CV juriste : modèle et exemples de missions | CVCasa',
    description: 'Comment faire un CV de juriste clair : domaines de droit, types de dossiers, rédaction de contrats et résultats, avec un exemple.',
    intro: [
      'Un CV de juriste doit être aussi précis qu’un bon contrat. Le recruteur veut savoir dans quels domaines vous intervenez, sur quels types de dossiers, et pour quelle structure : cabinet, entreprise, administration ou ONG.',
    ],
    sections: [
      {
        h: 'Les points clés',
        list: [
          'Domaines : droit des affaires, droit OHADA, droit social, droit fiscal, contentieux, conformité.',
          'Missions : rédaction de contrats, veille juridique, gestion des litiges, conseil aux équipes.',
          'Volumes : nombre de contrats rédigés, de dossiers suivis.',
          'Formation : master, spécialisation, université.',
        ],
      },
      {
        h: 'Soignez la forme',
        p: [
          'Phrases courtes, aucune faute, mise en page sobre : pour un juriste, le CV est déjà un échantillon de sa façon de rédiger.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Juriste d’entreprise · Groupe de distribution · 2022 à aujourd’hui',
        'Rédaction et revue d’environ 80 contrats par an (fournisseurs, baux, prestations)',
        'Suivi de 15 dossiers contentieux avec les avocats du groupe',
        'Formation des équipes commerciales aux clauses essentielles',
      ],
    },
    faq: [
      { q: 'Faut-il citer les affaires traitées ?', a: 'Jamais de noms de clients ni de détails confidentiels. Décrivez le type de dossier et votre rôle.' },
    ],
  },
  {
    slug: 'cv-ingenieur-btp',
    kind: 'metier',
    label: 'CV BTP, génie civil',
    h1: 'CV en BTP et génie civil : ingénieur, conducteur de travaux, technicien',
    title: 'CV BTP, génie civil : modèle et exemples | CVCasa',
    description: 'Chantiers, budgets, délais : comment présenter vos projets dans un CV d’ingénieur BTP, de conducteur de travaux ou de technicien en génie civil.',
    intro: [
      'Dans le BTP, on vous juge sur vos chantiers. Le recruteur veut savoir quels ouvrages vous avez suivis, avec quel budget, quelle équipe et quels délais.',
    ],
    sections: [
      {
        h: 'Décrivez vos chantiers',
        list: [
          'Type d’ouvrage : bâtiment, route, ouvrage d’art, assainissement, réseaux.',
          'Votre rôle : études, suivi de chantier, conduite de travaux, contrôle qualité.',
          'Les chiffres : montant du marché, durée, taille de l’équipe.',
          'Le résultat : livré dans les délais, économies réalisées, zéro accident.',
        ],
      },
      {
        h: 'Logiciels et normes',
        list: [
          'AutoCAD, Revit, Robot Structural Analysis, MS Project, Excel.',
          'Normes et règles de calcul que vous appliquez.',
          'Habilitations et formations sécurité.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Conducteur de travaux · Entreprise de BTP · 2020 à aujourd’hui',
        'Construction d’un immeuble R+4 de bureaux, 18 mois, 40 ouvriers',
        'Suivi du budget et des approvisionnements, livraison avec 3 semaines d’avance',
        'Aucun accident avec arrêt sur le chantier',
      ],
    },
    faq: [
      { q: 'Faut-il joindre un portfolio ?', a: 'Pour les postes d’études et d’architecture, un PDF avec quelques plans ou photos de chantiers est un plus. Gardez le CV lui-même sur deux pages au maximum.' },
    ],
  },
  {
    slug: 'cv-ressources-humaines',
    kind: 'metier',
    label: 'CV ressources humaines',
    h1: 'CV en ressources humaines : chargé RH, assistant RH, responsable du personnel',
    title: 'CV ressources humaines (RH) : modèle et exemples | CVCasa',
    description: 'Recrutement, paie, formation, relations sociales : comment rédiger un CV RH qui convainc, avec des exemples chiffrés.',
    intro: [
      'Un professionnel des RH lit lui-même des centaines de CV : le sien doit donc être irréprochable. Montrez l’étendue de vos missions et leur impact sur l’entreprise.',
    ],
    sections: [
      {
        h: 'Les missions à mettre en avant',
        list: [
          'Recrutement : nombre de postes pourvus, délais, sources utilisées.',
          'Paie et administration : nombre de salariés, déclarations sociales, contrats.',
          'Formation : plan de formation, nombre de sessions, budget.',
          'Relations sociales : délégués du personnel, règlement intérieur, gestion des conflits.',
        ],
      },
      {
        h: 'Outils',
        p: [
          'Logiciel de paie, SIRH, Excel (tableaux de bord RH), plateformes d’offres d’emploi. Citez ceux que vous utilisez vraiment.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Chargée des ressources humaines · Entreprise industrielle · 2021 à aujourd’hui',
        'Gestion administrative et paie de 180 salariés',
        '35 recrutements menés en 2024, délai moyen ramené à 4 semaines',
        'Mise en place d’un plan de formation annuel pour l’ensemble des équipes',
      ],
    },
    faq: [
      { q: 'Faut-il préciser le nombre de salariés ?', a: 'Oui : gérer 20 ou 500 salariés, ce n’est pas le même poste. Ce chiffre situe tout de suite votre niveau.' },
    ],
  },
  {
    slug: 'cv-community-manager',
    kind: 'metier',
    label: 'CV community manager',
    h1: 'CV de community manager et chargé de communication digitale',
    title: 'CV community manager : modèle et exemples | CVCasa',
    description: 'Abonnés, engagement, campagnes : comment montrer vos résultats dans un CV de community manager ou de chargé de communication digitale.',
    intro: [
      'Un community manager se juge sur ses résultats et sur ses réalisations. Votre CV doit donner des chiffres et renvoyer vers des exemples concrets de votre travail.',
    ],
    sections: [
      {
        h: 'Ce que le recruteur veut voir',
        list: [
          'Les comptes et marques gérés, et les réseaux utilisés.',
          'Les résultats : croissance des abonnés, taux d’engagement, ventes ou contacts générés.',
          'Les campagnes : budget publicitaire, objectifs, résultats.',
          'Les outils : Canva, Meta Business Suite, CapCut, outils de planification et de statistiques.',
          'Un lien vers un portfolio ou quelques publications.',
        ],
      },
      {
        h: 'Des chiffres plutôt que des adjectifs',
        p: [
          '« Créatif » ne se prouve pas dans un CV. « Page passée de 2 000 à 15 000 abonnés en un an » ou « campagne de 100 000 FCFA qui a généré 300 demandes de devis » se prouve.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Community manager · Agence de communication · 2022 à aujourd’hui',
        'Gestion des réseaux sociaux de 6 marques (restauration, mode, immobilier)',
        'Communauté d’un client multipliée par 5 en 12 mois',
        'Création de 20 vidéos courtes par mois',
      ],
    },
    faq: [
      { q: 'Je débute, comment prouver mon niveau ?', a: 'Gérez une page pour une association, un commerce de proximité ou votre propre projet, et présentez les résultats comme une expérience.' },
    ],
  },
  {
    slug: 'cv-caissier',
    kind: 'metier',
    label: 'CV caissier, caissière',
    h1: 'CV de caissier ou de caissière : simple et efficace',
    title: 'CV caissier, caissière : modèle simple | CVCasa',
    description: 'Un modèle de CV de caissier ou caissière : fiabilité, accueil client, gestion de caisse, avec un exemple facile à adapter.',
    intro: [
      'Pour un poste de caissier ou de caissière, le recruteur cherche quelqu’un de fiable, rapide et agréable avec les clients. Une page claire suffit, avec vos expériences et vos disponibilités.',
    ],
    sections: [
      {
        h: 'Ce qu’il faut faire apparaître',
        list: [
          'Les commerces où vous avez travaillé : supermarché, station-service, pharmacie, restaurant.',
          'Le volume : nombre de clients par jour, montants encaissés.',
          'La fiabilité : caisse juste, gestion du Mobile Money et des paiements par carte.',
          'Vos disponibilités : horaires, week-ends, jours fériés.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Caissière · Supermarché · 2022 à aujourd’hui',
        'Environ 150 clients par jour, encaissements en espèces, carte et Mobile Money',
        'Aucun écart de caisse sur les 12 derniers mois',
        'Formation de 2 nouvelles caissières',
      ],
    },
    faq: [
      { q: 'Faut-il une lettre de motivation ?', a: 'Elle n’est pas toujours demandée, mais une lettre courte et sincère peut faire la différence quand les candidats sont nombreux.' },
    ],
  },
  {
    slug: 'cv-pharmacien',
    kind: 'metier',
    label: 'CV pharmacien',
    h1: 'CV de pharmacien et d’assistant en pharmacie',
    title: 'CV pharmacien, assistant en pharmacie : modèle | CVCasa',
    description: 'Officine, hôpital, industrie, distribution : comment présenter votre parcours dans un CV de pharmacien ou d’assistant en pharmacie.',
    intro: [
      'Un CV de pharmacien doit montrer votre diplôme, votre secteur (officine, hôpital, industrie, grossiste) et vos responsabilités : délivrance, gestion des stocks, encadrement, qualité.',
    ],
    sections: [
      {
        h: 'Les points clés',
        list: [
          'Diplôme de docteur en pharmacie ou formation d’assistant, avec l’université et l’année.',
          'Inscription à l’ordre si elle est exigée pour le poste.',
          'Missions : conseil aux patients, gestion des commandes et des stocks, contrôle des ordonnances.',
          'Volume : nombre de patients par jour, références gérées, équipe encadrée.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Pharmacien assistant · Officine · 2021 à aujourd’hui',
        'Délivrance et conseil, environ 120 patients par jour',
        'Gestion des commandes auprès de 3 grossistes et suivi des dates de péremption',
        'Encadrement de 4 vendeurs en pharmacie',
      ],
    },
    faq: [
      { q: 'Comment présenter un stage hospitalier ?', a: 'Avec le service, la durée et les activités : validation des prescriptions, préparation, gestion de la pharmacie à usage intérieur.' },
    ],
  },
  {
    slug: 'cv-technicien-maintenance',
    kind: 'metier',
    label: 'CV technicien de maintenance',
    h1: 'CV de technicien de maintenance : électricité, mécanique, froid',
    title: 'CV technicien de maintenance : modèle et exemples | CVCasa',
    description: 'Interventions, équipements, temps d’arrêt réduits : comment rédiger un CV de technicien de maintenance avec des exemples concrets.',
    intro: [
      'En maintenance, le recruteur veut savoir sur quels équipements vous intervenez et si vous savez réduire les pannes. Votre CV doit citer les machines, les installations et vos résultats.',
    ],
    sections: [
      {
        h: 'Ce qu’il faut préciser',
        list: [
          'Spécialité : électricité, mécanique, froid et climatisation, électronique, groupes électrogènes.',
          'Équipements : lignes de production, véhicules, installations solaires, climatiseurs…',
          'Type de maintenance : préventive, curative, dépannage d’urgence.',
          'Résultats : temps d’arrêt réduits, pannes évitées, coûts économisés.',
          'Habilitations électriques et formations sécurité.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Technicien de maintenance électrique · Usine agroalimentaire · 2020 à aujourd’hui',
        'Maintenance de 3 lignes de production et de 2 groupes électrogènes',
        'Plan de maintenance préventive qui a réduit les arrêts de production de 40 %',
        'Interventions d’urgence, de jour comme de nuit',
      ],
    },
    faq: [
      { q: 'Faut-il mettre mes certificats de formation ?', a: 'Oui, surtout les habilitations électriques et les formations sécurité : elles sont souvent obligatoires.' },
    ],
  },
  {
    slug: 'cv-agent-de-saisie',
    kind: 'metier',
    label: 'CV agent de saisie',
    h1: 'CV d’agent de saisie et d’opérateur de données',
    title: 'CV agent de saisie, opérateur de saisie : modèle | CVCasa',
    description: 'Vitesse, précision, logiciels : comment présenter votre CV d’agent de saisie ou d’opérateur de données, avec un exemple.',
    intro: [
      'Pour un poste d’agent de saisie, deux qualités comptent : la vitesse et la précision. Votre CV doit les prouver par des chiffres et citer les outils que vous utilisez.',
    ],
    sections: [
      {
        h: 'À faire apparaître',
        list: [
          'Le type de données : factures, questionnaires d’enquête, dossiers clients, état civil.',
          'Le volume : nombre de fiches ou de documents saisis par jour.',
          'La qualité : taux d’erreur, contrôles effectués.',
          'Les outils : Excel, Word, logiciels de gestion, KoboToolbox ou ODK pour les enquêtes.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Agent de saisie · Projet d’enquête nationale · 2023 (6 mois)',
        'Saisie et contrôle de 250 questionnaires par jour sur KoboToolbox',
        'Taux d’erreur inférieur à 1 % lors des contrôles qualité',
      ],
    },
    faq: [
      { q: 'Comment montrer ma vitesse de frappe ?', a: 'Si vous l’avez mesurée, indiquez-la (par exemple 50 mots par minute). Sinon, le volume traité par jour suffit.' },
    ],
  },
];
