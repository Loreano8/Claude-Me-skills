# Mods Claude Code

Trois mods (extensions de Claude Code) écrits pour ce dépôt. Un mod est du code qui tourne avec tes permissions : ceux-ci sont courts, lisibles ici, testés (`claude plugin test`) et sans clé ni secret.

Ils s'affichent dans le terminal (`claude`, version 2.1.287 ou plus), dans l'onglet Code de l'appli Claude Desktop (2.1.286 ou plus) et dans VS Code. Dans une session cloud (téléphone, claude.ai), ils tournent mais n'affichent rien.

## Installer (sur ton PC)

Dans une session Claude Code, tape une ligne par mod, puis `y` pour ajouter le marketplace et choisis la portée (utilisateur = tous tes projets) :

```
/plugin install agent-dashboard --marketplace Loreano8/Claude-Me-skills
/plugin install limit-saver --marketplace Loreano8/Claude-Me-skills
/plugin install session-duo --marketplace Loreano8/Claude-Me-skills
```

Pour juste essayer sans installer : `claude --plugin-dir mods/agent-dashboard` (depuis ce dépôt cloné).

Pour désactiver un mod : onglet **Installed** de `/plugin`.

## agent-dashboard — le tableau de bord

Un panneau à côté de la conversation : chaque sous-agent lancé (en cours ●, terminé ✓, son modèle, l'outil qu'il utilise), les derniers outils appelés, et l'état de la session (nombre de tours, d'appels d'outils, remplissage du contexte, limites d'usage). Il s'ouvre au démarrage ; `/agent-board` le rouvre.

## limit-saver — l'économiseur de limites

Quand ta demande est courte et simple (résumer, traduire, reformuler, corriger l'orthographe, une définition, une liste d'idées), tout le tour part sur **Haiku** au lieu de ton modèle principal. Les demandes de code, de création, de débogage, de vidéo, etc. restent sur ton modèle. Une ligne « eco · this request runs on haiku » s'affiche sous la zone de saisie quand ça arrive.

- `/eco status` : état et nombre de demandes envoyées sur Haiku
- `/eco off` / `/eco on` : couper / réactiver

## session-duo — deux sessions qui se parlent

Ouvre deux sessions Claude Code sur le même PC.

1. Dans la première : `/duo plan` (elle devient le planificateur).
2. Dans la seconde : `/duo build` (elle devient le constructeur).
3. Demande un plan au planificateur, puis tape `/handoff` : sa dernière réponse est envoyée au constructeur, qui se met au travail. `/handoff ton message` envoie un texte précis.
4. Option : `/duo auto on` dans le constructeur, et il renvoie son compte rendu au planificateur à la fin de chaque tâche (le planificateur, lui, n'envoie jamais rien tout seul : pas de boucle).

`/duo status` montre qui est qui ; `/duo off` retire la session du duo.
