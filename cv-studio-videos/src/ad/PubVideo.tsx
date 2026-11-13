import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/fonts";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Pubs verticales CVCasa : accroche, appli filmée dans un téléphone, sous-titres, carton de fin.
const fontFamily = "Inter";
for (const weight of ["500", "700", "800"]) {
  loadFont({ family: fontFamily, url: staticFile(`fonts/inter-latin-${weight}-normal.woff2`), weight });
}

export const PUB_FPS = 30;
const END_SECONDS = 3;
const BRAND = "#2549eb";
const BRAND_DARK = "#1e2d8a";
const ease = Easing.bezier(0.16, 1, 0.3, 1);

type Part =
  | { kind: "clip"; src: string; start: number; end: number; trim?: number; clipSeconds: number; label: string }
  | { kind: "image"; src: string; start: number; end: number; label: string }
  | { kind: "templates"; start: number; end: number; label: string };

export type PubProps = {
  voice: string;
  voiceSeconds: number;
  hook: string;
  hookEnd: number;
  /** [début, texte] : un morceau de phrase par segment de voix. */
  subtitles: [number, string][];
  parts: Part[];
};

export const pubDuration = (p: PubProps) => Math.ceil((p.voiceSeconds + END_SECONDS) * PUB_FPS);

const Background = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(circle at 15% 8%, #3b67f6 0%, transparent 45%), radial-gradient(circle at 90% 95%, #0ea5e9 0%, transparent 40%), linear-gradient(165deg, ${BRAND_DARK} 0%, ${BRAND} 75%)`,
    }}
  />
);

const Hook = ({ text }: { text: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 13 } });
  const words = text.split(" ");
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ fontFamily, fontWeight: 800, fontSize: 112, lineHeight: 1.08, color: "#fff", textAlign: "center", transform: `scale(${0.85 + 0.15 * pop})`, letterSpacing: -2 }}>
        {words.map((w, i) => {
          const a = interpolate(frame, [i * 3, i * 3 + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <span key={i} style={{ opacity: a, display: "inline-block", transform: `translateY(${(1 - a) * 30}px)`, marginRight: 26 }}>
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const PHONE_W = 700;
const PHONE_H = Math.round((PHONE_W * 1686) / 780);

const PhoneShell = ({ children, label }: { children: React.ReactNode; label: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16, mass: 0.8 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
      <div style={{ fontFamily, fontWeight: 800, fontSize: 50, color: "#fff", marginBottom: 34, opacity: enter, transform: `translateY(${(1 - enter) * -20}px)` }}>{label}</div>
      <div
        style={{
          width: PHONE_W + 28,
          height: PHONE_H + 28,
          borderRadius: 78,
          background: "#0b0f1a",
          padding: 14,
          boxShadow: "0 40px 90px rgba(0,0,0,0.45)",
          transform: `translateY(${(1 - enter) * 260}px) scale(${0.92 + 0.08 * enter})`,
          opacity: enter,
        }}
      >
        <div style={{ width: PHONE_W, height: PHONE_H, borderRadius: 64, overflow: "hidden", background: "#fff", position: "relative" }}>{children}</div>
      </div>
    </AbsoluteFill>
  );
};

const ClipPart = ({ part }: { part: Extract<Part, { kind: "clip" }> }) => {
  const { fps } = useVideoConfig();
  const usable = part.clipSeconds - (part.trim ?? 0);
  const rate = Math.max(0.6, usable / (part.end - part.start));
  return (
    <PhoneShell label={part.label}>
      <Video src={staticFile(part.src)} muted trimBefore={Math.round((part.trim ?? 0) * fps)} playbackRate={rate} style={{ width: PHONE_W, height: PHONE_H, objectFit: "cover" }} />
    </PhoneShell>
  );
};

const ImagePart = ({ part }: { part: Extract<Part, { kind: "image" }> }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = (part.end - part.start) * fps;
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const tilt = interpolate(frame, [0, total], [-4, -1]);
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 110 }}>
      <div style={{ fontFamily, fontWeight: 800, fontSize: 50, color: "#fff", marginBottom: 40 }}>{part.label}</div>
      <Img
        src={staticFile(part.src)}
        style={{ width: 760, borderRadius: 12, boxShadow: "0 40px 90px rgba(0,0,0,0.5)", transform: `rotate(${tilt}deg) scale(${0.8 + 0.2 * enter})`, filter: "sepia(0.25) saturate(0.8)" }}
      />
    </AbsoluteFill>
  );
};

const MODELES = ["moderne", "elegant", "finance", "classique", "creatif", "executif"];

const TemplatesPart = ({ part }: { part: Extract<Part, { kind: "templates" }> }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = (part.end - part.start) * fps;
  const per = total / MODELES.length;
  const pos = frame / per;
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 110 }}>
      <div style={{ fontFamily, fontWeight: 800, fontSize: 50, color: "#fff", marginBottom: 40 }}>{part.label}</div>
      <div style={{ position: "relative", width: 1080, height: 1100 }}>
        {MODELES.map((m, i) => {
          const d = i - pos + 0.5;
          const x = d * 600;
          const s = interpolate(Math.abs(d), [0, 1.2], [1, 0.72], { extrapolateRight: "clamp" });
          const o = interpolate(Math.abs(d), [0, 1.6], [1, 0.35], { extrapolateRight: "clamp" });
          return (
            <Img
              key={m}
              src={staticFile(`pub/modeles/${m}.webp`)}
              style={{
                position: "absolute",
                left: 540 - 340 + x,
                top: 0,
                width: 680,
                borderRadius: 14,
                boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
                transform: `scale(${s})`,
                opacity: o,
                zIndex: 100 - Math.round(Math.abs(d) * 10),
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Subtitle = ({ text }: { text: string }) => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: "clamp", easing: ease });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 150 }}>
      <div
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: 58,
          lineHeight: 1.2,
          color: "#0f172a",
          background: "#fff",
          borderRadius: 26,
          padding: "20px 36px",
          maxWidth: 940,
          textAlign: "center",
          boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
          opacity: a,
          transform: `translateY(${(1 - a) * 20}px) scale(${0.94 + 0.06 * a})`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const EndCard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40, fontFamily }}>
      <Img src={staticFile("icon.svg")} style={{ width: 190, height: 190, borderRadius: 50, transform: `scale(${pop})` }} />
      <div style={{ fontWeight: 800, fontSize: 120, color: "#fff", letterSpacing: -2, opacity: pop }}>CVCasa</div>
      <div style={{ background: "#fff", color: BRAND, borderRadius: 999, padding: "26px 64px", fontWeight: 800, fontSize: 72, transform: `scale(${0.8 + 0.2 * pop})` }}>cvcasa.com</div>
      <div style={{ fontWeight: 700, fontSize: 46, color: "rgba(255,255,255,0.9)", marginTop: 10, opacity: interpolate(frame, [10, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        CV gratuit · Paiement Mobile Money
      </div>
    </AbsoluteFill>
  );
};

export const PubVideo = (p: PubProps) => {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  const voiceEnd = f(p.voiceSeconds);
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND }}>
      <Background />
      <Audio src={staticFile(p.voice)} />
      <Sequence durationInFrames={f(p.hookEnd)}>
        <Hook text={p.hook} />
      </Sequence>
      {p.parts.map((part, i) => (
        <Sequence key={i} from={f(part.start)} durationInFrames={f(part.end) - f(part.start)}>
          {part.kind === "clip" ? <ClipPart part={part} /> : part.kind === "image" ? <ImagePart part={part} /> : <TemplatesPart part={part} />}
        </Sequence>
      ))}
      {p.subtitles.map(([at, text], i) => {
        if (at < p.hookEnd - 0.05) return null;
        const next = i + 1 < p.subtitles.length ? p.subtitles[i + 1][0] : p.voiceSeconds;
        return (
          <Sequence key={`s${i}`} from={f(at)} durationInFrames={Math.max(1, f(next) - f(at))}>
            <Subtitle text={text} />
          </Sequence>
        );
      })}
      <Sequence from={voiceEnd}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};

export const PUB1: PubProps = {
  voice: "pub/vo1.mp3",
  voiceSeconds: 17.84,
  hook: "Tu passes tes soirées à chercher des offres ?",
  hookEnd: 3.4,
  subtitles: [
    [0, "Tu passes tes soirées à chercher des offres d'emploi ?"],
    [3.55, "Avec CVCasa,"],
    [5.25, "coche ton métier, ton contrat et ta ville."],
    [8.0, "Chaque matin,"],
    [9.0, "les nouvelles offres arrivent dans ta boîte mail."],
    [12.1, "Et en un clic,"],
    [14.2, "ton CV s'adapte à l'offre."],
    [16.05, "Laisse les offres venir à toi, sur cvcasa.com"],
  ],
  parts: [{ kind: "clip", src: "pub/p1-veille.mp4", clipSeconds: 17.67, start: 3.4, end: 17.84, label: "Ta veille emploi" }],
};

export const PUB2: PubProps = {
  voice: "pub/vo2.mp3",
  voiceSeconds: 15.49,
  hook: "Ton CV date de 2019 ?",
  hookEnd: 1.4,
  subtitles: [
    [0, "Ton CV date de 2019 ?"],
    [2.4, "Prends-le en photo, ou importe-le."],
    [4.8, "CVCasa le remet au propre, en quelques secondes."],
    [7.7, "Choisis parmi treize modèles professionnels,"],
    [9.85, "et télécharge ton PDF."],
    [11.45, "C'est gratuit."],
    [12.75, "Ton nouveau CV,"],
    [13.8, "sur cvcasa.com"],
  ],
  parts: [
    { kind: "image", src: "pub/ancien-cv.jpg", start: 1.4, end: 4.3, label: "Ton ancien CV…" },
    { kind: "clip", src: "pub/p2-import.mp4", clipSeconds: 9.83, start: 4.3, end: 7.7, label: "Importé en un instant" },
    { kind: "templates", start: 7.7, end: 15.49, label: "13 modèles pros" },
  ],
};

export const PUB3: PubProps = {
  voice: "pub/vo3.mp3",
  voiceSeconds: 18.6,
  hook: "10 CV envoyés, zéro réponse ?",
  hookEnd: 2.9,
  subtitles: [
    [0, "Dix CV envoyés,"],
    [1.6, "zéro réponse ?"],
    [3.45, "Colle l'annonce qui t'intéresse."],
    [5.4, "CVCasa adapte ton CV au poste, sans rien inventer,"],
    [9.5, "et te montre ton score."],
    [11.1, "Ta lettre de motivation est prête dans la foulée."],
    [14.05, "Postule avec le bon CV,"],
    [16.0, "à chaque fois,"],
    [17.0, "sur cvcasa.com"],
  ],
  parts: [
    { kind: "clip", src: "pub/p3-offre.mp4", clipSeconds: 19.37, start: 2.9, end: 11.1, label: "Ton CV adapté à l'offre" },
    { kind: "clip", src: "pub/p3-lettre.mp4", clipSeconds: 12.0, start: 11.1, end: 18.6, label: "Ta lettre, prête" },
  ],
};

export const PUB4: PubProps = {
  voice: "pub/vo4.mp3",
  voiceSeconds: 20.43,
  hook: "Tes amis cherchent du travail ?",
  hookEnd: 2.5,
  subtitles: [
    [0, "Tu as des amis qui cherchent du travail ?"],
    [2.5, "Aide-les,"],
    [3.25, "et gagne de l'argent."],
    [5.2, "Deviens ambassadeur CVCasa :"],
    [7.0, "tu signes ton contrat en ligne, en deux minutes."],
    [9.6, "Partage ton lien."],
    [10.65, "Tu gagnes 100 F au premier achat de chaque ami,"],
    [13.3, "puis 10 % de ses achats pendant un an."],
    [15.8, "Tes gains arrivent par Mobile Money."],
    [17.85, "Rejoins le programme,"],
    [19.0, "sur cvcasa.com"],
  ],
  parts: [
    { kind: "clip", src: "pub/p4-demande.mp4", clipSeconds: 27.18, trim: 9, start: 2.5, end: 9.6, label: "Ton contrat, signé en ligne" },
    { kind: "clip", src: "pub/p4-gains.mp4", clipSeconds: 13.15, start: 9.6, end: 20.43, label: "Tes gains, en direct" },
  ],
};
