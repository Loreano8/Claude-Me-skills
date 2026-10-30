// Guides publics (une page par recherche courante) : générés en HTML statique au build (scripts/build-seo.ts),
// pour que Google les lise sans exécuter l'application. Chaque page renvoie vers l'outil.

export type GuideKind = 'metier' | 'situation' | 'lettre';

export type Guide = {
  slug: string;
  kind: GuideKind;
  /** Titre affiché (h1). */
  h1: string;
  /** Titre de l'onglet et de Google (60 caractères environ). */
  title: string;
  /** Description sous le titre dans Google (155 caractères environ). */
  description: string;
  /** Libellé court pour les listes de liens. */
  label: string;
  intro: string[];
  sections: { h: string; p?: string[]; list?: string[] }[];
  /** Exemple concret (lignes d'expérience, paragraphe de lettre…). */
  example?: { title: string; lines: string[]; note?: string };
  faq: { q: string; a: string }[];
};

export const KIND_LABEL: Record<GuideKind, string> = {
  metier: 'CV par métier',
  situation: 'CV selon votre situation',
  lettre: 'Lettres de motivation',
};

export const GUIDES: Guide[] = [
  // ——— Par métier ———
  {
    slug: 'cv-comptable',
    kind: 'metier',
    label: 'CV comptable',
    h1: 'CV de comptable : modèle, rubriques et exemples',
    title: 'CV comptable : modèle et exemples concrets | CVCasa',
    description: 'Comment faire un CV de comptable qui retient l’attention : rubriques, exemples de missions chiffrées, logiciels à citer et erreurs à éviter.',
    intro: [
      'Un recruteur qui lit un CV de comptable cherche trois choses en quelques secondes : les normes que vous maîtrisez, le volume que vous avez traité et les logiciels que vous savez utiliser. Le reste vient après.',
      'Ce guide vous montre comment présenter votre parcours pour que ces trois points sautent aux yeux, que vous soyez aide-comptable, comptable confirmé ou chef comptable.',
    ],
    sections: [
      {
        h: 'Les rubriques dans le bon ordre',
        list: [
          'Titre du CV : le poste visé, tel qu’il est écrit dans l’annonce (« Comptable général », « Aide-comptable »).',
          'Profil : deux ou trois phrases sur votre expérience, votre spécialité et ce que vous cherchez.',
          'Expériences : de la plus récente à la plus ancienne, avec des missions chiffrées.',
          'Formation : diplôme, école, année. Le BTS, la licence ou le master en comptabilité sont attendus.',
          'Compétences : normes (SYSCOHADA, IFRS), fiscalité, paie, logiciels.',
          'Langues et centres d’intérêt, en fin de page.',
        ],
      },
      {
        h: 'Chiffrez ce que vous avez fait',
        p: [
          'En comptabilité, un chiffre vaut mieux qu’un adjectif. « Rigoureux » ne prouve rien ; « 450 factures saisies par mois sans écart au rapprochement » le prouve. Indiquez le nombre d’écritures, de salariés en paie, de clients suivis, ou le délai de clôture que vous avez tenu.',
        ],
      },
      {
        h: 'Logiciels et normes à citer',
        list: [
          'Normes : SYSCOHADA révisé, IFRS si vous avez travaillé pour un groupe international.',
          'Logiciels : Sage (Saari, 100), Ciel, Odoo, SAP, Excel avancé (tableaux croisés, RECHERCHEV).',
          'Fiscalité : TVA, impôt sur les sociétés, déclarations sociales.',
          'Ne citez que ce que vous savez vraiment utiliser : le test technique à l’entretien le vérifiera.',
        ],
      },
      {
        h: 'Les erreurs qui coûtent un entretien',
        list: [
          'Une liste de tâches sans résultat (« saisie des factures, rapprochements bancaires »).',
          'Un CV de trois pages pour cinq ans d’expérience : une page suffit, deux au maximum.',
          'Des fautes d’orthographe ou des montants mal alignés : pour un métier de précision, c’est éliminatoire.',
          'Le même CV envoyé à toutes les offres, sans reprendre les mots de l’annonce.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Comptable · Société de transport · 2021 à aujourd’hui',
        'Tenue de la comptabilité générale selon le SYSCOHADA révisé (environ 600 écritures par mois)',
        'Préparation des déclarations fiscales mensuelles (TVA) et annuelles',
        'Paie de 120 salariés et déclarations sociales',
        'Réduction des retards de paiement fournisseurs de 30 % grâce à un nouveau suivi des échéances',
      ],
    },
    faq: [
      { q: 'Faut-il mettre une photo sur un CV de comptable ?', a: 'Dans beaucoup de pays d’Afrique francophone, la photo est encore attendue. Pour une entreprise internationale ou une candidature en Europe, elle est souvent déconseillée. CVCasa l’affiche ou la retire selon le pays visé.' },
      { q: 'Comment présenter un stage en cabinet ?', a: 'Comme une expérience à part entière : nom du cabinet, durée, et deux ou trois missions précises (révision des comptes, inventaire, préparation de liasses fiscales).' },
      { q: 'Une page ou deux ?', a: 'Une page jusqu’à cinq à sept ans d’expérience. Au-delà, deux pages si chaque ligne apporte quelque chose.' },
    ],
  },
  {
    slug: 'cv-commercial',
    kind: 'metier',
    label: 'CV commercial',
    h1: 'CV de commercial : comment montrer vos résultats',
    title: 'CV commercial : modèle, exemples et chiffres à mettre | CVCasa',
    description: 'Le CV d’un commercial se juge sur ses résultats. Voici comment présenter chiffre d’affaires, objectifs atteints et portefeuille clients, avec des exemples.',
    intro: [
      'Un commercial vend des résultats, et son CV doit faire pareil. Le recruteur veut savoir combien vous avez vendu, à qui, et si vous avez atteint vos objectifs.',
      'Que vous soyez commercial terrain, conseiller clientèle, vendeur en boutique ou chargé de clientèle en banque, la règle est la même : un résultat chiffré par expérience, au minimum.',
    ],
    sections: [
      {
        h: 'Ce que le recruteur cherche',
        list: [
          'Le type de vente : terrain, téléphone, boutique, entreprises (B2B) ou particuliers.',
          'Vos résultats : chiffre d’affaires, nombre de clients, taux d’atteinte des objectifs.',
          'Votre secteur : télécoms, banque, assurance, distribution, immobilier…',
          'Votre autonomie : gestion d’un portefeuille, prospection, négociation.',
        ],
      },
      {
        h: 'Transformez vos tâches en résultats',
        p: [
          '« Prospection de nouveaux clients » ne dit rien. « 35 nouveaux clients entreprises signés en un an » dit tout. Si vous n’avez pas le chiffre exact, donnez un ordre de grandeur honnête ou un classement (« 2e vendeur de l’agence sur 12 »).',
        ],
      },
      {
        h: 'Compétences à mettre en avant',
        list: [
          'Prospection et prise de rendez-vous',
          'Négociation et closing',
          'Suivi d’un portefeuille clients et fidélisation',
          'Outils : CRM (Salesforce, HubSpot, Odoo), Excel, reporting',
          'Langues parlées avec les clients',
        ],
      },
      {
        h: 'Erreurs fréquentes',
        list: [
          'Des qualités sans preuve (« dynamique, motivé, sens du relationnel »).',
          'Aucun chiffre alors que le métier se mesure en chiffres.',
          'Des expériences très anciennes détaillées autant que les récentes.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Commercial terrain · Distributeur de produits alimentaires · 2022 à aujourd’hui',
        'Portefeuille de 80 points de vente sur Cotonou et Abomey-Calavi',
        'Objectif annuel atteint à 112 % en 2023',
        'Ouverture de 25 nouveaux points de vente en 18 mois',
      ],
    },
    faq: [
      { q: 'Je n’ai pas accès à mes chiffres exacts, que faire ?', a: 'Donnez un ordre de grandeur que vous pouvez expliquer à l’entretien, ou un classement dans l’équipe. N’inventez jamais un chiffre : il sera vérifié.' },
      { q: 'Faut-il citer les marques vendues ?', a: 'Oui si elles sont connues, cela situe tout de suite votre niveau et votre secteur.' },
    ],
  },
  {
    slug: 'cv-infirmier',
    kind: 'metier',
    label: 'CV infirmier',
    h1: 'CV d’infirmier ou d’infirmière : modèle et conseils',
    title: 'CV infirmier, infirmière : modèle et exemples | CVCasa',
    description: 'Services, gestes techniques, diplôme d’État : comment faire un CV d’infirmier clair, avec des exemples de missions et les erreurs à éviter.',
    intro: [
      'Pour un poste d’infirmier, le recruteur vérifie d’abord votre diplôme, puis les services où vous avez travaillé et les gestes que vous maîtrisez. Votre CV doit lui permettre de répondre à ces questions en moins d’une minute.',
    ],
    sections: [
      {
        h: 'Les rubriques essentielles',
        list: [
          'Diplôme d’État ou équivalent, avec l’école et l’année, bien visible.',
          'Expériences par service : urgences, maternité, pédiatrie, chirurgie, bloc, centre de santé…',
          'Stages : indispensables si vous débutez, avec le service et la durée.',
          'Compétences techniques : prélèvements, perfusions, pansements complexes, surveillance post-opératoire, éducation thérapeutique.',
          'Formations complémentaires : premiers secours, hygiène, vaccination.',
        ],
      },
      {
        h: 'Montrez votre charge de travail',
        p: [
          'Le nombre de lits, de patients par garde ou de consultations par jour aide le recruteur à imaginer votre quotidien. « Prise en charge de 15 patients par garde en médecine interne » parle davantage que « soins aux patients ».',
        ],
      },
      {
        h: 'Erreurs à éviter',
        list: [
          'Oublier les dates et la durée des stages.',
          'Lister des qualités (« patient, à l’écoute ») sans exemple.',
          'Mélanger les gardes de nuit, les remplacements et les postes fixes sans préciser.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Infirmière · Service de pédiatrie, hôpital de zone · 2020 à aujourd’hui',
        'Soins et surveillance de 12 à 18 enfants par garde',
        'Préparation et pose de perfusions, suivi des constantes',
        'Accompagnement et conseils aux parents à la sortie',
      ],
    },
    faq: [
      { q: 'Comment présenter des remplacements courts ?', a: 'Regroupez-les sur une ligne : « Remplacements en centres de santé, 2021-2022 (6 structures) », puis citez les services les plus marquants.' },
      { q: 'Faut-il mettre le numéro d’ordre ?', a: 'Si vous êtes inscrit à l’ordre ou à un registre professionnel, indiquez-le dans la formation : c’est souvent vérifié.' },
    ],
  },
  {
    slug: 'cv-enseignant',
    kind: 'metier',
    label: 'CV enseignant',
    h1: 'CV d’enseignant : écoles privées, publiques et internationales',
    title: 'CV enseignant : modèle et exemples pour professeur | CVCasa',
    description: 'Matières, niveaux, résultats aux examens : comment rédiger un CV d’enseignant ou de professeur qui convainc un directeur d’école.',
    intro: [
      'Un directeur d’école lit un CV d’enseignant avec une question en tête : cette personne saura-t-elle tenir une classe et faire progresser les élèves ? Votre CV doit montrer les niveaux enseignés, les effectifs et, si possible, des résultats.',
    ],
    sections: [
      {
        h: 'Ce qu’il faut faire apparaître',
        list: [
          'Matières et niveaux : « Mathématiques, 6e à 3e », « CP et CE1 ».',
          'Type d’établissement : public, privé, confessionnel, international, cours à domicile.',
          'Taille des classes : 25 élèves ou 70 élèves, ce n’est pas le même métier.',
          'Résultats : taux de réussite au BEPC ou au BAC, progression d’une classe.',
          'Diplômes et certifications pédagogiques (CAPES, ENS, CAP, etc.).',
        ],
      },
      {
        h: 'Valorisez les activités en plus des cours',
        p: [
          'Club de lecture, préparation aux concours, coordination d’une matière, sorties pédagogiques, outils numériques : ces activités montrent votre engagement et font souvent la différence entre deux candidats au même diplôme.',
        ],
      },
      {
        h: 'Erreurs à éviter',
        list: [
          'Écrire « enseignant » sans préciser la matière ni le niveau.',
          'Oublier les vacations et les cours de soutien, qui comptent comme expérience.',
          'Un profil générique sur la « passion de transmettre » sans exemple concret.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Professeur de français · Collège privé · 2019 à aujourd’hui',
        'Classes de 4e et 3e, 45 élèves en moyenne',
        '92 % de réussite au BEPC en français dans mes classes en 2024',
        'Animation d’un club de lecture et d’éloquence de 20 élèves',
      ],
    },
    faq: [
      { q: 'Comment présenter des cours à domicile ?', a: 'Comme une expérience : « Cours particuliers de mathématiques, 2018-2021, une dizaine d’élèves de la 6e à la terminale », avec un résultat si vous en avez un.' },
      { q: 'Faut-il un CV différent pour une école internationale ?', a: 'Oui : mettez en avant les programmes connus (français, IB, Cambridge), les langues et les outils numériques. CVCasa peut aussi traduire votre CV en anglais.' },
    ],
  },
  {
    slug: 'cv-logistique',
    kind: 'metier',
    label: 'CV logistique',
    h1: 'CV en logistique et transport : magasinier, logisticien, gestionnaire de stock',
    title: 'CV logistique et transport : modèle et exemples | CVCasa',
    description: 'Volumes, délais, stocks : comment rédiger un CV de logisticien, magasinier ou gestionnaire de stock avec des exemples chiffrés.',
    intro: [
      'En logistique, tout se mesure : volumes traités, délais respectés, écarts d’inventaire. Un bon CV dans ce domaine reprend ces mesures et montre que vous savez organiser les flux, pas seulement exécuter.',
    ],
    sections: [
      {
        h: 'Les points clés à montrer',
        list: [
          'Le type de flux : entrepôt, port, transport routier, distribution, import-export.',
          'Les volumes : nombre de références, de palettes, de conteneurs ou de livraisons.',
          'Vos résultats : taux de service, réduction des écarts d’inventaire, délais tenus.',
          'Les outils : logiciel de gestion de stock (WMS), Excel, ERP, procédures douanières.',
          'Les habilitations : permis, conduite de chariots élévateurs (CACES ou équivalent).',
        ],
      },
      {
        h: 'Un exemple vaut mieux qu’une liste',
        p: [
          '« Gestion des stocks » est une tâche ; « 1 200 références suivies, écart d’inventaire ramené de 4 % à moins de 1 % » est un résultat. Le recruteur retiendra le second.',
        ],
      },
      {
        h: 'Erreurs à éviter',
        list: [
          'Ne pas préciser la taille de l’entrepôt ou de l’équipe.',
          'Oublier les permis et habilitations, souvent obligatoires.',
          'Des intitulés vagues (« agent ») sans dire ce que vous faisiez.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Gestionnaire de stock · Entrepôt de distribution · 2021 à aujourd’hui',
        'Suivi de 1 200 références et de 40 livraisons par jour',
        'Écart d’inventaire ramené de 4 % à moins de 1 % en un an',
        'Encadrement de 6 magasiniers',
      ],
    },
    faq: [
      { q: 'Comment parler de mon expérience au port ?', a: 'Précisez le terminal ou le type d’opérations (réception de conteneurs, dédouanement, transit) et les volumes quand vous les connaissez.' },
      { q: 'Le permis est-il important sur le CV ?', a: 'Oui, dans la logistique il est souvent exigé. Indiquez les catégories et, si c’est utile, votre expérience de conduite.' },
    ],
  },
  {
    slug: 'cv-informaticien',
    kind: 'metier',
    label: 'CV informaticien',
    h1: 'CV informatique : développeur, technicien, administrateur réseau',
    title: 'CV informaticien, développeur : modèle et exemples | CVCasa',
    description: 'Projets, langages, résultats : comment faire un CV de développeur ou de technicien informatique qui passe les filtres des recruteurs.',
    intro: [
      'En informatique, le recruteur veut voir ce que vous avez construit ou maintenu, avec quelles technologies, et pour combien d’utilisateurs. Une liste de langages ne suffit pas : il faut des projets.',
    ],
    sections: [
      {
        h: 'Les rubriques qui comptent',
        list: [
          'Titre précis : « Développeur web PHP/Laravel », « Technicien support et réseau ».',
          'Compétences techniques regroupées : langages, frameworks, bases de données, outils.',
          'Expériences avec un projet ou un résultat par ligne.',
          'Projets personnels ou de fin d’études, avec un lien vers le code ou le site si possible.',
          'Certifications : Cisco, Microsoft, AWS, etc.',
        ],
      },
      {
        h: 'Décrivez vos projets comme des résultats',
        p: [
          'Dites ce que le projet fait, pour qui, et ce que vous y avez fait. « Application de gestion des stocks pour 3 boutiques, développée en Laravel et MySQL, utilisée chaque jour par 10 personnes » est bien plus parlant que « développement d’applications web ».',
        ],
      },
      {
        h: 'Les mots-clés de l’annonce',
        p: [
          'Beaucoup d’entreprises trient les CV avec un logiciel qui cherche les technologies demandées. Reprenez exactement les noms cités dans l’annonce (« React », « PostgreSQL », « Windows Server ») s’ils correspondent à ce que vous savez faire.',
        ],
      },
      {
        h: 'Erreurs à éviter',
        list: [
          'Une liste de 30 technologies dont la moitié vue une seule fois.',
          'Des barres de niveau (« Java 80 % ») qui ne veulent rien dire.',
          'Aucun projet concret quand on débute.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Développeur web · Agence numérique · 2022 à aujourd’hui',
        'Développement de 8 sites et applications pour des PME (Laravel, Vue.js, MySQL)',
        'Mise en place du paiement Mobile Money sur 3 boutiques en ligne',
        'Temps de chargement réduit de moitié sur le site principal d’un client',
      ],
    },
    faq: [
      { q: 'Je n’ai pas d’expérience en entreprise, que mettre ?', a: 'Vos projets d’études, vos projets personnels et vos contributions (site d’une association, application pour un proche). Décrivez-les comme des expériences.' },
      { q: 'Faut-il un CV en anglais ?', a: 'Pour une entreprise internationale ou un poste à distance, souvent oui. CVCasa peut traduire votre CV et l’adapter aux usages du pays visé.' },
    ],
  },
  {
    slug: 'cv-secretaire-assistante',
    kind: 'metier',
    label: 'CV secrétaire, assistante',
    h1: 'CV de secrétaire ou d’assistante de direction',
    title: 'CV secrétaire, assistante de direction : modèle | CVCasa',
    description: 'Organisation, outils bureautiques, confidentialité : comment rédiger un CV de secrétaire ou d’assistante de direction avec des exemples concrets.',
    intro: [
      'Une assistante ou un secrétaire fait gagner du temps à toute une équipe. Votre CV doit montrer pour qui vous avez travaillé, ce que vous avez organisé et avec quels outils, de façon aussi soignée que les documents que vous produirez.',
    ],
    sections: [
      {
        h: 'Ce qu’il faut faire apparaître',
        list: [
          'Pour qui : un directeur général, un service de 15 personnes, un cabinet médical…',
          'Ce que vous gérez : agendas, déplacements, courrier, accueil, archives, réunions.',
          'Les outils : Word, Excel, PowerPoint, messagerie, logiciel de gestion, saisie rapide.',
          'Les langues, souvent décisives pour un poste de direction.',
        ],
      },
      {
        h: 'Des exemples plutôt que des qualités',
        p: [
          '« Organisée » se montre : « Organisation de 3 séminaires de 60 participants », « Gestion de l’agenda de 2 directeurs ». La discrétion se montre aussi : « Traitement de dossiers confidentiels (paie, contrats) ».',
        ],
      },
      {
        h: 'Erreurs à éviter',
        list: [
          'Un CV mal mis en page : pour ce métier, la présentation est jugée autant que le contenu.',
          'Ne pas préciser le niveau dans les logiciels.',
          'Oublier les responsabilités d’accueil et de standard, qui sont recherchées.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Assistante de direction · Société de services · 2020 à aujourd’hui',
        'Gestion de l’agenda et des déplacements du directeur général',
        'Préparation des conseils d’administration (convocations, comptes rendus)',
        'Mise en place d’un classement numérique qui a réduit le temps de recherche des dossiers',
      ],
    },
    faq: [
      { q: 'Comment montrer mon niveau sur Excel ?', a: 'Par ce que vous en faites : « tableaux de suivi des congés », « tableaux croisés dynamiques pour les ventes mensuelles ». C’est plus crédible qu’un « niveau avancé ».' },
    ],
  },
  {
    slug: 'cv-chauffeur',
    kind: 'metier',
    label: 'CV chauffeur',
    h1: 'CV de chauffeur : permis, véhicules et expérience',
    title: 'CV chauffeur, chauffeur-livreur : modèle simple | CVCasa',
    description: 'Permis, types de véhicules, trajets, sécurité : un modèle de CV de chauffeur simple et efficace, avec des exemples.',
    intro: [
      'Pour un poste de chauffeur, le recruteur veut savoir en un coup d’œil quels permis vous avez, quels véhicules vous avez conduits et si vous êtes fiable. Un CV d’une page, clair et précis, suffit largement.',
    ],
    sections: [
      {
        h: 'Les informations indispensables',
        list: [
          'Permis : catégories (B, C, D…) et année d’obtention, tout en haut.',
          'Véhicules conduits : voiture de direction, minibus, camion, poids lourd, moto.',
          'Types de trajets : ville, interurbain, international, livraisons.',
          'Sécurité : années sans accident, entretien du véhicule, respect des horaires.',
          'Langues parlées, utiles avec les passagers ou les clients.',
        ],
      },
      {
        h: 'Montrez votre fiabilité',
        p: [
          'La ponctualité et la sécurité sont vos meilleurs arguments. « 8 ans de conduite sans accident », « Chauffeur du directeur pendant 5 ans » ou « 30 livraisons par jour en moyenne » rassurent un employeur.',
        ],
      },
    ],
    example: {
      title: 'Exemple de bloc expérience',
      lines: [
        'Chauffeur de direction · ONG internationale · 2018 à aujourd’hui',
        'Conduite du directeur pays et des missions en ville et en province',
        'Entretien courant du véhicule et suivi du carnet de bord',
        'Aucun accident en 6 ans',
      ],
    },
    faq: [
      { q: 'Faut-il mettre une photo ?', a: 'Pour un poste de chauffeur dans la région, c’est souvent attendu. CVCasa vous permet de l’ajouter ou de la retirer en un clic.' },
    ],
  },

  // ——— Selon la situation ———
  {
    slug: 'cv-sans-experience',
    kind: 'situation',
    label: 'CV sans expérience',
    h1: 'Faire un CV sans expérience : quoi mettre et comment',
    title: 'CV sans expérience : quoi mettre (exemples) | CVCasa',
    description: 'Pas encore d’emploi ? Stages, projets, bénévolat, petits boulots : comment remplir un CV sans expérience et donner envie au recruteur.',
    intro: [
      'Tout le monde commence un jour sans expérience, et les recruteurs le savent. Ce qu’ils cherchent dans un premier CV, ce sont des preuves que vous savez apprendre, vous organiser et tenir vos engagements.',
      'Ces preuves, vous les avez déjà : il faut juste savoir les trouver et les présenter.',
    ],
    sections: [
      {
        h: 'Ce qui compte comme expérience',
        list: [
          'Les stages, même courts, et les stages d’observation.',
          'Les projets d’études : mémoire, projet de groupe, étude de cas réelle.',
          'Le bénévolat et la vie associative : trésorier d’un club, organisation d’un événement.',
          'Les petits boulots : vente, cours de soutien, aide dans le commerce familial.',
          'Les formations en ligne terminées, avec un certificat.',
        ],
      },
      {
        h: 'Mettez la formation en avant',
        p: [
          'Sans expérience, placez la formation juste après le profil. Ajoutez les matières utiles pour le poste visé, votre mention et votre projet de fin d’études.',
        ],
      },
      {
        h: 'Un profil court et précis',
        p: [
          'Deux phrases suffisent : ce que vous avez étudié, ce que vous savez faire, le poste que vous visez. « Diplômée d’une licence en gestion, j’ai réalisé un stage de 3 mois en comptabilité et je cherche un premier poste d’assistante comptable. »',
        ],
      },
      {
        h: 'Erreurs à éviter',
        list: [
          'Laisser des rubriques vides ou écrire « néant ».',
          'Remplir avec des qualités sans exemple.',
          'Gonfler une expérience : à l’entretien, cela se voit tout de suite.',
        ],
      },
    ],
    example: {
      title: 'Exemple : transformer une activité en expérience',
      lines: [
        'Trésorier · Association des étudiants en gestion · 2023-2024',
        'Tenue du budget annuel de l’association (cotisations et dépenses)',
        'Organisation d’une journée carrière avec 4 entreprises et 150 étudiants',
      ],
      note: 'Avec CVCasa, racontez simplement ce que vous avez fait, même en vrac : il range tout dans les bonnes rubriques.',
    },
    faq: [
      { q: 'Un CV sans expérience doit-il tenir sur une page ?', a: 'Oui, toujours. Une page bien remplie vaut mieux que deux pages légères.' },
      { q: 'Faut-il parler des petits boulots ?', a: 'Oui, s’ils montrent une qualité utile pour le poste : contact client, ponctualité, gestion de l’argent.' },
    ],
  },
  {
    slug: 'cv-stage',
    kind: 'situation',
    label: 'CV pour un stage',
    h1: 'CV pour un stage : modèle et conseils pour les étudiants',
    title: 'CV de stage étudiant : modèle et exemples | CVCasa',
    description: 'Comment faire un CV pour décrocher un stage : formation, projets, compétences et petites expériences, avec un exemple simple à reprendre.',
    intro: [
      'Pour un stage, le recruteur ne cherche pas un expert. Il cherche un étudiant sérieux, curieux, qui sait ce qu’il veut apprendre. Votre CV doit le montrer en une page.',
    ],
    sections: [
      {
        h: 'L’ordre idéal',
        list: [
          'Titre : « Étudiant en 2e année de licence de gestion, à la recherche d’un stage de 3 mois en comptabilité ».',
          'Formation : diplôme en cours, établissement, matières utiles.',
          'Expériences : stages précédents, projets, petits boulots, associations.',
          'Compétences : logiciels, langues, outils vus en cours.',
          'Dates de disponibilité et durée du stage, très visibles.',
        ],
      },
      {
        h: 'Précisez vos dates',
        p: [
          'C’est l’oubli le plus fréquent. Indiquez clairement quand vous êtes disponible et pour combien de temps : « Disponible du 1er juillet au 30 septembre ». Un recruteur qui doit vous demander cette information passera parfois au CV suivant.',
        ],
      },
      {
        h: 'Adaptez-le à chaque entreprise',
        p: [
          'Reprenez les mots de l’offre de stage et mettez en avant les cours ou projets qui s’en rapprochent. Avec CVCasa, collez l’annonce : le CV est adapté au poste, sans rien inventer.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il une lettre de motivation pour un stage ?', a: 'Souvent oui. Elle peut être courte : pourquoi cette entreprise, ce que vous voulez apprendre, ce que vous apportez. Voir notre guide sur la lettre de motivation pour un stage.' },
      { q: 'Que mettre si c’est mon premier stage ?', a: 'Vos projets d’études, vos activités associatives et vos petits boulots. Voir aussi notre guide pour faire un CV sans expérience.' },
    ],
  },
  {
    slug: 'cv-concours',
    kind: 'situation',
    label: 'CV pour un concours',
    h1: 'CV pour un concours ou un recrutement public',
    title: 'CV pour concours et recrutement public : conseils | CVCasa',
    description: 'Concours de la fonction publique, recrutements d’ONG ou d’organisations internationales : comment préparer un CV complet et conforme.',
    intro: [
      'Pour un concours ou un recrutement public, le CV est souvent lu par un jury qui vérifie d’abord que vous remplissez les conditions : diplôme, âge, expérience minimale, pièces demandées. Un CV clair évite d’être écarté pour un oubli.',
    ],
    sections: [
      {
        h: 'Lisez l’avis de concours ligne par ligne',
        list: [
          'Conditions de diplôme et d’expérience : faites-les apparaître noir sur blanc.',
          'Format demandé : certains avis imposent un modèle ou une longueur.',
          'Pièces à joindre : copies de diplômes, acte de naissance, certificat de nationalité, casier judiciaire…',
          'Date limite et mode de dépôt.',
        ],
      },
      {
        h: 'Un CV complet et vérifiable',
        p: [
          'Pour un recrutement public, les dates précises et les intitulés exacts des diplômes comptent. Indiquez l’établissement, l’année et la mention. Chaque information doit pouvoir être prouvée par une pièce du dossier.',
        ],
      },
      {
        h: 'Le dossier complet en un seul fichier',
        p: [
          'Beaucoup de dépôts se font maintenant en ligne ou par e-mail, en un seul PDF. Avec CVCasa, scannez vos diplômes et pièces avec le téléphone et réunissez-les avec le CV et la lettre dans un dossier PDF unique, dans l’ordre demandé.',
        ],
      },
    ],
    faq: [
      { q: 'La photo est-elle obligatoire ?', a: 'Pour beaucoup de concours dans la région, oui. Vérifiez l’avis : s’il demande une photo d’identité récente, ajoutez-la au CV et au dossier.' },
      { q: 'Combien de pages pour un CV de concours ?', a: 'Une à deux pages. Si l’avis ne dit rien, restez court et complet.' },
    ],
  },
  {
    slug: 'cv-reconversion',
    kind: 'situation',
    label: 'CV de reconversion',
    h1: 'CV de reconversion : changer de métier sans repartir de zéro',
    title: 'CV de reconversion professionnelle : exemples | CVCasa',
    description: 'Changer de métier ? Comment présenter votre parcours pour mettre en avant les compétences qui comptent pour le nouveau poste.',
    intro: [
      'En reconversion, votre CV doit répondre à une question que le recruteur se pose tout de suite : pourquoi cette personne, qui vient d’un autre métier, ferait-elle bien ce travail ? La réponse se trouve dans vos compétences transférables et dans ce que vous avez déjà fait pour vous former.',
    ],
    sections: [
      {
        h: 'Commencez par le nouveau métier',
        p: [
          'Le titre et le profil doivent parler du poste visé, pas de l’ancien. « Ancien commercial, formé à la gestion de projet, je cherche un poste de chef de projet junior » annonce clairement la couleur.',
        ],
      },
      {
        h: 'Repérez vos compétences transférables',
        list: [
          'Gestion d’équipe, organisation, budget : utiles dans presque tous les métiers.',
          'Relation client, négociation, présentation.',
          'Outils : Excel, logiciels de gestion, informatique.',
          'Connaissance d’un secteur : un ancien infirmier connaît le milieu de la santé, un atout pour un poste administratif dans un hôpital.',
        ],
      },
      {
        h: 'Montrez que vous vous êtes préparé',
        p: [
          'Formations suivies, certificats, projets personnels, bénévolat dans le nouveau domaine : placez-les en haut du CV. Ils prouvent que votre projet est sérieux.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il garder toutes mes anciennes expériences ?', a: 'Gardez-les, mais décrivez surtout ce qui sert au nouveau métier. Une ligne suffit pour ce qui n’a pas de lien.' },
    ],
  },

  // ——— Lettres de motivation ———
  {
    slug: 'lettre-motivation-stage',
    kind: 'lettre',
    label: 'Lettre de motivation pour un stage',
    h1: 'Lettre de motivation pour un stage : structure et exemple',
    title: 'Lettre de motivation stage : exemple et structure | CVCasa',
    description: 'Une lettre de motivation de stage courte et sincère : la structure en trois paragraphes, un exemple à adapter et les phrases à éviter.',
    intro: [
      'Une lettre de motivation pour un stage n’a pas besoin d’être longue. Le recruteur veut comprendre pourquoi vous avez choisi son entreprise, ce que vous voulez apprendre et ce que vous pouvez apporter dès les premières semaines.',
    ],
    sections: [
      {
        h: 'La structure en trois paragraphes',
        list: [
          'Vous : votre formation, l’année, et le stage que vous cherchez (durée, dates).',
          'Eux : ce qui vous attire dans cette entreprise, avec un détail précis (un produit, un projet, une valeur).',
          'Nous : ce que vous apporterez et ce que vous voulez apprendre, puis la demande d’entretien.',
        ],
      },
      {
        h: 'Des phrases à éviter',
        list: [
          '« Je me permets de vous adresser ma candidature » en ouverture : tout le monde l’écrit.',
          '« Votre entreprise leader dans son domaine » : trop vague, cela montre que la lettre est générique.',
          '« Je suis dynamique, motivé et rigoureux » sans exemple.',
        ],
      },
    ],
    example: {
      title: 'Exemple de paragraphe « eux »',
      lines: [
        'J’ai découvert votre cabinet lors de la journée carrière de mon université, où l’un de vos auditeurs a présenté une mission dans une coopérative agricole. C’est ce type de mission, au contact d’entreprises locales, qui m’a donné envie de faire mon stage chez vous.',
      ],
      note: 'Avec CVCasa, répondez à deux questions rapides et la lettre est rédigée à partir de vos vraies réponses, avec vos mots.',
    },
    faq: [
      { q: 'Quelle longueur pour une lettre de stage ?', a: 'Une demi-page à une page, soit 200 à 300 mots. Plus court, c’est souvent mieux lu.' },
    ],
  },
  {
    slug: 'lettre-candidature-spontanee',
    kind: 'lettre',
    label: 'Lettre de candidature spontanée',
    h1: 'Lettre de candidature spontanée : comment se faire remarquer',
    title: 'Candidature spontanée : lettre de motivation et exemple | CVCasa',
    description: 'Écrire à une entreprise qui ne recrute pas officiellement : comment rédiger une candidature spontanée ciblée, avec un exemple.',
    intro: [
      'Beaucoup de postes ne sont jamais publiés. Une candidature spontanée bien ciblée peut arriver au bon moment, à condition de montrer que vous connaissez l’entreprise et que vous savez ce que vous pouvez lui apporter.',
    ],
    sections: [
      {
        h: 'Visez un poste précis',
        p: [
          '« Je suis disponible pour tout poste » ne marche pas. Indiquez le métier ou le service visé : « un poste d’assistant comptable », « votre équipe commerciale à Parakou ». Le recruteur peut alors transmettre votre lettre à la bonne personne.',
        ],
      },
      {
        h: 'Ce que la lettre doit contenir',
        list: [
          'Pourquoi cette entreprise : une raison précise et vraie.',
          'Ce que vous savez faire, avec un exemple chiffré.',
          'Ce que vous proposez : un entretien, un essai, un stage de pré-embauche.',
        ],
      },
      {
        h: 'Relancez',
        p: [
          'Sans réponse après deux semaines, une relance courte et polie est normale. Notez vos envois dans un suivi des candidatures pour savoir qui relancer et quand.',
        ],
      },
    ],
    faq: [
      { q: 'À qui envoyer une candidature spontanée ?', a: 'Au responsable du service visé si vous trouvez son nom, sinon au service des ressources humaines. Une lettre adressée à une personne est plus souvent lue.' },
    ],
  },
  {
    slug: 'lettre-motivation-premier-emploi',
    kind: 'lettre',
    label: 'Lettre pour un premier emploi',
    h1: 'Lettre de motivation pour un premier emploi',
    title: 'Lettre de motivation premier emploi : exemple | CVCasa',
    description: 'Jeune diplômé ? Comment écrire une lettre de motivation pour un premier emploi qui compense le manque d’expérience, avec un exemple.',
    intro: [
      'Pour un premier emploi, la lettre compte souvent plus que le CV. C’est l’occasion de montrer ce que votre CV ne dit pas encore : votre sérieux, votre envie d’apprendre et ce que vous avez déjà fait pendant vos études.',
    ],
    sections: [
      {
        h: 'Appuyez-vous sur des faits',
        p: [
          'Stage, mémoire, projet de groupe, responsabilité associative : choisissez une ou deux expériences liées au poste et racontez ce que vous y avez fait concrètement. Un exemple précis vaut mieux que trois qualités.',
        ],
      },
      {
        h: 'Montrez que vous avez lu l’offre',
        p: [
          'Reprenez une ou deux missions de l’annonce et expliquez en une phrase comment vous les abordez. Le recruteur voit tout de suite que la lettre a été écrite pour lui.',
        ],
      },
      {
        h: 'Phrases à éviter',
        list: [
          '« Bien que je n’aie pas d’expérience… » : ne commencez pas par ce qui vous manque.',
          '« Je suis prêt à relever tous les défis » : trop vague.',
          'Copier un modèle trouvé en ligne mot pour mot : les recruteurs les reconnaissent.',
        ],
      },
    ],
    example: {
      title: 'Exemple de paragraphe',
      lines: [
        'Pendant mon stage de fin d’études dans une microfinance, j’ai préparé chaque semaine le suivi des remboursements de 200 clients. Ce travail m’a appris la rigueur que demande le poste de chargé de clientèle que vous proposez.',
      ],
    },
    faq: [
      { q: 'Faut-il parler du salaire ?', a: 'Non, pas dans la lettre, sauf si l’annonce le demande. Gardez ce sujet pour l’entretien.' },
    ],
  },
];
