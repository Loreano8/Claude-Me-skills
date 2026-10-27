import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/fonts";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Démo de l'application : vraies séquences filmées sur un écran de téléphone, voix off et sous-titres.
// Les clips (public/demo/0X-*.mp4) sont filmés par scripts/record-demo ; la voix est découpée par scène (p1…p8).

const fontFamily = "Inter";
for (const weight of ["500", "700", "800"]) {
  loadFont({ family: fontFamily, url: staticFile(`fonts/inter-latin-${weight}-normal.woff2`), weight });
}

export const FPS = 30;
const BRAND = "#2549eb";
const BRAND_DARK = "#1e2d8a";
const OUTRO = 3.4;
const ease = Easing.bezier(0.16, 1, 0.3, 1);

type Scene = {
  clip: string;
  clipSeconds: number;
  voice: string;
  /** Durée de la scène à l'écran (la séquence filmée est accélérée pour tenir dedans). */
  seconds: number;
  label: string;
  captions: { at: number; text: string }[];
};

export const SCENES: Scene[] = [
  {
    clip: "demo/01-accueil.mp4", clipSeconds: 7.63, voice: "demo/p1.mp3", seconds: 6.1, label: "CV Studio",
    captions: [
      { at: 0.4, text: "Voici CV Studio : tout pour préparer votre candidature," },
      { at: 4.3, text: "depuis votre téléphone." },
    ],
  },
  {
    clip: "demo/02-saisie.mp4", clipSeconds: 16.20, voice: "demo/p2.mp3", seconds: 11.7, label: "1. Votre parcours, en vrac",
    captions: [
      { at: 0.7, text: "Écrivez ou dictez votre parcours, en vrac, comme il vient." },
      { at: 5.8, text: "CV Studio range tout et met en forme un CV clair," },
      { at: 10.0, text: "aux normes des recruteurs." },
    ],
  },
  {
    clip: "demo/03-apercu.mp4", clipSeconds: 8.60, voice: "demo/p3.mp3", seconds: 8.0, label: "2. Votre modèle",
    captions: [
      { at: 0.4, text: "Choisissez votre modèle." },
      { at: 2.5, text: "Le bouton « Recommandé » règle la photo et les détails selon l’usage." },
    ],
  },
  {
    clip: "demo/04-offre.mp4", clipSeconds: 15.27, voice: "demo/p4.mp3", seconds: 12.2, label: "3. Adapté à chaque offre",
    captions: [
      { at: 0.5, text: "Une offre vous intéresse ? Collez l’annonce." },
      { at: 3.5, text: "CV Studio vous pose une question si besoin," },
      { at: 6.8, text: "puis adapte votre CV au poste." },
      { at: 9.6, text: "Et le score vous montre le gain." },
    ],
  },
  {
    clip: "demo/05-lettre.mp4", clipSeconds: 11.23, voice: "demo/p5.mp3", seconds: 7.0, label: "4. La lettre de motivation",
    captions: [{ at: 0.45, text: "Votre lettre de motivation suit, écrite pour cette offre précise." }],
  },
  {
    clip: "demo/06-scanner.mp4", clipSeconds: 18.10, voice: "demo/p6.mp3", seconds: 11.3, label: "5. Vos papiers, scannés",
    captions: [
      { at: 0.55, text: "Il faut joindre vos diplômes ? Prenez-les en photo :" },
      { at: 4.3, text: "la page est redressée et nettoyée," },
      { at: 6.6, text: "comme un vrai scan, puis réunie dans un seul PDF." },
    ],
  },
  {
    clip: "demo/07-documents.mp4", clipSeconds: 11.70, voice: "demo/p7.mp3", seconds: 8.9, label: "6. Tout est rangé",
    captions: [
      { at: 0.1, text: "Tous vos CV et vos lettres vous attendent dans « Mes documents »." },
      { at: 4.3, text: "Vos papiers sont rangés dans le coffre-fort, protégé par votre code." },
    ],
  },
  {
    clip: "demo/08-credits.mp4", clipSeconds: 7.70, voice: "demo/p8.mp3", seconds: 6.6, label: "Paiement Mobile Money",
    captions: [
      { at: 0.1, text: "Votre CV est gratuit. Le reste se paie en Mobile Money, sans abonnement." },
      { at: 4.6, text: "CV Studio : essayez-le dès aujourd’hui." },
    ],
  },
];

const starts = SCENES.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + SCENES[i - 1].seconds], []);
export const DEMO_SECONDS = starts[starts.length - 1] + SCENES[SCENES.length - 1].seconds + OUTRO;

const Background = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(circle at 15% 8%, #3b67f6 0%, transparent 45%), radial-gradient(circle at 90% 95%, #0ea5e9 0%, transparent 40%), linear-gradient(165deg, ${BRAND_DARK} 0%, ${BRAND} 75%)`,
    }}
  />
);

/** Le téléphone : la séquence filmée dans un cadre arrondi, avec une légère entrée. */
const Phone = ({ scene }: { scene: Scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 14 });
  const H = 1290;
  const W = Math.round((H * 780) / 1688);
  return (
    <div
      style={{
        position: "absolute",
        left: (1080 - W) / 2 - 16,
        top: 250,
        width: W + 32,
        height: H + 32,
        borderRadius: 72,
        background: "#0b1020",
        padding: 16,
        boxShadow: "0 40px 90px rgba(5, 10, 40, 0.55)",
        transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px) scale(${interpolate(enter, [0, 1], [0.97, 1])})`,
        opacity: interpolate(enter, [0, 1], [0.4, 1]),
      }}
    >
      <div style={{ width: W, height: H, borderRadius: 58, overflow: "hidden", background: "#fff" }}>
        <Video src={staticFile(scene.clip)} muted playbackRate={scene.clipSeconds / scene.seconds} style={{ width: W, height: H, objectFit: "cover" }} />
      </div>
    </div>
  );
};

const Label = ({ text }: { text: string }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp", easing: ease });
  return (
    <div style={{ position: "absolute", top: 110, width: "100%", display: "flex", justifyContent: "center", opacity: t, transform: `translateY(${(1 - t) * -16}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, background: "rgba(255,255,255,0.14)", border: "2px solid rgba(255,255,255,0.25)", borderRadius: 999, padding: "16px 34px" }}>
        <Img src={staticFile("icon.svg")} style={{ width: 52, height: 52 }} />
        <span style={{ fontFamily, fontWeight: 800, fontSize: 46, color: "#fff", letterSpacing: -0.5 }}>{text}</span>
      </div>
    </div>
  );
};

const Captions = ({ scene }: { scene: Scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = frame / fps;
  const current = [...scene.captions].reverse().find((c) => now >= c.at);
  if (!current) return null;
  const since = now - current.at;
  const t = interpolate(since, [0, 0.25], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", bottom: 90, left: 60, right: 60, display: "flex", justifyContent: "center", opacity: t }}>
      <div style={{ background: "rgba(8, 12, 35, 0.82)", borderRadius: 28, padding: "22px 34px", fontFamily, fontWeight: 700, fontSize: 44, lineHeight: 1.25, color: "#fff", textAlign: "center" }}>
        {current.text}
      </div>
    </div>
  );
};

const Outro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 36, opacity: s }}>
      <Img src={staticFile("icon.svg")} style={{ width: 220, height: 220, transform: `scale(${interpolate(s, [0, 1], [0.8, 1])})` }} />
      <div style={{ fontFamily, fontWeight: 800, fontSize: 96, color: "#fff", letterSpacing: -2 }}>CV Studio</div>
      <div style={{ fontFamily, fontWeight: 500, fontSize: 46, color: "rgba(255,255,255,0.9)", textAlign: "center", lineHeight: 1.35 }}>
        Un CV qui correspond à chaque offre.
        <br />
        CV gratuit · paiement Mobile Money
      </div>
      <div style={{ marginTop: 20, background: "#fff", color: BRAND, borderRadius: 999, padding: "22px 48px", fontFamily, fontWeight: 800, fontSize: 52 }}>bit.ly/cv_studio</div>
    </AbsoluteFill>
  );
};

export const DemoVideo = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND }}>
      <Background />
      {SCENES.map((scene, i) => (
        <Sequence key={scene.clip} from={Math.round(starts[i] * fps)} durationInFrames={Math.round(scene.seconds * fps)}>
          <Label text={scene.label} />
          <Phone scene={scene} />
          <Captions scene={scene} />
          <Audio src={staticFile(scene.voice)} />
        </Sequence>
      ))}
      <Sequence from={Math.round((DEMO_SECONDS - OUTRO) * fps)}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
