import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/fonts";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Tutoriel CVCasa (version 3 : import express, portfolio, synchronisation) filmé sur le site en version ordinateur : à gauche les étapes à suivre, à droite le site.
// Les clips (public/web3/w*.mp4) sont filmés par scripts/record-web3.cjs. Voix off : public/web/v*.mp3 (Fish Audio),
// découpée aux pauses pour que chaque phrase tombe sur l'étape qu'elle décrit.

const fontFamily = "Inter";
for (const weight of ["500", "700", "800"]) {
  loadFont({ family: fontFamily, url: staticFile(`fonts/inter-latin-${weight}-normal.woff2`), weight });
}

/** Durées des clips filmés (secondes), mesurées après le tournage. */
const CLIP = { w1: 19.07, w2: 13.4, w3: 21.83, w4: 22.8, w5: 19.77, w6: 25.17, w7: 30.6, w8: 14.83, w9: 12.57 };
/** Version anglaise (public/web3en, filmée avec TUTO_LANG=en). */
const CLIP_EN = { w1: 16.6, w2: 13.4, w3: 19.77, w4: 24.6, w5: 20, w6: 25.67, w7: 30.93, w8: 14.83, w9: 12.37 };

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

export const CHAPTERS_FR: Chapter[] = [
  {
    clip: "web3/w1-accueil.mp4", clipSeconds: CLIP.w1, seconds: 14.6, title: "Bienvenue",
    steps: [
      { at: 0, text: "Ouvrez cvcasa.com, sur ordinateur ou sur téléphone." },
      { at: 2.8, text: "CV, lettre, veille emploi et portfolio : tout au même endroit." },
      { at: 9.8, text: "Cliquez sur « Importer mon ancien CV »." },
    ],
    voice: [{ src: "web3/n1.mp3", at: 0.4 }],
  },
  {
    clip: "web3/w2-cv.mp4", clipSeconds: CLIP.w2, trim: 1, seconds: 10, title: "Créer votre CV",
    steps: [
      { at: 0, text: "Importez votre ancien CV : PDF, Word ou photo." },
      { at: 5.4, text: "Votre nouveau CV est prêt en quelques secondes." },
    ],
    voice: [{ src: "web3/n2.mp3", at: 0.3 }],
  },
  {
    clip: "web3/w3-modele.mp4", clipSeconds: CLIP.w3, trim: 1, seconds: 12, title: "Modèle et couleur",
    steps: [
      { at: 0, text: "« Changer de modèle ou de couleur » : cliquez sur un modèle." },
      { at: 6.6, text: "Téléchargez votre CV en PDF, gratuitement." },
    ],
    voice: [{ src: "web3/n3.mp3", at: 0.3 }],
  },
  {
    clip: "web3/w4-offre.mp4", clipSeconds: CLIP.w4, seconds: 14, title: "Adapter à une offre",
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
    clip: "web3/w5-lettre.mp4", clipSeconds: CLIP.w5, seconds: 12, title: "La lettre de motivation",
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
    clip: "web3/w6-veille.mp4", clipSeconds: CLIP.w6, seconds: 16, title: "La veille emploi",
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
    clip: "web3/w7-portfolio.mp4", clipSeconds: CLIP.w7, seconds: 17, title: "Votre portfolio en ligne",
    steps: [
      { at: 0, text: "Plus › « Mon portfolio en ligne » : déjà rempli avec votre CV." },
      { at: 5.6, text: "Choisissez un design, simple ou animé." },
      { at: 8.6, text: "Cliquez sur « Publier mon portfolio »." },
      { at: 11.0, text: "Un lien et un QR code à donner aux recruteurs." },
    ],
    voice: [{ src: "web3/n7.mp3", at: 0.3 }],
  },
  {
    clip: "web3/w8-suivi.mp4", clipSeconds: CLIP.w8, seconds: 10, title: "Le suivi",
    steps: [
      { at: 0, text: "Onglet « Suivi » : toutes vos candidatures au même endroit." },
      { at: 2.7, text: "Changez l’étape : envoyée, entretien, réponse." },
      { at: 5.3, text: "Notez les détails. Un rappel vous dit quand relancer." },
    ],
    voice: [{ src: "web2/v7.mp3", at: 0.3 }],
  },
  {
    clip: "web3/w9-partout.mp4", clipSeconds: CLIP.w9, seconds: 11.2, title: "Partout avec vous",
    steps: [
      { at: 0, text: "Même compte : votre travail sur le téléphone et sur le site." },
      { at: 6.2, text: "CV gratuit. Le reste en crédits, sans abonnement." },
    ],
    voice: [{ src: "web3/n9.mp3", at: 0.3 }],
  },
];

export const CHAPTERS_EN: Chapter[] = [
  {
    clip: "web3en/w1-accueil.mp4", clipSeconds: CLIP_EN.w1, seconds: 14.6, title: "Welcome",
    steps: [
      { at: 0, text: "Go to cvcasa.com, on a computer or on your phone." },
      { at: 2.9, text: "CV, letter, job alerts and portfolio: all in one place." },
      { at: 8.7, text: "Click “Import my old CV”." },
    ],
    voice: [{ src: "web3en/e1.mp3", at: 0.4 }],
  },
  {
    clip: "web3en/w2-cv.mp4", clipSeconds: CLIP_EN.w2, trim: 1, seconds: 10, title: "Create your CV",
    steps: [
      { at: 0, text: "Import your old CV: PDF, Word or a photo." },
      { at: 5.3, text: "Your new CV is ready in a few seconds." },
    ],
    voice: [{ src: "web3en/e2.mp3", at: 0.3 }],
  },
  {
    clip: "web3en/w3-modele.mp4", clipSeconds: CLIP_EN.w3, trim: 1, seconds: 12, title: "Template and colour",
    steps: [
      { at: 0, text: "“Change the template or colour”: click a template." },
      { at: 5.2, text: "Download your CV as a PDF, for free." },
    ],
    voice: [{ src: "web3en/e3.mp3", at: 0.3 }],
  },
  {
    clip: "web3en/w4-offre.mp4", clipSeconds: CLIP_EN.w4, seconds: 14, title: "Tailor it to a job",
    steps: [
      { at: 0, text: "“Job” tab: paste the ad (link, text or screenshot)." },
      { at: 3.1, text: "Click “Tailor my CV to the job”." },
      { at: 4.4, text: "One question if the ad is unclear." },
      { at: 7.8, text: "Your CV is tailored to the job. The score shows the gain." },
    ],
    voice: [
      { src: "web3en/e4a.mp3", at: 0.2 },
      { src: "web3en/e4b.mp3", at: 4.6 },
    ],
  },
  {
    clip: "web3en/w5-lettre.mp4", clipSeconds: CLIP_EN.w5, seconds: 12, title: "The cover letter",
    steps: [
      { at: 0, text: "“Letter” tab: click “Generate the letter”." },
      { at: 1.9, text: "Answer one or two questions." },
      { at: 6.9, text: "Your letter is ready. You can edit everything." },
    ],
    voice: [
      { src: "web3en/e5a.mp3", at: 1.4 },
      { src: "web3en/e5b.mp3", at: 6.9 },
    ],
  },
  {
    clip: "web3en/w6-veille.mp4", clipSeconds: CLIP_EN.w6, seconds: 16, title: "Job alerts",
    steps: [
      { at: 0, text: "“Job alerts”: tick your job, contracts and cities." },
      { at: 5.9, text: "Click “Search now”." },
      { at: 7.5, text: "The jobs arrive, with “Tailor my CV”." },
      { at: 11.9, text: "Choose “Every morning” and turn on your alerts." },
    ],
    voice: [
      { src: "web3en/e6a.mp3", at: 0.3 },
      { src: "web3en/e6b.mp3", at: 7.3 },
      { src: "web3en/e6c.mp3", at: 11.6 },
    ],
  },
  {
    clip: "web3en/w7-portfolio.mp4", clipSeconds: CLIP_EN.w7, seconds: 17.5, title: "Your online portfolio",
    steps: [
      { at: 0, text: "More › “My online portfolio”: already filled in with your CV." },
      { at: 8.8, text: "Choose a design, simple or animated." },
      { at: 11.4, text: "Click “Publish my portfolio”." },
      { at: 13.3, text: "A link and a QR code to give to recruiters." },
    ],
    voice: [{ src: "web3en/e7.mp3", at: 0.3 }],
  },
  {
    clip: "web3en/w8-suivi.mp4", clipSeconds: CLIP_EN.w8, seconds: 10, title: "Tracking",
    steps: [
      { at: 0, text: "“Applications”: all your applications in one place." },
      { at: 2.4, text: "Change the stage: sent, interview, reply." },
      { at: 5.0, text: "Add the details. A reminder tells you when to follow up." },
    ],
    voice: [{ src: "web3en/e8.mp3", at: 0.3 }],
  },
  {
    clip: "web3en/w9-partout.mp4", clipSeconds: CLIP_EN.w9, seconds: 11.6, title: "Everywhere with you",
    steps: [
      { at: 0, text: "Same account: your work on your phone and on the website." },
      { at: 6.2, text: "Free CV. The rest in credits, no subscription." },
    ],
    voice: [{ src: "web3en/e9n.mp3", at: 0.3 }],
  },
];

type Lang = "fr" | "en";
const COPY = {
  fr: { chapters: CHAPTERS_FR, tutorial: "Tutoriel", step: (i: number, n: number) => `Étape ${i} sur ${n}`, introTitle: "Comment ça marche", introText: "Votre CV, la lettre, les offres et votre portfolio, pas à pas", outroTitle: "À vous de jouer", outroText: "Votre CV est gratuit. Paiement Mobile Money pour le reste.", introVoice: "web2/v0.mp3", outroVoice: "web2/v9.mp3" },
  en: { chapters: CHAPTERS_EN, tutorial: "Tutorial", step: (i: number, n: number) => `Step ${i} of ${n}`, introTitle: "How it works", introText: "Your CV, letter, job offers and portfolio, step by step", outroTitle: "Your turn", outroText: "Your CV is free. Pay for the rest with Mobile Money.", introVoice: "web3en/e0.mp3", outroVoice: "web3en/eout.mp3" },
};

const startsOf = (CHAPTERS: Chapter[]) => CHAPTERS.reduce<number[]>((acc, c, i) => [...acc, i === 0 ? INTRO : acc[i - 1] + CHAPTERS[i - 1].seconds], []);
const totalOf = (CHAPTERS: Chapter[]) => { const st = startsOf(CHAPTERS); return st[st.length - 1] + CHAPTERS[CHAPTERS.length - 1].seconds + OUTRO; };
export const WEB_TUTORIAL3_SECONDS = totalOf(CHAPTERS_FR);
export const WEB_TUTORIAL3_EN_SECONDS = totalOf(CHAPTERS_EN);

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
const Steps = ({ chapter, index, lang }: { chapter: Chapter; index: number; lang: Lang }) => {
  const C = COPY[lang];
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
        <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 18, color: "rgba(255,255,255,0.7)" }}>{C.tutorial}</span>
      </div>
      <div style={{ marginTop: 56, opacity: enter, transform: `translateX(${(1 - enter) * -24}px)` }}>
        <div style={{ fontWeight: 700, fontSize: 22, color: "rgba(255,255,255,0.75)" }}>
          {C.step(index + 1, C.chapters.length)}
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
const Progress = ({ lang }: { lang: Lang }) => {
  const CHAPTERS = COPY[lang].chapters;
  const starts = startsOf(CHAPTERS);
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

const Intro = ({ lang }: { lang: Lang }) => {
  const C = COPY[lang];
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  const out = interpolate(frame, [INTRO * fps - 10, INTRO * fps], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 28, opacity: s * out, fontFamily, color: "#fff" }}>
      <Img src={staticFile("icon.svg")} style={{ width: 150, height: 150, transform: `scale(${interpolate(s, [0, 1], [0.85, 1])})` }} />
      <div style={{ fontWeight: 800, fontSize: 84, letterSpacing: -2 }}>{C.introTitle}</div>
      <div style={{ fontWeight: 500, fontSize: 38, color: "rgba(255,255,255,0.88)" }}>{C.introText}</div>
    </AbsoluteFill>
  );
};

const Outro = ({ lang }: { lang: Lang }) => {
  const C = COPY[lang];
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30, opacity: s, fontFamily, color: "#fff" }}>
      <Img src={staticFile("icon.svg")} style={{ width: 170, height: 170 }} />
      <div style={{ fontWeight: 800, fontSize: 80, letterSpacing: -2 }}>{C.outroTitle}</div>
      <div style={{ fontWeight: 500, fontSize: 38, color: "rgba(255,255,255,0.9)" }}>{C.outroText}</div>
      <div style={{ marginTop: 16, background: "#fff", color: BRAND, borderRadius: 999, padding: "20px 46px", fontWeight: 800, fontSize: 48 }}>cvcasa.com</div>
    </AbsoluteFill>
  );
};

export const WebTutorial3 = ({ lang = "fr" }: { lang?: Lang }) => {
  const { fps } = useVideoConfig();
  const C = COPY[lang];
  const CHAPTERS = C.chapters;
  const starts = startsOf(CHAPTERS);
  const total = totalOf(CHAPTERS);
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND }}>
      <Background />
      <Audio src={staticFile("music/tutoriel-fond.mp3")} volume={0.1} loop />
      <Sequence durationInFrames={Math.round(INTRO * fps)}>
        <Intro lang={lang} />
        <Sequence from={6} layout="none">
          <Audio src={staticFile(C.introVoice)} />
        </Sequence>
      </Sequence>
      {CHAPTERS.map((c, i) => (
        <Sequence key={c.clip} from={Math.round(starts[i] * fps)} durationInFrames={Math.round(c.seconds * fps)}>
          <Steps chapter={c} index={i} lang={lang} />
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
      <Sequence from={Math.round(INTRO * fps)} durationInFrames={Math.round((total - INTRO - OUTRO) * fps)}>
        <Progress lang={lang} />
      </Sequence>
      <Sequence from={Math.round((total - OUTRO) * fps)}>
        <Outro lang={lang} />
        <Sequence from={10} layout="none">
          <Audio src={staticFile(C.outroVoice)} />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};
