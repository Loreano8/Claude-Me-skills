# CV Studio

Site web (et application Android) pour créer un CV aux normes actuelles, l’adapter à une offre d’emploi et rédiger la lettre de motivation. Export en **PDF** et **Word**.

## Ce que fait l’application

| Onglet | Fonction |
| --- | --- |
| **Mes infos** | Formulaire complet : identité, photo (recadrée automatiquement), accroche, expériences, formations, compétences, langues, certifications, centres d’intérêt, signature dessinée au doigt ou importée. |
| | **Saisie rapide avec l’IA** : l’utilisateur **raconte son parcours à voix haute** (bouton micro), l’écrit en vrac, ou importe son ancien CV en PDF ou en photo. L’IA range les informations et les rédige proprement. |
| | **Corriger mon CV en parlant** : « mets MTN en premier », « enlève le permis »… dictées ou écrites, les corrections sont appliquées par l’IA (annulables). Ce qui demanderait d’inventer une information est signalé « à préciser ». |
| **Aperçu & export** | **13 modèles** classés par usage (polyvalents, sobres, créatifs, international : finance, ingénieur, Canada/USA sans photo, Europe, concours, premier emploi, cadre dirigeant, santé…), **« Importer un modèle que j’aime »** (l’IA juge le CV importé, signale ses défauts et reproduit son style avec nos règles de mise en page), 8 couleurs + couleur libre, options (photo, date de naissance, nationalité, signature, titres en français ou en anglais). Aperçu fidèle, export PDF et Word. Conseils automatiques sur le CV. |
| **Adapter à une offre** | L’utilisateur colle le texte de l’annonce ou importe le PDF / une capture d’écran. L’IA crée une **version du CV adaptée** à ce poste (le CV d’origine est conservé), donne un score d’adéquation avant → après adaptation, les points forts, les exigences manquantes et des conseils. |
| | **Mon CV dans une autre langue** : l’IA traduit tout le CV (postes, diplômes, compétences…) et l’adapte au pays visé (anglais Royaume-Uni, États-Unis/Canada ou international ; français France ou Afrique). Une nouvelle version est créée, l’original est conservé. En anglais, photo, date de naissance, nationalité et signature sont masquées comme le veut l’usage. |
| | **Fiche entretien** : questions probables pour ce poste avec réponses construites à partir du CV, points faibles et comment les aborder, questions à poser au recruteur, conseils. Copiable pour WhatsApp. |
| **Lettre de motivation** | Rédaction par l’IA à partir du CV et de l’offre (ou candidature spontanée), ton et longueur au choix, modifiable, signée, export PDF et Word. |
| **Mes candidatures** | Suivi de chaque offre (en préparation, envoyée, entretien, acceptée, refusée), avec le CV adapté, le score et la fiche entretien. Créé automatiquement à chaque adaptation. |
| | **« J’ai décroché le poste ! »** : quand une candidature passe à « Acceptée », l’utilisateur peut envoyer un témoignage (prénom, poste, entreprise, ville, message) avec une case d’accord obligatoire. Il peut le retirer lui-même à tout moment. |
| **Accueil** | Page de présentation (fonctionnalités, tarifs en FCFA, questions fréquentes), affichée à la première visite ou en touchant le logo. |

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
│   ├── pages/           Accueil et les 5 onglets
│   ├── components/      Formulaires, photo, signature, aperçu PDF
│   ├── pdf/             Modèles de CV et de lettre (PDF), catalogue et moteur de modèles
│   ├── export/          Export Word (.docx) et enregistrement des fichiers
│   └── lib/             Données du CV, appels à l’API, conseils
├── server/              API Node.js (Hono) qui appelle Claude, l’IA d’Anthropic
├── shared/schema.ts     Format des données échangées avec l’IA
├── android/             Projet Android (Capacitor)
├── assets/              Icône et écran de démarrage de l’application
└── tests/               Tests automatiques
```

### Dictée vocale

La reconnaissance vocale est celle de l’appareil, donc **gratuite** : Android (application, plugin `@capacitor-community/speech-recognition`), Chrome/Edge et Safari sur iPhone (site). Sans dictée disponible, le bouton explique comment utiliser le micro du clavier.

### Moteur de modèles

Les nouveaux modèles ne sont pas dessinés un par un : une **fiche de style** (`TemplateStyle` dans `shared/schema.ts` : disposition, police, titres, compétences, densité…) est mise en page par `src/pdf/templates/Studio.tsx`. Le catalogue est dans `src/pdf/catalog.ts` : ajouter un modèle = ajouter une fiche. L’analyse d’un CV importé produit la même fiche.

## Gratuit et payant

- **Gratuit, sans compte** : remplir son CV, les 3 modèles de base (Moderne, Classique, Élégant), l’export PDF avec une petite mention « Créé avec CV Studio » en bas de chaque page, les conseils.
- **Version Pro d’un CV : 2 crédits** (`UNLOCK_COST`), définitive pour ce CV : PDF sans la mention, les 13 modèles et « Mon style », export Word (CV et lettre). Le crédit offert à l’inscription ne suffit donc pas : il faut un premier achat. Un CV adapté à une offre ou traduit par l’IA garde le statut du CV de départ ; une copie manuelle repart en version gratuite.
- **IA** : il faut un compte (e-mail ou téléphone + mot de passe). **1 génération offerte** à l’inscription, puis **1 crédit par action** (générer, améliorer, corriger, adapter à une offre, lettre, fiche entretien, traduction, analyse d’un modèle importé).
- **Packs** (modifiables dans `server/payments.ts`) : 3 crédits = 500 FCFA, 10 crédits = 1 500 FCFA, 25 crédits = 3 000 FCFA.
- **Paiement** par FedaPay (Mobile Money : MTN MoMo, Moov Money ; la carte bancaire sera ajoutée aux textes une fois activée sur le compte FedaPay). Dès que FedaPay confirme le paiement, les crédits sont ajoutés automatiquement au compte : rien à faire à la main.
- Les appels à l’IA passent par le serveur, avec la clé API du propriétaire du service : l’utilisateur ne voit jamais la clé, il paie des crédits.
- Anti-abus : le crédit offert n’est donné qu’**une fois par appareil** (téléphone ou navigateur) et **une fois par connexion internet tous les 30 jours** (`FREE_IP_COOLDOWN_DAYS`). On peut créer d’autres comptes, mais sans nouveau crédit gratuit. Crédit rendu automatiquement si l’IA échoue.
- Ajouter des crédits à la main (ex. paiement reçu directement) :
  `curl -X POST https://clgmqhyzyiswnekmoygw.supabase.co/functions/v1/api/admin/credits -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" -d '{"identifier":"+22997000000","credits":10}'`
  (`ADMIN_TOKEN` se trouve dans la table `cvstudio.settings` de Supabase).

## Parrainage

Chaque compte a un lien personnel (`…/?ref=CODE`), affiché dans « Mes crédits » avec un bouton de partage (WhatsApp…). Quand un ami inscrit avec ce lien **achète son premier pack**, l'ami et son parrain reçoivent chacun **1 crédit** (`REFERRAL_BONUS` dans `server/accounts.ts`). La récompense n'est versée qu'une fois par filleul. Comme elle dépend d'un vrai paiement, créer de faux comptes ne rapporte rien.

## Nous contacter (support)

- **Côté client** : la bulle en haut de l'écran ouvre une conversation avec l'équipe. L'historique et les réponses y restent, et une pastille rouge signale une réponse non lue.
  - Sans compte, la conversation est retrouvée grâce à un secret gardé sur l'appareil.
  - Avec un compte, elle suit le client sur tous ses appareils.
- **Côté propriétaire** : l'**espace administrateur** est sur `…/#admin`. On y entre une fois avec le jeton `ADMIN_TOKEN`, gardé sur l'appareil. Il permet de lire les conversations et d'y répondre, et de publier ou refuser les témoignages.
- **Être prévenu d'un nouveau message** (facultatif, réglages dans `cvstudio.settings`) :
  - **par e-mail** : `RESEND_API_KEY` (compte gratuit sur resend.com) et `SUPPORT_NOTIFY_EMAIL` ;
  - **par WhatsApp** : `CALLMEBOT_PHONE` et `CALLMEBOT_APIKEY` (service gratuit CallMeBot : envoyer d'abord le message d'activation indiqué sur callmebot.com pour obtenir la clé) ;
  - sans réglage, les messages attendent simplement dans l'espace administrateur.

## Modèle d'IA

Réglage `CLAUDE_MODEL` (actuellement `claude-sonnet-5-5`). Mesures du 25/10/2026 sur les 8 actions, avec les mêmes entrées :

| Modèle | Coût par action | Durée | Remarque |
| --- | --- | --- | --- |
| Opus 5.5 | 15 à 43 FCFA | 9 à 29 s | Référence de qualité |
| **Sonnet 5.5 (choisi)** | **7 à 18 FCFA** | 6 à 19 s | Qualité proche d'Opus, et refuse aussi d'inventer |
| Haiku 5.5 | ~1 FCFA | 8 à 16 s | Prend de petites libertés (niveau de langue deviné, intitulé de poste enjolivé) : écarté pour l'instant |

## Témoignages

Les témoignages arrivent « en attente » et n’apparaissent sur la page d’accueil (« Ils ont décroché un poste ») qu’une fois validés. La section reste cachée tant qu’il n’y en a aucun.

- Voir les témoignages reçus : `curl https://clgmqhyzyiswnekmoygw.supabase.co/functions/v1/api/admin/testimonials -H "Authorization: Bearer <ADMIN_TOKEN>"`
- Publier (ou refuser) : `curl -X POST https://clgmqhyzyiswnekmoygw.supabase.co/functions/v1/api/admin/testimonials/<id> -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" -d '{"status":"approved"}'` (`"rejected"` pour refuser)
- Ou dans l’éditeur SQL de Supabase : `select * from cvstudio.testimonials;` puis `update cvstudio.testimonials set status = 'approved' where id = …;`

## Mise en ligne

| Partie | Où | Adresse |
| --- | --- | --- |
| Pages du site | Render, site statique (gratuit, ne s’endort jamais) | https://cv-studio-site.onrender.com |
| Serveur : IA, comptes, crédits, paiements | Supabase, fonction `api` (gratuit, ne s’endort jamais) | https://clgmqhyzyiswnekmoygw.supabase.co/functions/v1/api/health |
| Base de données | Supabase, schéma privé `cvstudio` | — |

- **Réveil quotidien** : la tâche GitHub « CV Studio – réveil quotidien » (`.github/workflows/cv-studio-reveil.yml`, sur la branche `main` car GitHub n’exécute les tâches planifiées que depuis la branche principale) appelle `/api/health` chaque matin. Cette route fait une petite requête à la base, ce qui empêche la mise en pause du projet Supabase gratuit (après ~7 jours sans activité). Si le serveur ne répond pas, GitHub envoie un e-mail d’alerte.
- **Coût mensuel : 0 $.** Seule l’IA (Anthropic) est payée, à l’usage.
- Le site statique se met à jour tout seul à chaque `git push` sur la branche `claude/cv-generator-app-a1kcdw`.
- **La fonction Supabase** charge le code du serveur depuis ce dépôt GitHub, figé sur un commit (`supabase/functions/api/index.ts` déployé). Pour la mettre à jour : remplacer le numéro de commit dans ce fichier et redéployer la fonction (`npm run edge:bundle` puis `supabase functions deploy api --no-verify-jwt` avec la CLI Supabase, ou via l’outil Supabase de Claude).
- **Réglages secrets** (clé Anthropic, clé FedaPay, secret de session, jeton admin…) : table privée `cvstudio.settings`, lisible seulement par l’utilisateur `cvstudio_app` de l’application. Pour changer une valeur : `update cvstudio.settings set value = '…' where key = 'ANTHROPIC_API_KEY';` dans l’éditeur SQL de Supabase. La fonction relit les réglages à chaque démarrage.
- **Webhook FedaPay** (sandbox et live) : `https://clgmqhyzyiswnekmoygw.supabase.co/functions/v1/api/payments/webhook`.
- Passer FedaPay en réel : mettre la clé `sk_live_…` dans `FEDAPAY_SECRET_KEY` et `live` dans `FEDAPAY_ENV`.
- Les tables se créent avec `npm run migrate` (la fonction ne le refait pas à chaque démarrage, pour répondre plus vite).

Le serveur Node (`npm start`, `server/index.ts`) reste utilisable pour un hébergement classique : même code, mêmes réglages en variables d’environnement.

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
