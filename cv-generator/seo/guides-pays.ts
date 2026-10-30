import type { Guide } from './guides.ts';

// Un guide par pays : usages locaux (photo, coordonnées, diplômes, langues) et villes, pour les recherches « CV + pays ».

export const PAYS: Guide[] = [
  {
    slug: 'cv-benin',
    kind: 'pays',
    label: 'CV au Bénin',
    h1: 'Faire un CV au Bénin : les usages des recruteurs',
    title: 'Faire un CV au Bénin : modèle et usages | CVCasa',
    description: 'Photo, numéro au bon format, diplômes, langues : comment faire un CV qui correspond à ce qu’attendent les recruteurs au Bénin, à Cotonou comme à Parakou.',
    intro: [
      'Au Bénin, un CV se lit vite, souvent sur téléphone, et le recruteur cherche d’abord le poste visé, le diplôme et l’expérience. Quelques usages locaux comptent aussi : la photo, le numéro de téléphone au bon format et la façon d’écrire les diplômes.',
    ],
    sections: [
      {
        h: 'Ce qu’attendent les recruteurs béninois',
        list: [
          'Une photo professionnelle, encore très souvent attendue dans les entreprises locales.',
          'Le titre du poste visé en haut, repris de l’annonce.',
          'Une page, deux au maximum, en français.',
          'Des expériences précises : entreprise, ville, dates, missions.',
          'Pour une ONG ou une entreprise internationale : un CV plus sobre, parfois sans photo, et souvent une version en anglais.',
        ],
      },
      {
        h: 'Vos coordonnées au bon format',
        list: [
          'Téléphone avec l’indicatif : +229, suivi de votre numéro à 10 chiffres.',
          'Une adresse e-mail sérieuse, avec votre nom (évitez les surnoms).',
          'La ville et le quartier suffisent : Cotonou, Abomey-Calavi, Porto-Novo, Parakou, Bohicon…',
        ],
      },
      {
        h: 'Écrire vos diplômes',
        p: [
          'Indiquez l’intitulé exact, l’établissement et l’année : « Licence professionnelle en finance et comptabilité, université d’Abomey-Calavi, 2022 ». Le BAC et le BEPC peuvent être cités pour un premier emploi ; avec de l’expérience, gardez seulement le diplôme le plus élevé et les formations utiles.',
        ],
      },
      {
        h: 'Les langues',
        p: [
          'Le français bien sûr, mais aussi les langues nationales que vous parlez (fon, yoruba, goun, mina, bariba, dendi…) : pour un poste au contact des clients ou sur le terrain, c’est un vrai atout. Indiquez votre niveau d’anglais honnêtement.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il mettre sa date de naissance sur un CV au Bénin ?', a: 'C’est encore courant, et souvent demandé pour les concours. Pour une entreprise internationale, elle n’est pas nécessaire. CVCasa l’affiche ou la masque selon le pays visé.' },
      { q: 'Comment envoyer mon CV ?', a: 'Toujours en PDF, avec un nom de fichier clair (CV_Prénom_Nom_Poste.pdf). Un document Word ou une photo du CV donnent une mauvaise image.' },
    ],
  },
  {
    slug: 'cv-togo',
    kind: 'pays',
    label: 'CV au Togo',
    h1: 'Faire un CV au Togo : modèle et conseils',
    title: 'CV au Togo : modèle et conseils pratiques | CVCasa',
    description: 'Comment présenter votre CV pour une entreprise, une ONG ou un concours au Togo : photo, coordonnées, diplômes, langues, avec des exemples.',
    intro: [
      'À Lomé comme à Kara, les recruteurs reçoivent beaucoup de candidatures pour chaque poste. Un CV clair, adapté à l’offre et sans faute fait déjà la différence avec une grande partie des candidats.',
    ],
    sections: [
      {
        h: 'Les usages au Togo',
        list: [
          'Photo professionnelle généralement attendue.',
          'Titre du poste en haut, puis un profil de deux ou trois phrases.',
          'Expériences de la plus récente à la plus ancienne, avec des résultats.',
          'Diplômes avec l’établissement : université de Lomé, université de Kara, écoles privées.',
        ],
      },
      {
        h: 'Coordonnées',
        list: [
          'Téléphone avec l’indicatif +228.',
          'Une adresse e-mail à votre nom.',
          'Ville et quartier : Lomé, Kara, Sokodé, Kpalimé, Atakpamé…',
        ],
      },
      {
        h: 'Langues',
        p: [
          'Citez l’éwé, le kabyè ou les autres langues que vous parlez si le poste est au contact du public. L’anglais est apprécié, en particulier dans la logistique et le commerce avec les pays voisins anglophones.',
        ],
      },
      {
        h: 'Adapter le CV à chaque offre',
        p: [
          'Reprenez les mots de l’annonce dans votre titre et vos missions. Avec CVCasa, collez l’offre : votre CV est adapté au poste et un score montre ce qui a été amélioré.',
        ],
      },
    ],
    faq: [
      { q: 'Un CV en anglais est-il utile au Togo ?', a: 'Pour les entreprises de la zone portuaire, les ONG et les organisations régionales, souvent oui. CVCasa traduit votre CV et l’adapte aux usages du pays visé.' },
    ],
  },
  {
    slug: 'cv-cote-divoire',
    kind: 'pays',
    label: 'CV en Côte d’Ivoire',
    h1: 'Faire un CV en Côte d’Ivoire : ce que les recruteurs regardent',
    title: 'CV Côte d’Ivoire : modèle et conseils pour Abidjan | CVCasa',
    description: 'Les usages du CV en Côte d’Ivoire : photo, coordonnées en +225, diplômes, expériences chiffrées. Conseils pour postuler à Abidjan et ailleurs.',
    intro: [
      'Le marché de l’emploi ivoirien, surtout à Abidjan, est très concurrentiel. Les recruteurs et les cabinets de recrutement trient vite : un CV bien structuré, avec des résultats chiffrés, passe la première sélection plus facilement.',
    ],
    sections: [
      {
        h: 'Les attentes à Abidjan',
        list: [
          'Un CV d’une page pour les profils juniors, deux pour les profils confirmés.',
          'Une photo professionnelle, souvent attendue dans les entreprises locales.',
          'Des résultats chiffrés : chiffre d’affaires, nombre de clients, budgets gérés.',
          'Des mots-clés repris de l’annonce, car de nombreux cabinets utilisent des logiciels de tri.',
        ],
      },
      {
        h: 'Coordonnées',
        list: [
          'Téléphone avec l’indicatif +225, suivi de votre numéro à 10 chiffres.',
          'Commune et ville : Cocody, Yopougon, Plateau, Marcory, Bouaké, Yamoussoukro, San-Pédro…',
          'Une adresse e-mail professionnelle.',
        ],
      },
      {
        h: 'Diplômes et certifications',
        p: [
          'Indiquez l’école ou l’université (INP-HB, université Félix Houphouët-Boigny, grandes écoles privées…) et l’année. Les certifications reconnues (comptabilité, gestion de projet, informatique) méritent une ligne à part.',
        ],
      },
      {
        h: 'Langues',
        p: [
          'Le français, l’anglais avec un niveau honnête, et les langues locales utiles au poste (dioula, baoulé, bété…), surtout dans la vente et les métiers de terrain.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il passer par un cabinet de recrutement ?', a: 'Beaucoup d’offres à Abidjan passent par des cabinets. Ils lisent le CV en premier : adaptez-le à chaque annonce et reprenez ses mots-clés.' },
    ],
  },
  {
    slug: 'cv-senegal',
    kind: 'pays',
    label: 'CV au Sénégal',
    h1: 'Faire un CV au Sénégal : modèle et usages',
    title: 'CV au Sénégal : modèle et conseils pour Dakar | CVCasa',
    description: 'Comment faire un CV pour postuler à Dakar et au Sénégal : présentation, coordonnées, diplômes, langues et erreurs à éviter.',
    intro: [
      'À Dakar, les entreprises, les ONG et les organisations internationales reçoivent des CV de toute la région. Un CV soigné, précis et adapté à l’offre vous place tout de suite parmi les candidatures que l’on lit jusqu’au bout.',
    ],
    sections: [
      {
        h: 'Les usages au Sénégal',
        list: [
          'Photo souvent attendue dans les entreprises locales, moins dans les organisations internationales.',
          'Un profil court en haut du CV, centré sur le poste visé.',
          'Des expériences détaillées avec les résultats obtenus.',
          'Les stages comptent beaucoup pour les jeunes diplômés : décrivez-les comme de vraies expériences.',
        ],
      },
      {
        h: 'Coordonnées',
        list: [
          'Téléphone avec l’indicatif +221.',
          'Ville : Dakar, Thiès, Saint-Louis, Ziguinchor, Mbour…',
          'Une adresse e-mail à votre nom.',
        ],
      },
      {
        h: 'Langues',
        p: [
          'Le wolof est un vrai plus pour les postes au contact des clients, comme le pulaar ou le sérère selon les régions. Indiquez aussi votre niveau d’anglais, apprécié dans les organisations internationales installées à Dakar.',
        ],
      },
      {
        h: 'Postuler dans une organisation internationale',
        p: [
          'Pour une ONG ou une agence internationale, le CV est souvent demandé en anglais, plus sobre, parfois sans photo. CVCasa prépare cette version à partir de votre CV en français.',
        ],
      },
    ],
    faq: [
      { q: 'Combien de pages pour un CV au Sénégal ?', a: 'Une page pour un premier emploi, deux pages au maximum pour un profil expérimenté.' },
    ],
  },
  {
    slug: 'cv-cameroun',
    kind: 'pays',
    label: 'CV au Cameroun',
    h1: 'Faire un CV au Cameroun : français, anglais ou les deux',
    title: 'CV au Cameroun : modèle bilingue et conseils | CVCasa',
    description: 'Au Cameroun, un CV bilingue peut faire la différence. Conseils pour Douala et Yaoundé : présentation, coordonnées, diplômes, CV en anglais.',
    intro: [
      'Le Cameroun est bilingue, et beaucoup d’employeurs apprécient les candidats à l’aise en français et en anglais. Selon l’entreprise et la région, préparer votre CV dans les deux langues peut vous ouvrir deux fois plus d’offres.',
    ],
    sections: [
      {
        h: 'Les usages au Cameroun',
        list: [
          'Photo généralement attendue dans les entreprises locales.',
          'Titre du poste et profil court en haut.',
          'Expériences avec des résultats concrets.',
          'Pour les régions anglophones et certaines multinationales : un CV en anglais, au format « resume ».',
        ],
      },
      {
        h: 'Coordonnées',
        list: [
          'Téléphone avec l’indicatif +237.',
          'Ville : Douala, Yaoundé, Bafoussam, Garoua, Bamenda, Buea…',
          'Une adresse e-mail professionnelle.',
        ],
      },
      {
        h: 'Un CV dans les deux langues',
        p: [
          'Ne traduisez pas mot à mot : en anglais, on écrit les missions avec des verbes d’action (« Managed », « Reduced », « Built ») et on met davantage en avant les résultats. CVCasa traduit votre CV et l’adapte aux usages de la langue choisie, puis vous gardez les deux versions côte à côte.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il indiquer son niveau d’anglais même si je postule en français ?', a: 'Oui, c’est un critère fréquent au Cameroun. Soyez honnête : il pourra être vérifié à l’entretien.' },
    ],
  },
  {
    slug: 'cv-burkina-faso',
    kind: 'pays',
    label: 'CV au Burkina Faso',
    h1: 'Faire un CV au Burkina Faso : modèle et conseils',
    title: 'CV au Burkina Faso : modèle et conseils | CVCasa',
    description: 'Conseils pour faire un CV à Ouagadougou et au Burkina Faso : présentation, coordonnées, diplômes, langues, candidature en ONG.',
    intro: [
      'Au Burkina Faso, une grande partie des offres vient des entreprises privées, des ONG et des projets de développement. Ces employeurs lisent beaucoup de CV : le vôtre doit montrer clairement ce que vous avez fait et sur quels projets.',
    ],
    sections: [
      {
        h: 'Les usages au Burkina Faso',
        list: [
          'Photo souvent attendue dans les entreprises locales.',
          'Pour les ONG et projets : expériences décrites par projet, avec le bailleur, la zone et vos résultats.',
          'Une à deux pages, en français.',
        ],
      },
      {
        h: 'Coordonnées',
        list: [
          'Téléphone avec l’indicatif +226.',
          'Ville : Ouagadougou, Bobo-Dioulasso, Koudougou…',
          'Une adresse e-mail à votre nom.',
        ],
      },
      {
        h: 'Langues',
        p: [
          'Le mooré, le dioula ou le fulfuldé sont souvent recherchés pour les postes de terrain, d’animation ou d’enquête. Mentionnez-les avec votre niveau à l’oral et à l’écrit.',
        ],
      },
      {
        h: 'Le dossier complet',
        p: [
          'Beaucoup de recrutements demandent le CV, une lettre et la copie des diplômes. Avec CVCasa, scannez vos diplômes avec le téléphone et réunissez tout dans un seul PDF.',
        ],
      },
    ],
    faq: [
      { q: 'Comment présenter une mission courte en ONG ?', a: 'Comme une expérience : intitulé, organisation, zone, dates, puis deux ou trois résultats (nombre de ménages enquêtés, formations animées, rapports livrés).' },
    ],
  },
];
