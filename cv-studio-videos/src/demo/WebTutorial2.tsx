import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/fonts";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Tutoriel CVCasa (version 2 : veille emploi et suivi) filmé sur le site en version ordinateur : à gauche les étapes à suivre, à droite le site.
// Les clips (public/web/w*.mp4) sont filmés par scripts/record-web.cjs. Voix off : public/web/v*.mp3 (Fish Audio),
// découpée aux pauses pour que chaque phrase tombe sur l'étape qu'elle décrit.

const fontFamily = "Inter";
for (const weight of ["500", "700", "800"]) {
  loadFont({ family: fontFamily, url: staticFile(`fonts/inter-latin-${weight}-normal.woff2`), weight });
}

const BRAND = "#2549eb";
const BRAND_DARK = "#1e2d8a";
const INTRO = 6;
const OUTRO = 4.6;
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
  /** Morceaux de voix off : fichier, extrait [from, to] en secondes (to absent = jusqu'au bout), et moment où il commence. */
  voice: { src: string; from?: number; to?: number; at: number }[];
};

export const CHAPTERS: Chapter[] = [
  {
    clip: "web2/w1-accueil.mp4", clipSeconds: 16.2, seconds: 12, title: "Bienvenue",
    steps: [
      { at: 0, text: "Ouvrez cvcasa.com, sur ordinateur ou sur téléphone." },
      { at: 2.2, text: "Veille emploi, lettre, suivi : tout est au même endroit." },
      { at: 4.8, text: "13 modèles de CV professionnels." },
      { at: 9.5, text: "Cliquez sur « Créer mon CV gratuitement »." },
    ],
    voice: [{ src: "web2/v1.mp3", at: 0.4 }],
  },
  {
    clip: "web2/w2-infos.mp4", clipSeconds: 22.33, trim: 3, seconds: 14, title: "Créer votre CV",
    steps: [
      { at: 0, text: "Écrivez votre parcours en vrac, ou importez votre ancien CV." },
      { at: 7.4, text: "Cliquez sur « Générer mon CV »." },
      { at: 9.4, text: "Votre CV apparaît à droite, prêt à vérifier." },
    ],
    voice: [
      { src: "web2/v2.mp3", to: 5.0, at: 0.3 },
      { src: "web2/v2.mp3", from: 5.0, at: 7.2 },
    ],
  },
  {
    clip: "web2/w3-apercu.mp4", clipSeconds: 16.33, trim: 1.5, seconds: 9, title: "Choisir le modèle",
    steps: [
      { at: 0, text: "Onglet « Aperçu » : cliquez sur un modèle pour l’essayer." },
      { at: 6.5, text: "Téléchargez votre CV en PDF, gratuitement." },
    ],
    voice: [{ src: "web2/v3.mp3", at: 0.3 }],
  },
  {
    clip: "web2/w4-offre.mp4", clipSeconds: 22.37, seconds: 14, title: "Adapter à une offre",
    steps: [
      { at: 0, text: "Onglet « Offre » : collez l’annonce (lien, texte ou capture)." },
      { at: 3.1, text: "Cliquez sur « Adapter mon CV à l’offre »." },
      { at: 4.4, text: "Une question si l’annonce n’est pas claire." },
      { at: 7.8, text: "Votre CV est adapté au poste. Le score montre le gain." },
    ],
    voice: [
      { src: "web2/v4.mp3", to: 2.4, at: 0.2 },
      { src: "web2/v4.mp3", from: 2.4, at: 4.6 },
    ],
  },
  {
    clip: "web2/w5-lettre.mp4", clipSeconds: 19.27, seconds: 12, title: "La lettre de motivation",
    steps: [
      { at: 0, text: "Onglet « Lettre » : cliquez sur « Générer la lettre »." },
      { at: 1.9, text: "Répondez à une ou deux questions." },
      { at: 6.9, text: "Votre lettre est prête. Tout se modifie." },
    ],
    voice: [
      { src: "web2/v5.mp3", to: 2.9, at: 1.4 },
      { src: "web2/v5.mp3", from: 2.9, at: 6.9 },
    ],
  },
  {
    clip: "web2/w6-veille.mp4", clipSeconds: 25.63, seconds: 16, title: "La veille emploi",
    steps: [
      { at: 0, text: "Onglet « Veille » : cochez métier, contrats et villes." },
      { at: 5.9, text: "Cliquez sur « Chercher maintenant »." },
      { at: 7.5, text: "Les offres arrivent, avec « Adapter mon CV »." },
      { at: 11.9, text: "Choisissez « Chaque matin » et activez la veille." },
    ],
    voice: [
      { src: "web2/v6.mp3", to: 3.9, at: 0.3 },
      { src: "web2/v6.mp3", from: 3.9, to: 6.4, at: 7.3 },
      { src: "web2/v6.mp3", from: 6.4, at: 11.6 },
    ],
  },
  {
    clip: "web2/w7-suivi.mp4", clipSeconds: 15.03, seconds: 10, title: "Le suivi",
    steps: [
      { at: 0, text: "Onglet « Suivi » : toutes vos candidatures au même endroit." },
      { at: 2.7, text: "Changez l’étape : envoyée, entretien, réponse." },
      { at: 5.3, text: "Notez les détails. Un rappel vous dit quand relancer." },
    ],
    voice: [{ src: "web2/v7.mp3", at: 0.3 }],
  },
  {
    clip: "web2/w8-credits.mp4", clipSeconds: 6.97, seconds: 7, title: "Crédits",
    steps: [
      { at: 0, text: "Votre CV est gratuit." },
      { at: 1.6, text: "Le reste en crédits, par Mobile Money, sans abonnement." },
    ],
    voice: [{ src: "web2/v8.mp3", at: 0.3 }],
  },
];

const starts = CHAPTERS.reduce<number[]>((acc, c, i) => [...acc, i === 0 ? INTRO : acc[i - 1] + CHAPTERS[i - 1].seconds], []);
export const WEB_TUTORIAL2_SECONDS = starts[starts.length - 1] + CHAPTERS[CHAPTERS.length - 1].seconds + OUTRO;

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
      <div style={{ fontWeight: 500, fontSize: 38, color: "rgba(255,255,255,0.88)" }}>Votre CV, votre lettre, les offres et le suivi, pas à pas</div>
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

export const WebTutorial2 = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND }}>
      <Background />
      <Sequence durationInFrames={Math.round(INTRO * fps)}>
        <Intro />
        <Sequence from={6} layout="none">
          <Audio src={staticFile("web2/v0.mp3")} />
        </Sequence>
      </Sequence>
      {CHAPTERS.map((c, i) => (
        <Sequence key={c.clip} from={Math.round(starts[i] * fps)} durationInFrames={Math.round(c.seconds * fps)}>
          <Steps chapter={c} index={i} />
          <Browser chapter={c} />
          {c.voice.map((v) => (
            <Sequence key={`${v.src}-${v.at}`} from={Math.round(v.at * fps)} layout="none">
              <Audio
                src={staticFile(v.src)}
                trimBefore={v.from ? Math.round(v.from * fps) : undefined}
                trimAfter={v.to ? Math.round(v.to * fps) : undefined}
              />
            </Sequence>
          ))}
        </Sequence>
      ))}
      <Sequence from={Math.round(INTRO * fps)} durationInFrames={Math.round((WEB_TUTORIAL2_SECONDS - INTRO - OUTRO) * fps)}>
        <Progress />
      </Sequence>
      <Sequence from={Math.round((WEB_TUTORIAL2_SECONDS - OUTRO) * fps)}>
        <Outro />
        <Sequence from={10} layout="none">
          <Audio src={staticFile("web2/v9.mp3")} />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};
