import { Audio } from "@remotion/media";
import { loadFont } from "@remotion/fonts";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Police Inter en local (les polices en ligne ne sont pas joignables pendant le rendu).
const fontFamily = "Inter";
for (const weight of ["500", "700", "800"]) {
  loadFont({ family: fontFamily, url: staticFile(`fonts/inter-latin-${weight}-normal.woff2`), weight });
}

export const FPS = 30;
/** Durée du carton de fin, après la voix off. */
export const END_SECONDS = 2.8;

const BRAND = "#2549eb";
const BRAND_DARK = "#1e2d8a";

export type Screen = {
  /** Capture de l'appli (public/shots/…). */
  src: string;
  /** Petit titre affiché en haut pendant cet écran (lisible sans le son). */
  label: string;
  start: number;
  end: number;
  /** Zoom lent vers le haut (0) ou le bas (1) de la capture. */
  focus?: number;
};

export type AdProps = {
  voice: string;
  voiceSeconds: number;
  hook: string;
  hookSub: string;
  hookEnd: number;
  /** Sous-titres calés sur la voix off (début de chaque phrase, en secondes, repéré par les pauses). */
  subtitles: { at: number; text: string }[];
  screens: Screen[];
  /** Scène d'ouverture « offre reçue dans un groupe de discussion ». */
  chatIntro?: boolean;
};

export const durationFor = (voiceSeconds: number) => Math.ceil((voiceSeconds + END_SECONDS) * FPS);

const ease = Easing.bezier(0.16, 1, 0.3, 1);

const Background = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(circle at 20% 10%, #3b67f6 0%, transparent 45%), linear-gradient(165deg, ${BRAND_DARK} 0%, ${BRAND} 70%, #3b67f6 100%)`,
    }}
  />
);

const Logo = ({ size = 44 }: { size?: number }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.35 }}>
    <Img src={staticFile("icon.svg")} style={{ width: size * 1.3, height: size * 1.3, borderRadius: size * 0.3 }} />
    <span style={{ fontSize: size, fontWeight: 800, color: "white", letterSpacing: -0.5 }}>CV Studio</span>
  </div>
);

const Hook = ({ hook, hookSub, chatIntro }: { hook: string; hookSub: string; chatIntro?: boolean }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ padding: "180px 90px", justifyContent: "center", gap: 48 }}>
      <div
        style={{
          fontSize: 100,
          fontWeight: 800,
          lineHeight: 1.05,
          color: "white",
          letterSpacing: -2,
          scale: String(interpolate(pop, [0, 1], [0.85, 1])),
          opacity: pop,
        }}
      >
        {hook}
      </div>
      <div
        style={{
          fontSize: 52,
          fontWeight: 500,
          color: "#dbe6fe",
          opacity: interpolate(frame, [10, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        {hookSub}
      </div>
      {chatIntro && <ChatCard />}
    </AbsoluteFill>
  );
};

/** Message d'offre reçu dans un groupe, puis CV envoyé sans réponse. */
const ChatCard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: frame - 12, fps, config: { damping: 16 } });
  const b = spring({ frame: frame - 34, fps, config: { damping: 16 } });
  const bubble = { borderRadius: 28, padding: "22px 28px", fontSize: 38, lineHeight: 1.3, maxWidth: 760 };
  return (
    <div style={{ background: "#0b141a", borderRadius: 40, padding: 32, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ color: "#8696a0", fontSize: 30, fontWeight: 500 }}>Groupe · Offres d’emploi</div>
      <div style={{ ...bubble, background: "#202c33", color: "#e9edef", opacity: a, translate: `0 ${interpolate(a, [0, 1], [30, 0])}px` }}>
        📢 Recrute RESPONSABLE COMPTABLE – Bac+5, 5 ans d’exp., SYSCOHADA…
      </div>
      <div
        style={{
          ...bubble,
          alignSelf: "flex-end",
          background: "#005c4b",
          color: "#e9edef",
          opacity: b,
          translate: `0 ${interpolate(b, [0, 1], [30, 0])}px`,
        }}
      >
        📄 Mon_CV.pdf <span style={{ color: "#8696a0", fontSize: 28 }}>· aucune réponse</span>
      </div>
    </div>
  );
};

const Phone = ({ screen }: { screen: Screen }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = Math.round((screen.end - screen.start) * fps);
  const enter = spring({ frame, fps, config: { damping: 15, mass: 0.8 } });
  const exit = interpolate(frame, [total - 8, total], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = interpolate(frame, [0, total], [1, 1.04], { extrapolateRight: "clamp", easing: ease });
  const focus = screen.focus ?? 0.5;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 90,
          right: 90,
          fontSize: 58,
          fontWeight: 800,
          color: "white",
          letterSpacing: -1,
          opacity: Math.min(enter, exit),
          translate: `0 ${interpolate(enter, [0, 1], [-20, 0])}px`,
        }}
      >
        {screen.label}
      </div>
      <div
        style={{
          position: "absolute",
          top: 300,
          left: 220,
          width: 640,
          height: 1138,
          borderRadius: 64,
          border: "14px solid #0f172a",
          overflow: "hidden",
          background: "white",
          boxShadow: "0 40px 90px rgba(10, 20, 60, 0.55)",
          opacity: Math.min(enter, exit),
          translate: `0 ${interpolate(enter, [0, 1], [120, 0])}px`,
          scale: String(interpolate(exit, [0, 1], [0.94, 1])),
        }}
      >
        <Img
          src={staticFile(screen.src)}
          style={{ width: "100%", height: "100%", objectFit: "cover", scale: String(zoom), transformOrigin: `50% ${focus * 100}%` }}
        />
        <div
          style={{
            position: "absolute",
            right: 18,
            bottom: 140,
            background: "rgba(15,23,42,0.75)",
            color: "white",
            fontSize: 22,
            fontWeight: 500,
            padding: "6px 14px",
            borderRadius: 999,
          }}
        >
          Démo · CV fictif
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Subtitles = ({ cues, seconds, hideBefore }: { cues: { at: number; text: string }[]; seconds: number; hideBefore: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spans = cues.map((c, i) => ({ text: c.text, from: c.at * fps, to: (cues[i + 1]?.at ?? seconds) * fps }));
  const current = spans.find((sp) => frame >= sp.from && frame < sp.to);
  // Pendant l'accroche, le texte est déjà à l'écran en grand.
  if (!current || frame < hideBefore) return null;
  const local = frame - current.from;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 140 }}>
      <div
        style={{
          maxWidth: 900,
          textAlign: "center",
          fontSize: 54,
          fontWeight: 800,
          lineHeight: 1.2,
          color: "white",
          background: "rgba(10, 18, 50, 0.82)",
          padding: "20px 34px",
          borderRadius: 28,
          opacity: interpolate(local, [0, 4], [0, 1], { extrapolateRight: "clamp" }),
          translate: `0 ${interpolate(local, [0, 6], [14, 0], { extrapolateRight: "clamp" })}px`,
        }}
      >
        {current.text}
      </div>
    </AbsoluteFill>
  );
};

const EndCard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 13 } });
  const pulse = 1 + 0.04 * Math.sin((frame / fps) * Math.PI * 2);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 56, padding: 90, textAlign: "center" }}>
      <div style={{ scale: String(interpolate(pop, [0, 1], [0.7, 1])), opacity: pop }}>
        <Logo size={84} />
      </div>
      <div style={{ fontSize: 60, fontWeight: 800, color: "white", lineHeight: 1.15, opacity: pop }}>
        Ton CV adapté à chaque offre
      </div>
      <div style={{ fontSize: 44, fontWeight: 500, color: "#dbe6fe", lineHeight: 1.4, opacity: pop }}>
        CV gratuit · IA dès 500 FCFA
        <br />
        MoMo · sans abonnement
      </div>
      <div
        style={{
          marginTop: 20,
          background: "white",
          color: BRAND,
          fontSize: 66,
          fontWeight: 800,
          padding: "30px 60px",
          borderRadius: 999,
          scale: String(pulse * interpolate(pop, [0, 1], [0.8, 1])),
          boxShadow: "0 30px 70px rgba(10, 20, 60, 0.45)",
        }}
      >
        bit.ly/cv_studio
      </div>
    </AbsoluteFill>
  );
};

export const AdVideo = ({ voice, voiceSeconds, hook, hookSub, hookEnd, subtitles, screens, chatIntro }: AdProps) => {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Background />
      <Audio src={staticFile(voice)} />
      <Sequence name="Accroche" durationInFrames={f(hookEnd)}>
        <Hook hook={hook} hookSub={hookSub} chatIntro={chatIntro} />
      </Sequence>
      {screens.map((s) => (
        <Sequence key={s.src} name={s.label} from={f(s.start)} durationInFrames={f(s.end - s.start)}>
          <Phone screen={s} />
        </Sequence>
      ))}
      <Sequence name="Sous-titres" durationInFrames={f(voiceSeconds)}>
        <Subtitles cues={subtitles} seconds={voiceSeconds} hideBefore={f(hookEnd)} />
      </Sequence>
      <Sequence name="Fin" from={f(voiceSeconds)}>
        <EndCard />
      </Sequence>
      <Sequence name="Logo" durationInFrames={f(voiceSeconds)}>
        <AbsoluteFill style={{ padding: "60px 90px" }}>
          <Logo size={36} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
