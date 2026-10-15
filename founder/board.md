# Conseil d'administration — Cœur Codé

**Vote : 2 FUND IF, 1 PASS. Score moyen : 4/10.**

| Lens | Score | Vote |
| --- | --- | --- |
| Offres | 4/10 | FUND IF |
| Monopole | 3/10 | PASS |
| Produit | 5/10 | FUND IF |

Mémos complets : `board/offers.md`, `board/monopoly.md`, `board/product.md`.

## Les risques soulevés par plusieurs membres (en premier)

1. **Le stockage public des parties (les 3 lens).** Les mots secrets et les parties vivent sur MantleDB : un stockage gratuit et public, lisible par quiconque a le code. Pour une app intime de couple, c'est à la fois un problème de confiance, de fiabilité (service tiers gratuit) et de durabilité.
2. **Personne ne sait si ces couples paient ni comment les atteindre (les 3 lens).** Pas de prix, pas de canal, pas d'utilisateurs, et moins de 100 € de budget. Le lens Offres parle de marché faible, le lens Monopole d'absence de distribution, et le lens Produit demande un test réel avant tout modèle économique.
3. **Aucune notification « c'est ton tour » (Produit et Monopole).** Le jeu se met à jour seulement quand l'écran est ouvert. Pour des couples sur deux fuseaux horaires, la partie meurt en silence, ce qui tue la rétention.
4. **Un pendu à deux ne se distingue pas assez (Offres et Monopole).** C'est copiable en quelques semaines, et c'est déjà gratuit partout. La seule différence, c'est la mécanique de couple (l'indice dû, la série), et elle reste à pousser.

## Les désaccords

- **Le lens Monopole vote PASS.** Rien n'empêche une copie, et sans canal ce n'est pas une entreprise. Il passerait en FUND IF si `/founder-competitors` montre que la niche est libre et si un canal bon marché est prouvé.
- **Le lens Produit est le plus positif (5/10).** Il voit du goût et une phrase claire. Mais il exige de *retirer* des fonctions (matchmaking, voire le solo), alors que le lens Offres veut en *ajouter* à l'offre (packs de mots personnels, rappels, thèmes). Les deux peuvent tenir ensemble : couper les modes, enrichir le duel de couple.

## Conditions (la checklist du pack)

- [ ] **Recentrer sur un seul produit, le duel de couple** : retirer le matchmaking avec des inconnus et décider du sort du solo. *(Produit)*
- [ ] **Ajouter une notification « c'est ton tour »** quand l'app est fermée, avant la publication sur les stores. *(Produit, Monopole)*
- [ ] **Remplacer MantleDB** par un stockage privé et fiable, pour moins d'environ 100 €. *(les 3 lens ; coût à vérifier avec `/founder-ops` et `/founder-cfo`)*
- [ ] **Reformuler l'offre autour du résultat** (« un rituel de couple chaque soir ») et non du pendu. Construire la pile : mots personnels (prénoms, souvenirs, mots doux), historique du couple, rappels, thèmes saisonniers. *(Offres ; voir `/founder-offer`)*
- [ ] **Vérifier que la niche est libre** : quelles apps de jeu pour couples existent, à quel prix, et ce que leurs utilisateurs leur reprochent. *(Monopole, Offres → `/founder-competitors`)*
- [ ] **Vérifier que les couples paieraient**, combien, et sous quelle forme. *(les 3 lens → `/founder-consumer`, puis `/founder-pricing`)*
- [ ] **Nommer et tester un canal d'acquisition bon marché** pour les 100 premiers couples, avec son coût par couple. *(Monopole, Offres → `/founder-marketing`, `/founder-cfo`)*
- [ ] **Tester le parcours complet avec de vrais couples** (invitation, première manche, retour le lendemain) et une liste d'attente ou une prévente à prix réel. *(Produit, Offres → `/founder-launch`)*
- [ ] **Définir un actif qui s'accumule** (l'historique du couple, des mots partagés) pour qu'on perde quelque chose en partant. *(Monopole)*
- [ ] **Une garantie et une urgence réelles** si l'app devient payante, jamais fictives. *(Offres)*

## La version la plus forte que le conseil voit

Ce n'est pas « un jeu de mots en ligne », c'est **un petit rituel quotidien pour les couples à distance** : chacun cache un mot *pour l'autre*, souvent un mot qui a du sens pour le couple. Une notification annonce que c'est son tour, et la série raconte l'histoire du couple au fil des semaines. Il faut un seul mode, le duel de couple, avec des parties privées et fiables, et un bouton d'invitation qui fait venir le partenaire. Chaque couple qui s'installe en amène un deuxième joueur : c'est le seul effet de réseau gratuit du projet. C'est plus étroit que ce qui existe aujourd'hui, puisque le conseil retirerait le matchmaking avec des inconnus et probablement le solo. Si les couples ne paient pas, ce peut rester un très bon projet gratuit : le conseil le dit sans détour, ce n'est pas encore une entreprise.
