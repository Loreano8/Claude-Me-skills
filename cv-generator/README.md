# CV Studio

Site web (et application Android) pour créer un CV aux normes actuelles, l’adapter à une offre d’emploi et rédiger la lettre de motivation. Export en **PDF** et **Word**.

## Ce que fait l’application

| Onglet | Fonction |
| --- | --- |
| **Mes infos** | Formulaire complet : identité, photo (recadrée automatiquement), accroche, expériences, formations, compétences, langues, certifications, centres d’intérêt, signature dessinée au doigt ou importée. |
| | **Saisie rapide avec l’IA** : l’utilisateur écrit tout en vrac (ou dicte avec le micro du clavier), ou importe son ancien CV en PDF ou en photo. L’IA range les informations et les rédige proprement. |
| **Aperçu & export** | 3 modèles (Moderne, Classique « ATS », Élégant), 8 couleurs + couleur libre, options (photo, date de naissance, nationalité, signature, titres en français ou en anglais). Aperçu fidèle, export PDF et Word. Conseils automatiques sur le CV. |
| **Adapter à une offre** | L’utilisateur colle le texte de l’annonce ou importe le PDF / une capture d’écran. L’IA crée une **version du CV adaptée** à ce poste (le CV d’origine est conservé), donne un score d’adéquation, les points forts, les exigences manquantes et des conseils. |
| | **Mon CV dans une autre langue** : l’IA traduit tout le CV (postes, diplômes, compétences…) et l’adapte au pays visé (anglais Royaume-Uni, États-Unis/Canada ou international ; français France ou Afrique). Une nouvelle version est créée, l’original est conservé. En anglais, photo, date de naissance, nationalité et signature sont masquées comme le veut l’usage. |
| **Lettre de motivation** | Rédaction par l’IA à partir du CV et de l’offre (ou candidature spontanée), ton et longueur au choix, modifiable, signée, export PDF et Word. |

Les données restent sur le téléphone ou l’ordinateur de l’utilisateur (stockage local du navigateur). Seules les demandes à l’IA passent par le serveur.

### Les « normes actuelles » appliquées

- CV lisible par les logiciels de tri des recruteurs (**ATS**) : vrai texte dans le PDF, intitulés de sections classiques, mots-clés du métier.
- Accroche de 2 à 4 lignes en haut du CV.
- Expériences de la plus récente à la plus ancienne, présentées en **réalisations chiffrées** commençant par un verbe d’action.
- Compétences techniques séparées des qualités personnelles, langues avec niveau CECRL (A1 à C2).
- Photo, date de naissance, nationalité et signature **facultatives** : elles sont attendues dans certains pays ou concours, déconseillées dans d’autres (France, Canada, pays anglophones). L’utilisateur choisit.
- Un CV **adapté à chaque offre**, et une lettre courte (250 à 380 mots) et personnalisée.
- L’IA a pour consigne stricte de **ne rien inventer** (ni diplôme, ni expérience, ni compétence).

Ces règles sont dans `server/prompts.ts` (pour l’IA) et `src/lib/checks.ts` (conseils affichés) : c’est là qu’on les fait évoluer.

## Organisation du code

```
cv-generator/
├── src/                 Site web (React + TypeScript + Tailwind)
│   ├── pages/           Les 4 onglets
│   ├── components/      Formulaires, photo, signature, aperçu PDF
│   ├── pdf/             Modèles de CV et de lettre (PDF)
│   ├── export/          Export Word (.docx) et enregistrement des fichiers
│   └── lib/             Données du CV, appels à l’API, conseils
├── server/              API Node.js (Hono) qui appelle Claude, l’IA d’Anthropic
├── shared/schema.ts     Format des données échangées avec l’IA
├── android/             Projet Android (Capacitor)
├── assets/              Icône et écran de démarrage de l’application
└── tests/               Tests automatiques
```

## Lancer le projet sur son ordinateur

Prérequis : [Node.js](https://nodejs.org) 20 ou plus récent.

```bash
cd cv-generator
npm install
cp .env.example .env        # puis mettre la clé API dans ANTHROPIC_API_KEY
npm run dev                 # site sur http://localhost:5173, API sur le port 8787
```

Sans clé API, tout fonctionne sauf les boutons « IA ». La clé se crée sur [console.anthropic.com](https://console.anthropic.com).

Autres commandes : `npm test` (tests), `npm run typecheck`, `npm run build` (version de production dans `dist/`), `npm start` (sert le site et l’API ensemble, après `npm run build`).

## Mettre le site en ligne

### Version gratuite sur GitHub Pages (sans l’IA)

1. Sur GitHub : *Settings → Pages → Build and deployment → Source* : choisir **GitHub Actions** (à faire une seule fois).
2. Fusionner les modifications dans la branche `main` : le site est publié automatiquement à l’adresse `https://loreano8.github.io/Claude-Me-skills/`, puis mis à jour à chaque modification.

Sans serveur, les boutons IA affichent « Les fonctions IA ne sont pas encore activées sur ce site » ; tout le reste fonctionne (formulaire, modèles, export PDF et Word). Une fois le serveur ci-dessous en ligne, renseignez son adresse dans la variable `VITE_API_URL` (*Settings → Secrets and variables → Actions → Variables*) et ajoutez `https://loreano8.github.io` à `ALLOWED_ORIGINS` du serveur.

### Version complète avec l’IA

Il faut un hébergeur qui fait tourner Node.js (Render, Railway, Fly.io, un VPS…) :

1. Commande d’installation : `npm ci && npm run build` — dossier : `cv-generator`.
2. Commande de démarrage : `npm start`.
3. Variables d’environnement : `ANTHROPIC_API_KEY`, et `ALLOWED_ORIGINS` (ajoutez `https://localhost` pour l’application Android).

Le site est **installable** comme une application depuis le navigateur (« Ajouter à l’écran d’accueil »), **y compris sur iPhone** avec Safari : c’est une solution en attendant une vraie application iOS.

## Application Android

L’application Android est le même site, emballé avec [Capacitor](https://capacitorjs.com). Sur Android, les fichiers PDF / Word s’ouvrent dans le menu de partage (enregistrer, envoyer par WhatsApp, e-mail, Drive…).

**Obtenir l’APK sans rien installer** : à chaque modification poussée sur GitHub, l’onglet *Actions* du dépôt compile l’APK (workflow « CV Studio », fichier `cv-studio-apk` à télécharger). Pour que l’IA marche dans l’application, renseignez d’abord l’adresse du serveur en ligne dans *Settings → Secrets and variables → Actions → Variables* : `VITE_API_URL = https://votre-serveur…`.

**Compiler soi-même** (Android Studio installé) :

```bash
VITE_API_URL=https://votre-serveur.example.com npm run android:sync
npm run android:open        # ouvre Android Studio → Run
```

Pour publier sur le Play Store : générer un APK/AAB **signé** depuis Android Studio (*Build → Generate Signed Bundle*) et créer un compte développeur Google Play (25 $ une fois).

## Coût de l’IA

Le serveur utilise le modèle `claude-opus-5-5` (modifiable avec `CLAUDE_MODEL`). À titre indicatif, chaque action IA (générer, adapter, rédiger une lettre) coûte environ 5 à 20 centimes de dollar selon la longueur du CV et de l’offre. `RATE_LIMIT_PER_HOUR` limite le nombre de demandes par utilisateur et par heure pour éviter les abus.
