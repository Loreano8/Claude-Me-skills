---
name: effects
description: >
  Apply one of 7 viral editing effects to a talking-head video (a person facing the camera)
  and render it as a vertical 1080x1920 MP4 with HyperFrames. Use when the user types
  "/effects <name>" or asks for one of these looks: glass-widgets (frosted glass dashboard
  cards float around the person), documentary (black-and-white documentary piece with title
  card, lower third and film grain), orbit (cards orbit in 3D and pass behind the person),
  kallaway-split (split screen, animated chart on top, person below), spotlight (room goes
  dark, spotlight on the person, glowing title behind them), checklist ("Claude is editing
  your clip" list that ticks itself off, headline behind the person), timeline (an editing
  app assembles around the person, with playhead and waveform). Also triggers on
  "effet glass", "effet documentaire", "effet orbit", "écran coupé en deux", "effet projecteur",
  "effet checklist", "effet timeline / logiciel de montage".
---

# /effects — 7 effets de montage viraux

Usage : `/effects <effet> [vidéo]`. Sans nom d'effet, montrer la liste ci-dessous et demander lequel.

| Effet | Ce que ça fait | Détourage |
|---|---|---|
| `glass-widgets` | Cartes en verre dépoli (stat qui compte, barre de rendu, mini-graphique, profil, badge 4K, pastille) qui flottent autour de la personne | non |
| `documentary` | Noir et blanc, carton titre « chapitre », bandes cinéma, grain de film, timecode, bandeau nom + rôle | non |
| `orbit` | 3 à 6 cartes (texte ou images) tournent en 3D autour de la personne et passent **derrière** elle | oui |
| `kallaway-split` | Haut : titre + graphique animé (barres ou courbe) + chiffre clé ; bas : la personne | non |
| `spotlight` | La pièce s'éteint, un projecteur s'allume, un titre néon clignote puis s'allume **derrière** la personne | oui |
| `checklist` | Panneau « Claude is editing your clip » qui coche ses étapes une à une ; titre géant **derrière** la personne | oui |
| `timeline` | La vidéo rétrécit dans l'aperçu d'un faux logiciel de montage : pistes, vraie forme d'onde de l'audio, tête de lecture et timecode qui suivent la vidéo | non |

## Déroulé

1. **La vidéo.** Celle que l'utilisateur fournit (chemin, fichier joint, ou clip déjà dans un dépôt, par ex. `assets/video/pc.mp4` d'un projet Moua). Idéalement verticale, une personne face caméra. Sans vidéo, la demander.
2. **Le texte.** Partir des valeurs par défaut de `templates/<effet>.json` et écrire un `config.json` qui ne contient que les clés à changer, adaptées au sujet (article, produit, message de l'utilisateur).
   - Langue : celle de la vidéo / de la publication visée.
   - **Jamais de faux chiffres présentés comme vrais.** Les valeurs par défaut (197K, +340 %, 4.9★…) sont des exemples : les remplacer par de vraies données, ou garder la mention « Illustrative data » / formuler sans chiffre.
3. **Créer le projet :**
   ```bash
   python3 <skill>/scripts/new_effect.py <effet> <video.mp4> --out <dossier> [--config config.json] [--no-cutout]
   ```
   Le script copie la vidéo, extrait le son, ajoute GSAP, fabrique le détourage si l'effet en a besoin (`hyperframes remove-background`, ~20 s de calcul par seconde de vidéo sur CPU, fait une seule fois : relancer le script réutilise `assets/video/cutout.webm`), et écrit `index.html`. Le projet dure exactement la durée de la vidéo.
4. **Vérifier :** `cd <dossier> && npm run check` (0 erreur attendu), puis `npx --yes hyperframes@0.8.78 snapshot --at 1,<milieu>,<fin-1>` et **regarder** le `snapshots/contact-sheet.jpg` : texte qui déborde, carte sur le visage, contraste.
5. **Rendre :** `npm run render` → `renders/*.mp4`. Livrer le fichier (dans une session cloud : l'envoyer à l'utilisateur et suivre les règles de livraison du dépôt où l'on travaille).

Pour retoucher : modifier `config.json` et relancer l'étape 3 (le texte est régénéré), ou éditer directement `index.html` du projet. Les gabarits du skill (`templates/*.html`) ne se modifient que pour améliorer l'effet pour toutes les vidéos ; après modification, retester l'effet (étapes 3-4) sur un clip.

## Réglages par effet (`config.json`)

- **glass-widgets** : `stat {kicker, value, suffix, label}`, `progress {label, pct}`, `chart {title, value, bars[0..1]}`, `profile {name, handle}`, `badge`, `chip`.
- **documentary** : `chapter`, `title`, `name`, `role`, `stamp` (lieu · date), `tint` (couleur du halo).
- **orbit** : `cards [{title, sub}]` ou `[{image: "chemin/local.jpg", title, sub}]` (3 à 6 cartes ; les images sont copiées dans le projet), `accent`, `center_y` (hauteur du centre de l'orbite, ~980 = buste), `seconds_per_turn`.
- **kallaway-split** : `headline`, `stat`, `chart` (`"bars"` ou `"line"`), `data [{label, value}]`, `unit`, `source` (mention de la source des chiffres), `accent`, `focus` (cadrage de la vidéo en bas, ex. `"50% 30%"`).
- **spotlight** : `title` (court, ~8 lettres max), `subtitle`, `glow` (couleur du néon), `spot_x`, `spot_y`.
- **checklist** : `header`, `items [{label, meta}]` (4 à 6), `headline` (mot géant derrière la personne, `""` pour aucun), `headline_at` (index de l'étape où il apparaît), `accent`.
- **timeline** : `app`, `project`, `title_clip`, `video_clip`, `voice_clip`, `music_clip`, `bin [4 noms]`, `sliders [{label, value 0..1}]`.

## Bon à savoir

- Prérequis : Node 22+, ffmpeg, python3 (HyperFrames est appelé via `npx hyperframes@0.8.78`, rien à installer à la main).
- Sans détourage (`--no-cutout`), orbit / spotlight / checklist marchent quand même : les éléments passent simplement devant la personne.
- Le détourage se fait sur la personne entière : si elle sort du cadre ou bouge beaucoup, vérifier les captures.
- Les textes cachés derrière la personne sont voulus : ils portent `data-layout-allow-occlusion` pour que `check` ne les signale pas.
