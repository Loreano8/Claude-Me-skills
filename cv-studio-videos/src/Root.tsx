import { Composition, Folder } from "remotion";
import { WEB_TUTORIAL_SECONDS, WebTutorial } from "./demo/WebTutorial";
import { AdVideo, durationFor, FPS } from "./ad/AdVideo";
import { DEMO_SECONDS, DemoVideo } from "./demo/DemoVideo";

// Quatre pubs verticales (statuts WhatsApp, TikTok, Reels). Accroches tirées de founder/marketing.md.
export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="CV-Studio-pubs">
      <Composition
        id="Pub1-CV-adapte"
        component={AdVideo}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={durationFor(13.87)}
        defaultProps={{
          voice: "vo/v1.mp3",
          voiceSeconds: 13.87,
          hook: "10 CV envoyés, zéro réponse ?",
          hookSub: "Ton CV ne parle peut-être pas comme l’offre.",
          hookEnd: 3.92,
          chatIntro: true,
          subtitles: [
            { at: 0.2, text: "Dix CV envoyés, zéro réponse ?" },
            { at: 1.59, text: "Ton CV ne parle peut-être pas comme l’offre." },
            { at: 3.92, text: "Colle l’annonce reçue sur WhatsApp, même en capture d’écran." },
            { at: 7.15, text: "En 15 secondes, l’IA adapte ton CV au poste, sans rien inventer." },
            { at: 11.09, text: "Ton CV est gratuit. L’IA dès 500 FCFA, en MoMo, sans abonnement." },
          ],
          screens: [
            { src: "shots/06-offre-collee.png", label: "1. Colle l’offre", start: 3.92, end: 7.15, focus: 0.2 },
            { src: "shots/07-score.png", label: "2. Ton CV colle au poste", start: 7.15, end: 11.09, focus: 0.35 },
            { src: "shots/09-apercu.png", label: "3. Télécharge en PDF", start: 11.09, end: 13.87, focus: 0.6 },
          ],
        }}
      />
      <Composition
        id="Pub2-Parle"
        component={AdVideo}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={durationFor(17.27)}
        defaultProps={{
          voice: "vo/v2.mp3",
          voiceSeconds: 17.27,
          hook: "Tu n’aimes pas écrire ?",
          hookSub: "Raconte ton parcours. Ton CV s’écrit tout seul.",
          hookEnd: 1.4,
          subtitles: [
            { at: 0.47, text: "Tu n’aimes pas écrire ?" },
            { at: 1.4, text: "Raconte ton parcours à voix haute : tes études, tes stages, ton travail." },
            { at: 5.51, text: "CV Studio écrit un CV propre, aux normes des recruteurs." },
            { at: 8.31, text: "Tu veux changer quelque chose ? Dis-le simplement :" },
            { at: 11.14, text: "« Mets ce poste en premier, enlève le permis. » Et c’est fait." },
            { at: 15.21, text: "Essaie gratuitement sur CV Studio." },
          ],
          screens: [
            { src: "shots/02-dictee.png", label: "🎙️ Raconte ton parcours", start: 1.4, end: 5.51, focus: 0.3 },
            { src: "shots/09-apercu.png", label: "Ton CV pro est prêt", start: 5.51, end: 8.31, focus: 0.6 },
            { src: "shots/04-corriger-saisie.png", label: "Corrige… en parlant", start: 8.31, end: 11.14, focus: 0.3 },
            { src: "shots/05-corriger-resultat.png", label: "C’est fait ✔", start: 11.14, end: 17.27, focus: 0.3 },
          ],
        }}
      />
      <Composition
        id="Pub3-ChatGPT"
        component={AdVideo}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={durationFor(24.84)}
        defaultProps={{
          voice: "vo/v3.mp3",
          voiceSeconds: 24.84,
          hook: "ChatGPT te donne du texte.",
          hookSub: "CV Studio te donne un CV prêt à envoyer.",
          hookEnd: 3.23,
          subtitles: [
            { at: 0.41, text: "ChatGPT te donne du texte." },
            { at: 3.23, text: "CV Studio te donne un CV prêt à envoyer, en PDF ou en Word," },
            { at: 6.8, text: "avec 13 modèles pro." },
            { at: 7.83, text: "Colle l’offre : ton CV adapté," },
            { at: 11.2, text: "ta lettre de motivation," },
            { at: 12.75, text: "et les questions d’entretien pour ce poste." },
            { at: 16.27, text: "Paiement MoMo au nom de CV Studio." },
            { at: 19.23, text: "Pas d’abonnement, rien n’est prélevé ensuite." },
          ],
          screens: [
            { src: "shots/09-apercu.png", label: "Un CV prêt à envoyer", start: 3.23, end: 6.8, focus: 0.6 },
            { src: "shots/10-modeles.png", label: "13 modèles pro", start: 6.8, end: 9.1, focus: 0.4 },
            { src: "shots/07-score.png", label: "Adapté à l’offre", start: 9.1, end: 11.2, focus: 0.35 },
            { src: "shots/12-lettre.png", label: "La lettre de motivation", start: 11.2, end: 12.75, focus: 0.3 },
            { src: "shots/08-entretien.png", label: "Les questions d’entretien", start: 12.75, end: 16.27, focus: 0.5 },
            { src: "shots/01-accueil.png", label: "Sans abonnement", start: 16.27, end: 24.84, focus: 0.2 },
          ],
        }}
      />
      <Composition
        id="Demo-Application"
        component={DemoVideo}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={Math.ceil(DEMO_SECONDS * FPS)}
      />
      <Composition
        id="Tutoriel-Site"
        component={WebTutorial}
        width={1920}
        height={1080}
        fps={FPS}
        durationInFrames={Math.ceil(WEB_TUTORIAL_SECONDS * FPS)}
      />
    </Folder>
  );
};
