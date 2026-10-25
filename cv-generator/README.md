# CV Studio

Site web (et application Android) pour créer un CV aux normes actuelles, l’adapter à une offre d’emploi et rédiger la lettre de motivation. Export en **PDF** et **Word**.

## Ce que fait l’application

| Onglet | Fonction |
| --- | --- |
| **Mes infos** | Formulaire complet : identité, photo (recadrée automatiquement), accroche, expériences, formations, compétences, langues, certifications, centres d’intérêt, signature dessinée au doigt ou importée. |
| | **Saisie rapide avec l’IA** : l’utilisateur écrit tout en vrac (ou dicte avec le micro du clavier), ou importe son ancien CV en PDF ou en photo. L’IA range les informations et les rédige proprement. |
| **Aperçu & export** | 3 modèles (Moderne, Classique « ATS », Élégant), 8 couleurs + couleur libre, options (photo, date de naissance, nationalité, signature, titres en français ou en anglais). Aperçu fidèle, export PDF et Word. Conseils automatiques sur le CV. |
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
- **IA** : il faut un compte (e-mail ou téléphone + mot de passe). **1 génération offerte** à l’inscription, puis **1 crédit par action** (générer, améliorer, adapter à une offre, lettre, fiche entretien, traduction).
- **Packs** (modifiables dans `server/payments.ts`) : 3 crédits = 500 FCFA, 10 crédits = 1 500 FCFA, 25 crédits = 3 000 FCFA.
- **Paiement** par FedaPay (MTN MoMo, Moov Money, carte). Dès que FedaPay confirme le paiement, les crédits sont ajoutés automatiquement au compte : rien à faire à la main.
- Les appels à l’IA passent par le serveur, avec la clé API du propriétaire du service : l’utilisateur ne voit jamais la clé, il paie des crédits.
- Anti-abus : le crédit offert n’est donné qu’**une fois par appareil** (téléphone ou navigateur) et **une fois par connexion internet tous les 30 jours** (`FREE_IP_COOLDOWN_DAYS`). On peut créer d’autres comptes, mais sans nouveau crédit gratuit. Crédit rendu automatiquement si l’IA échoue.
- Ajouter des crédits à la main (ex. paiement reçu directement) :
  `curl -X POST https://clgmqhyzyiswnekmoygw.supabase.co/functions/v1/api/admin/credits -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" -d '{"identifier":"+22997000000","credits":10}'`
  (`ADMIN_TOKEN` se trouve dans la table `cvstudio.settings` de Supabase).

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
