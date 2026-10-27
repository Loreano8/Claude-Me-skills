# Agent Reach : installation sécurisée

Skill : `.claude/skills/agent-reach` · Projet : https://github.com/Panniantong/Agent-Reach

## Vérifications faites (27/10/2026, version 1.6.0)

- Code installé identique au code source GitHub du tag `v1.6.0`.
- Dépendances Python auditées avec `pip-audit` : aucune vulnérabilité connue.
- Aucune télémétrie ; la télémétrie de `gh` est explicitement coupée.
- Le navigateur interne n'écoute que sur `127.0.0.1` (inaccessible depuis le réseau).
- Fichiers de config dans `~/.agent-reach/` en accès privé (droits `700` / `600`).
- Le skill ne contient aucune instruction dangereuse : lecture seule, jamais de mot de passe ni de cookie.

## Installer sur le PC / le portable (version figée)

1. Installer `uv` si absent :
   - macOS / Linux : `curl -LsSf https://astral.sh/uv/install.sh | sh`
   - Windows : `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`
2. Télécharger la version vérifiée et contrôler son empreinte :
   ```
   curl -LO https://github.com/Panniantong/Agent-Reach/releases/download/v1.6.0/agent-reach.zip
   ```
   SHA-256 attendu :
   `59c37586e45e5e111a78686e98a9d11ae71a7b4b1a334c41aef82831ea5b0a05`
   - macOS / Linux : `shasum -a 256 agent-reach.zip`
   - Windows : `Get-FileHash agent-reach.zip`
   Si l'empreinte diffère : **ne pas installer**.
3. Installer puis configurer :
   ```
   uv tool install ./agent-reach.zip
   agent-reach setup
   ```

## Règles à respecter

- **Jamais** le paquet PyPI `agent-reach` (`pip install agent-reach`) : c'est un autre projet.
- Pour les sites avec connexion (X, Reddit, Instagram…), utiliser un **compte secondaire** :
  les plateformes peuvent bloquer les comptes utilisés en automatique.
- Ne pas installer l'extension Chrome **OpenCLI** dans le navigateur principal : c'est elle qui
  permet de recopier automatiquement les connexions (cookies) de Chrome vers Agent Reach.
- Ne jamais coller une clé API dans une conversation ; la saisir soi-même dans un terminal :
  `agent-reach configure groq-key`.
- Mises à jour : vérifier d'abord avec `agent-reach update --check`, lire les notes de version,
  puis seulement `agent-reach update`.
- Désinstaller : `agent-reach uninstall --dry-run` (voir ce qui sera supprimé), puis `agent-reach uninstall`.
