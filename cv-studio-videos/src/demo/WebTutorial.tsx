import { Video } from "@remotion/media";
import { loadFont } from "@remotion/fonts";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Tutoriel CVCasa filmé sur le site en version ordinateur : à gauche les étapes à suivre, à droite le site.
// Les clips (public/web/w*.mp4) sont filmés par scripts/record-web.cjs. Pas de voix : tout est écrit à l'écran.

const fontFamily = "Inter";
for (const weight of ["500", "700", "800"]) {
  loadFont({ family: fontFamily, url: staticFile(`fonts/inter-latin-${weight}-normal.woff2`), weight });
}

const BRAND = "#2549eb";
const BRAND_DARK = "#1e2d8a";
const INTRO = 3.2;
const OUTRO = 4;
const ease = Easing.bezier(0.16, 1, 0.3, 1);

type Chapter = {
  clip: string;
  clipSeconds: number;
  /** Secondes coupées au début du clip (attente du chargement). */
  trim?: number;
  seconds: number;
  title: string;
  /** `at` : secondes à l'écran depuis le début du chapitre. */
  steps: { at: number; text: string }[];
};

export const CHAPTERS: Chapter[] = [
  {
    clip: "web/w1-accueil.mp4", clipSeconds: 14.43, seconds: 9, title: "Bienvenue",
    steps: [
      { at: 0, text: "Ouvrez cvcasa.com, depuis un ordinateur ou un téléphone." },
      { at: 2.4, text: "Faites défiler pour voir ce que fait CVCasa." },
      { at: 6, text: "Cliquez sur « Créer mon CV gratuitement »." },
    ],
  },
  {
    clip: "web/w2-infos.mp4", clipSeconds: 41.43, seconds: 28, title: "Créer votre CV",
    steps: [
      { at: 0, text: "À la première visite, un guide vous montre chaque bouton. « Passer » pour le fermer." },
      { at: 9.4, text: "Écrivez votre parcours en vrac, ou dictez-le au micro." },
      { at: 19.2, text: "Cliquez sur « Générer mon CV »." },
      { at: 21, text: "Votre CV apparaît à droite et se met à jour en direct." },
      { at: 23.8, text: "Vérifiez et complétez chaque rubrique si besoin." },
    ],
  },
  {
    clip: "web/w3-apercu.mp4", clipSeconds: 19.4, trim: 2.5, seconds: 12, title: "Choisir le modèle",
    steps: [
      { at: 0, text: "Ouvrez l’onglet « Aperçu »." },
      { at: 1.5, text: "Cliquez sur un modèle pour l’essayer." },
      { at: 5.6, text: "« Recommandé » règle la photo et les détails selon l’usage." },
      { at: 8.6, text: "Téléchargez votre CV en PDF." },
    ],
  },
  {
    clip: "web/w4-offre.mp4", clipSeconds: 28.83, seconds: 18, title: "Adapter à une offre",
    steps: [
      { at: 0, text: "Onglet « Offre » : collez l’annonce (lien, texte ou capture)." },
      { at: 5.3, text: "Cliquez sur « Adapter mon CV à l’offre »." },
      { at: 6.9, text: "Si l’annonce n’est pas claire, CVCasa vous pose une question." },
      { at: 11.3, text: "Validez : votre CV est réécrit pour ce poste. L’original ne change pas." },
      { at: 13.8, text: "Le score montre ce que vous avez gagné." },
    ],
  },
  {
    clip: "web/w5-lettre.mp4", clipSeconds: 31.4, seconds: 20, title: "La lettre de motivation",
    steps: [
      { at: 0, text: "Onglet « Lettre » : cliquez sur « Générer la lettre »." },
      { at: 3.8, text: "Répondez à une ou deux questions, à l’écrit ou au micro." },
      { at: 11.5, text: "Votre lettre est prête. Relisez : tout se modifie." },
      { at: 17.4, text: "Téléchargez-la en PDF, assortie à votre CV." },
    ],
  },
  {
    clip: "web/w6-scanner.mp4", clipSeconds: 36.2, seconds: 21, title: "Scanner vos papiers",
    steps: [
      { at: 0, text: "Cliquez sur « Scanner », en haut de la page." },
      { at: 2.3, text: "Prenez la page en photo, ou importez une image." },
      { at: 7, text: "Placez les 4 coins sur les bords de la feuille." },
      { at: 16.9, text: "Validez : la page est redressée, comme un vrai scan." },
      { at: 18.9, text: "Créez le PDF, prêt à joindre." },
    ],
  },
  {
    clip: "web/w7-documents.mp4", clipSeconds: 12.2, seconds: 8, title: "Retrouver vos documents",
    steps: [
      { at: 0, text: "Onglet « Docs » : tous vos CV et lettres, du plus récent au plus ancien." },
      { at: 3.6, text: "Le coffre-fort garde vos papiers, protégé par votre code." },
    ],
  },
  {
    clip: "web/w8-credits.mp4", clipSeconds: 8.27, seconds: 6.5, title: "Crédits",
    steps: [
      { at: 0, text: "Votre CV est gratuit." },
      { at: 1.6, text: "Le reste se paie en crédits, par Mobile Money, sans abonnement." },
    ],
  },
];

const starts = CHAPTERS.reduce<number[]>((acc, c, i) => [...acc, i === 0 ? INTRO : acc[i - 1] + CHAPTERS[i - 1].seconds], []);
export const WEB_TUTORIAL_SECONDS = starts[starts.length - 1] + CHAPTERS[CHAPTERS.length - 1].seconds + OUTRO;

const Background = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(circle at 8% 10%, #3b67f6 0%, transparent 40%), radial-gradient(circle at 95% 100%, #0ea5e9 0%, transparent 35%), linear-gradient(160deg, ${BRAND_DARK} 0%, ${BRAND} 80%)`,
    }}
  />
);

const BW = 1380;
const CH = Math.round((BW * 900) / 1440);
const BAR = 46;
const BX = 500;
const BY = Math.round((1080 - CH - BAR) / 2);

/** Fenêtre de navigateur avec l'adresse cvcasa.com et le clip du chapitre. */
const Browser = ({ chapter }: { chapter: Chapter }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rate = (chapter.clipSeconds - (chapter.trim ?? 0)) / chapter.seconds;
  const fade = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: BX, top: BY, width: BW, height: CH + BAR, borderRadius: 18, overflow: "hidden", background: "#fff", boxShadow: "0 30px 80px rgba(5, 10, 40, 0.5)" }}>
      <div style={{ height: BAR, background: "#eef1f6", display: "flex", alignItems: "center", gap: 10, padding: "0 18px", borderBottom: "1px solid #dfe3ea" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c }} />
        ))}
        <div style={{ marginLeft: 22, flex: 1, maxWidth: 560, height: 28, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", gap: 8, padding: "0 14px", fontFamily, fontWeight: 500, fontSize: 16, color: "#334155" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          cvcasa.com
        </div>
      </div>
      <div style={{ width: BW, height: CH, opacity: fade }}>
        <Video
          src={staticFile(chapter.clip)}
          muted
          trimBefore={Math.round((chapter.trim ?? 0) * fps)}
          playbackRate={rate}
          style={{ width: BW, height: CH, objectFit: "cover" }}
        />
      </div>
    </div>
  );
};

/** Colonne de gauche : numéro et titre du chapitre, étapes à suivre (l'étape en cours est mise en avant). */
const Steps = ({ chapter, index }: { chapter: Chapter; index: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = frame / fps;
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 16 });
  const current = chapter.steps.reduce((acc, s, i) => (now >= s.at ? i : acc), 0);
  return (
    <div style={{ position: "absolute", left: 50, top: BY, width: 410, fontFamily, color: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: enter }}>
        <Img src={staticFile("icon.svg")} style={{ width: 44, height: 44 }} />
        <span style={{ fontWeight: 800, fontSize: 30, letterSpacing: -0.5 }}>CVCasa</span>
        <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 18, color: "rgba(255,255,255,0.7)" }}>Tutoriel</span>
      </div>
      <div style={{ marginTop: 56, opacity: enter, transform: `translateX(${(1 - enter) * -24}px)` }}>
        <div style={{ fontWeight: 700, fontSize: 22, color: "rgba(255,255,255,0.75)" }}>
          Étape {index + 1} sur {CHAPTERS.length}
        </div>
        <div style={{ marginTop: 8, fontWeight: 800, fontSize: 46, lineHeight: 1.08, letterSpacing: -1 }}>{chapter.title}</div>
      </div>
      <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 14 }}>
        {chapter.steps.map((s, i) => {
          const shown = interpolate(now - s.at, [0, 0.35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
          const active = i === current;
          return (
            <div
              key={s.text}
              style={{
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                padding: "14px 16px",
                borderRadius: 16,
                background: active ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.1)",
                color: active ? "#0f172a" : "rgba(255,255,255,0.8)",
                opacity: shown,
                transform: `translateY(${(1 - shown) * 14}px)`,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 30,
                  height: 30,
                  borderRadius: 99,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 16,
                  background: active ? BRAND : i < current ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)",
                  color: "#fff",
                }}
              >
                {i < current ? "✓" : i + 1}
              </span>
              <span style={{ fontWeight: active ? 700 : 500, fontSize: 23, lineHeight: 1.3 }}>{s.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Barre de progression des chapitres, en bas de la colonne de gauche. */
const Progress = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = frame / fps + INTRO;
  return (
    <div style={{ position: "absolute", left: 50, width: 410, top: BY + CH + BAR - 10, display: "flex", gap: 6 }}>
      {CHAPTERS.map((c, i) => {
        const p = interpolate(now, [starts[i], starts[i] + c.seconds], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={c.clip} style={{ flex: 1, height: 6, borderRadius: 9, background: "rgba(255,255,255,0.22)", overflow: "hidden" }}>
            <div style={{ width: `${p * 100}%`, height: "100%", background: "#fff" }} />
          </div>
        );
      })}
    </div>
  );
};

const Intro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  const out = interpolate(frame, [INTRO * fps - 10, INTRO * fps], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 28, opacity: s * out, fontFamily, color: "#fff" }}>
      <Img src={staticFile("icon.svg")} style={{ width: 150, height: 150, transform: `scale(${interpolate(s, [0, 1], [0.85, 1])})` }} />
      <div style={{ fontWeight: 800, fontSize: 84, letterSpacing: -2 }}>Comment ça marche</div>
      <div style={{ fontWeight: 500, fontSize: 38, color: "rgba(255,255,255,0.88)" }}>Votre CV, votre lettre et vos papiers, pas à pas</div>
    </AbsoluteFill>
  );
};

const Outro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30, opacity: s, fontFamily, color: "#fff" }}>
      <Img src={staticFile("icon.svg")} style={{ width: 170, height: 170 }} />
      <div style={{ fontWeight: 800, fontSize: 80, letterSpacing: -2 }}>À vous de jouer</div>
      <div style={{ fontWeight: 500, fontSize: 38, color: "rgba(255,255,255,0.9)" }}>Votre CV est gratuit. Paiement Mobile Money pour le reste.</div>
      <div style={{ marginTop: 16, background: "#fff", color: BRAND, borderRadius: 999, padding: "20px 46px", fontWeight: 800, fontSize: 48 }}>cvcasa.com</div>
    </AbsoluteFill>
  );
};

export const WebTutorial = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND }}>
      <Background />
      <Sequence durationInFrames={Math.round(INTRO * fps)}>
        <Intro />
      </Sequence>
      {CHAPTERS.map((c, i) => (
        <Sequence key={c.clip} from={Math.round(starts[i] * fps)} durationInFrames={Math.round(c.seconds * fps)}>
          <Steps chapter={c} index={i} />
          <Browser chapter={c} />
        </Sequence>
      ))}
      <Sequence from={Math.round(INTRO * fps)} durationInFrames={Math.round((WEB_TUTORIAL_SECONDS - INTRO - OUTRO) * fps)}>
        <Progress />
      </Sequence>
      <Sequence from={Math.round((WEB_TUTORIAL_SECONDS - OUTRO) * fps)}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
