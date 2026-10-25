# CV Studio — vidéos pub (Remotion)

Quatre pubs verticales 1080×1920 pour les statuts WhatsApp, TikTok et les Reels Facebook/Instagram.
Les accroches viennent de `../cv-generator/founder/marketing.md`.

| Vidéo | Accroche | Durée |
| --- | --- | --- |
| `Pub1-CV-adapte` | 10 CV envoyés, zéro réponse ? | 17 s |
| `Pub2-Parle` | Tu n’aimes pas écrire ? | 20 s |
| `Pub3-ChatGPT` | ChatGPT te donne du texte. | 28 s |
| `Pub4-Canada` | Le Canada en vue ? | 16 s |

- **Voix off** : Higgsfield (Seed Audio, voix « Celine »), dans `public/vo/`.
- **Écrans** : vraies captures de l'appli en mode démo (CV fictif, signalé à l'écran), dans `public/shots/`.
- **Moteur commun** : `src/ad/AdVideo.tsx` (accroche, téléphone animé, sous-titres calés sur les pauses de la voix, carton de fin avec bit.ly/cv_studio).
- **Les textes et les timings** de chaque pub sont dans `src/Root.tsx`.

```bash
npm i
npx remotion studio                    # prévisualiser et modifier
npx remotion render Pub1-CV-adapte out/Pub1-CV-adapte.mp4
```
