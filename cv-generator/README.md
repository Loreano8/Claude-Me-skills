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

## Gratuit et payant

- **Gratuit, sans compte** : remplir son CV, les 3 modèles, l’export PDF et Word, les conseils.
- **IA** : il faut un compte (e-mail ou téléphone + mot de passe). **1 génération offerte** à l’inscription, puis **1 crédit par action** (générer, améliorer, adapter à une offre, lettre, traduction).
- **Packs** (modifiables dans `server/payments.ts`) : 3 crédits = 500 FCFA, 10 crédits = 1 500 FCFA, 25 crédits = 3 000 FCFA.
- **Paiement** par FedaPay (MTN MoMo, Moov Money, carte). Dès que FedaPay confirme le paiement, les crédits sont ajoutés automatiquement au compte : rien à faire à la main.
- Les appels à l’IA passent par le serveur, avec la clé API du propriétaire du service : l’utilisateur ne voit jamais la clé, il paie des crédits.
- Anti-abus : crédit offert limité à 3 inscriptions par adresse IP et par jour ; crédit rendu automatiquement si l’IA échoue.
- Ajouter des crédits à la main (ex. paiement reçu directement) :
  `curl -X POST https://cv-studio.onrender.com/api/admin/credits -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" -d '{"identifier":"+22997000000","credits":10}'`
  (`ADMIN_TOKEN` se trouve dans Render → cv-studio → Environment).

## Mise en ligne (Render)

Tout est décrit dans `render.yaml` à la racine du dépôt : le site, l’API et la base de données Postgres.

1. Créer un compte sur [render.com](https://render.com) → **New → Blueprint** → choisir ce dépôt GitHub.
2. Render demande **ANTHROPIC_API_KEY** (créée sur [console.anthropic.com](https://console.anthropic.com), avec un peu de crédit) et **FEDAPAY_SECRET_KEY** (tableau de bord FedaPay → Paramètres → Clés API ; laisser vide au début, le paiement s’active quand on la renseigne).
3. Dans FedaPay, ajouter le webhook `https://cv-studio.onrender.com/api/payments/webhook`.
4. Quand FedaPay a validé le compte marchand : mettre la clé **live** et `FEDAPAY_ENV=live`.

Coût de l’hébergement : environ 13 $/mois (serveur sans mise en veille 7 $ + base de données 6 $). Coût de l’IA (Claude Sonnet 5.5) : quelques dizaines de FCFA par action, couverts largement par le prix d’un crédit.

Chaque `git push` sur la branche suivie par Render redéploie le site automatiquement.

## Application Android

Le même site, emballé avec [Capacitor](https://capacitorjs.com) ; il parle au serveur Render (`VITE_API_URL`).

- **APK de test** : onglet *Actions* du dépôt GitHub → workflow « CV Studio » → fichier `cv-studio-apk`.
- **Play Store** : compte Google Play Console (25 $ une fois), puis Android Studio → *Build → Generate Signed Bundle*.
  Règle Google : dans l’appli du Play Store, l’achat de crédits devra passer par **Google Play Billing**. Le système de crédits est prêt pour ça (un prestataire de paiement de plus dans `server/payments.ts`) ; le site garde FedaPay.
- **iPhone** : le site s’installe depuis Safari (« Sur l’écran d’accueil ») et fonctionne comme une appli.

## Développement

Prérequis : [Node.js](https://nodejs.org) 20 ou plus récent.

```bash
cd cv-generator
npm install
npm run demo     # tout fonctionne en local, IA et paiement simulés : http://localhost:5173
npm run dev      # avec le vrai serveur (.env : voir .env.example)
npm test         # tests automatiques
```
