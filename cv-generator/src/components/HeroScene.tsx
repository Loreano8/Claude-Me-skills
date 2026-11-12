import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { FileDown, FileText, Keyboard, Mic } from 'lucide-react';
import { cx } from './ui.tsx';

/**
 * Scène d'accueil : le parcours arrive (ancien CV importé, texte écrit, ou dicté au micro : une façon par boucle, dans
 * cet ordre), les passages utiles sont surlignés puis rejoignent une feuille de CV qui se remplit, déjà reformulés.
 * Le micro n'est qu'une des trois façons, pas la première montrée. Aucun nom réel : le CV porte « Votre nom ».
 * Tout est dessiné dans un espace fixe (W × H) mis à l'échelle : les trajets se calculent dans le même repère.
 */

const W = 420;
const H = 520;
// Boucle courte : les trois façons (ancien CV, écrit, micro) défilent en moins de 25 secondes.
const LOOP = 8;

// Le parcours, selon la façon de le donner ; les morceaux qui ont un `to` rejoignent le CV.
type Piece = { text: string; to?: number };
const SOURCES: { icon: typeof Mic; short: string; active: string; idle: string; pieces: Piece[] }[] = [
  {
    icon: FileText,
    short: 'Ancien CV',
    active: 'Lecture de ancien-cv.pdf…',
    idle: 'Ancien CV lu',
    pieces: [
      { text: 'CV 2019 – ' },
      { text: 'Comptable', to: 0 },
      { text: ', société de transport (2021 – ). Missions : ' },
      { text: 'la paie de 120 salariés', to: 1 },
      { text: ' ; ' },
      { text: 'réduit les retards de paiement de 30 %', to: 2 },
      { text: '. Diplôme : ' },
      { text: 'Master en finance', to: 3 },
      { text: '.' },
    ],
  },
  {
    icon: Keyboard,
    short: 'Écrit',
    active: 'Vous écrivez…',
    idle: 'Écrit',
    pieces: [
      { text: 'je suis ' },
      { text: 'comptable', to: 0 },
      { text: ' depuis 2021 dans une société de transport, je fais ' },
      { text: 'la paie de 120 salariés', to: 1 },
      { text: ', j’ai ' },
      { text: 'réduit les retards de paiement de 30 %', to: 2 },
      { text: '. avant : ' },
      { text: 'Master en finance', to: 3 },
    ],
  },
  {
    icon: Mic,
    short: 'Micro',
    active: 'Vous parlez…',
    idle: 'Noté',
    pieces: [
      { text: 'Bon… je suis ' },
      { text: 'comptable', to: 0 },
      { text: ' depuis 2021, dans une société de transport. Je gère ' },
      { text: 'la paie de 120 salariés', to: 1 },
      { text: ', et j’ai ' },
      { text: 'réduit les retards de paiement de 30 %', to: 2 },
      { text: '. Avant ça, un ' },
      { text: 'Master en finance', to: 3 },
      { text: '.' },
    ],
  },
];

// Où chaque passage atterrit sur la feuille (repère de la scène) et ce qu'il y devient.
const SHEET = { x: 104, y: 214, w: 300, h: 290 };
const LINES = [
  { x: SHEET.x + 60, y: SHEET.y + 40, text: 'Comptable', cls: 'text-[12px] font-semibold text-brand-700' },
  { x: SHEET.x + 26, y: SHEET.y + 114, text: 'Gérer la paie de 120 salariés', cls: 'text-[11.5px] text-slate-800' },
  { x: SHEET.x + 26, y: SHEET.y + 133, text: 'Réduire de 30 % les retards de paiement', cls: 'text-[11.5px] text-slate-800' },
  { x: SHEET.x + 16, y: SHEET.y + 182, text: 'Master en finance', cls: 'text-[11.5px] font-semibold text-slate-900' },
];

// Calendrier de la boucle, en secondes.
const T = {
  bubble: [0.1, 0.4],
  type: [0.4, 2.2],
  sheet: [1.8, 2.4],
  mark: (i: number) => [2.4 + i * 0.15, 2.7 + i * 0.15] as const,
  straighten: [3.0, 3.4],
  fly: (i: number) => [3.2 + i * 0.35, 3.9 + i * 0.35] as const,
  done: [5.0, 5.3],
  out: [7.4, 7.9],
};

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const prog = (t: number, [a, b]: readonly [number, number] | number[]) => clamp((t - a) / (b - a));
const ease = (p: number) => 1 - Math.pow(1 - p, 3);
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

type Box = { x: number; y: number; w: number; h: number };

export function HeroScene() {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const marks = useRef<(HTMLSpanElement | null)[]>([]);
  const [scale, setScale] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const t = elapsed % LOOP;
  const source = SOURCES[Math.floor(elapsed / LOOP) % SOURCES.length];
  const SPOKEN = source.pieces;
  const FULL = SPOKEN.map((p) => p.text).join('');
  const [from, setFrom] = useState<Box[]>([]);
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mise à l'échelle sur la largeur disponible.
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1.3, el.clientWidth / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Horloge de la boucle, arrêtée hors de l'écran (batterie) ; image finale fixe si les animations sont réduites.
  useEffect(() => {
    if (reduce) {
      setElapsed(6);
      return;
    }
    let raf = 0;
    let visible = true;
    let start = performance.now();
    let pausedAt = 0;
    const tick = (now: number) => {
      setElapsed(Math.max(0, (now - start) / 1000));
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !visible) {
        start += performance.now() - pausedAt;
        raf = requestAnimationFrame(tick);
      } else if (!e.isIntersecting && visible) {
        pausedAt = performance.now();
        cancelAnimationFrame(raf);
      }
      visible = e.isIntersecting;
    });
    if (host.current) io.observe(host.current);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [reduce]);

  // Position de départ des passages surlignés, mesurée une fois la phrase écrite (repère de la scène).
  const typed = Math.round(FULL.length * ease(prog(t, T.type)));
  const allTyped = typed >= FULL.length;
  useLayoutEffect(() => {
    if (!allTyped || from.length || !stage.current) return;
    const origin = stage.current.getBoundingClientRect();
    const k = origin.width / W;
    setFrom(
      marks.current.map((m) => {
        const r = m!.getBoundingClientRect();
        return { x: (r.left - origin.left) / k, y: (r.top - origin.top) / k, w: r.width / k, h: r.height / k };
      }),
    );
  }, [allTyped, from.length, scale]);
  useEffect(() => setFrom([]), [scale, source]);

  const fade = 1 - prog(t, T.out);
  const bubble = ease(prog(t, T.bubble));
  const sheet = ease(prog(t, T.sheet));
  const tilt = -3 * (1 - easeInOut(prog(t, T.straighten)));
  const done = ease(prog(t, T.done));
  const talking = t > T.type[0] && t < T.type[1] + 0.3;

  // La phrase, écrite jusqu'au caractère `typed`, avec ses passages surlignés.
  let pos = 0;
  const spoken = SPOKEN.map((s, i) => {
    const visible = s.text.slice(0, Math.max(0, typed - pos));
    pos += s.text.length;
    if (s.to === undefined) return <Fragment key={i}>{visible}</Fragment>;
    const m = ease(prog(t, T.mark(s.to)));
    return (
      <span
        key={i}
        ref={(el) => {
          marks.current[s.to!] = el;
        }}
        className="rounded-[3px] box-decoration-clone px-0.5"
        style={{ backgroundImage: 'linear-gradient(var(--color-sun-400), var(--color-sun-400))', backgroundRepeat: 'no-repeat', backgroundSize: `${m * 100}% 100%` }}
      >
        {visible}
      </span>
    );
  });

  return (
    <div>
      {/* Les trois façons de commencer, visibles d'un coup d'œil ; celle en cours est mise en avant. */}
      <ul className="mb-4 flex justify-center gap-2" aria-label="Trois façons de commencer">
        {SOURCES.map((s) => (
          <li
            key={s.short}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-300',
              s === source ? 'bg-sun-400 text-ink' : 'bg-white/10 text-white/75',
            )}
          >
            <s.icon className="size-4" aria-hidden="true" />
            {s.short}
          </li>
        ))}
      </ul>
    <div ref={host} className="relative w-full" style={{ height: H * scale }} aria-hidden="true">
      <div ref={stage} className="absolute top-0 left-1/2 origin-top" style={{ width: W, height: H, transform: `translateX(-50%) scale(${scale})`, opacity: fade }}>
        {/* La parole */}
        <div
          className="absolute top-0 left-0 w-[330px] rounded-2xl rounded-bl-md bg-white p-4 shadow-[0_18px_40px_-18px_rgba(16,26,74,0.55)]"
          style={{ opacity: bubble, transform: `translateY(${(1 - bubble) * 14}px)` }}
        >
          <div className="mb-2 flex items-center gap-2.5">
            <span className="relative flex size-9 items-center justify-center rounded-full bg-sun-400 text-ink">
              {talking && <span className="absolute inset-0 animate-ping rounded-full bg-sun-400/60" />}
              <source.icon className="relative size-4.5" />
            </span>
            <span className="flex h-6 items-center gap-[3px]" style={{ visibility: source.icon === Mic ? 'visible' : 'hidden' }}>
              {Array.from({ length: 16 }, (_, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-brand-600"
                  style={{ height: talking ? 5 + Math.abs(Math.sin(t * 7 + i * 0.9)) * 17 * (0.5 + Math.abs(Math.sin(i * 1.7)) / 2) : 4, opacity: talking ? 1 : 0.35 }}
                />
              ))}
            </span>
            <span className="ml-auto text-xs font-medium text-slate-500">{talking ? source.active : source.idle}</span>
          </div>
          <p className="min-h-[110px] text-[15px] leading-[1.55] text-slate-800">
            {spoken}
            {!allTyped && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-[3px] animate-pulse bg-slate-800" />}
          </p>
        </div>

        {/* La feuille de CV */}
        <div
          className="absolute rounded-md bg-white shadow-[0_24px_50px_-20px_rgba(16,26,74,0.6)] ring-1 ring-slate-200"
          style={{
            left: SHEET.x,
            top: SHEET.y,
            width: SHEET.w,
            height: SHEET.h,
            opacity: sheet,
            transform: `translateY(${(1 - sheet) * 30}px) rotate(${tilt}deg)`,
          }}
        >
          <div className="absolute top-4 left-4 size-9 rounded-full bg-slate-200" />
          <p className="absolute top-4 left-[60px] font-display text-[16px] leading-none font-bold text-ink">Votre nom</p>
          <div className="absolute top-[60px] right-4 left-4 h-px bg-slate-200" />
          <p className="absolute top-[74px] left-4 text-[10px] font-semibold text-brand-700">Expérience</p>
          <div className="absolute top-[90px] right-4 left-4 flex items-baseline justify-between" style={{ opacity: landed(t, 1) }}>
            <span className="text-[11.5px] font-semibold text-slate-900">Société de transport</span>
            <span className="text-[10px] whitespace-nowrap text-slate-500">depuis 2021</span>
          </div>
          {[114, 133].map((y, i) => (
            <span key={y} className="absolute left-[16px] size-[5px] rounded-full bg-brand-600" style={{ top: y + 6, opacity: landed(t, i + 1) }} />
          ))}
          <p className="absolute top-[160px] left-4 text-[10px] font-semibold text-brand-700">Formation</p>
          <p className="absolute top-[222px] left-4 text-[10px] font-semibold text-brand-700" style={{ opacity: done }}>
            Compétences
          </p>
          <div className="absolute top-[240px] left-4 flex gap-1.5" style={{ opacity: done }}>
            {['Excel', 'Sage', 'Paie', 'Fiscalité'].map((s) => (
              <span key={s} className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-800">
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Les lignes du CV, en place une fois le passage arrivé */}
        {LINES.map((l, i) => (
          <p key={l.text} className={`absolute whitespace-nowrap ${l.cls}`} style={{ left: l.x, top: l.y, opacity: landed(t, i) }}>
            {l.text}
          </p>
        ))}

        {/* Les passages en vol */}
        {from.length === LINES.length &&
          LINES.map((l, i) => {
            const p = prog(t, T.fly(i));
            if (p <= 0 || p >= 1) return null;
            const e = easeInOut(p);
            const a = from[i];
            const x = a.x + (l.x - a.x) * e;
            const y = a.y + (l.y - a.y) * e - Math.sin(Math.PI * e) * 70;
            const style: CSSProperties = { left: x, top: y, transform: `scale(${1 - 0.15 * e}) rotate(${Math.sin(Math.PI * e) * -4}deg)`, opacity: p > 0.85 ? (1 - p) / 0.15 : 1 };
            return (
              <span key={l.text} className="absolute origin-top-left rounded-[3px] bg-sun-400 px-1 text-[15px] leading-[1.55] whitespace-nowrap text-slate-900 shadow-lg" style={style}>
                {SPOKEN.find((s) => s.to === i)!.text}
              </span>
            );
          })}

        {/* Prêt */}
        <div
          className="absolute flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-xl"
          style={{ right: 0, top: SHEET.y + SHEET.h - 18, opacity: done, transform: `scale(${0.8 + 0.2 * done})` }}
        >
          <FileDown className="size-4 text-sun-400" /> PDF prêt à envoyer
        </div>
      </div>
    </div>
    </div>
  );
}

/** Une ligne du CV apparaît quand son passage a fini sa course. */
function landed(t: number, i: number): number {
  const [, end] = T.fly(i);
  return clamp((t - (end - 0.2)) / 0.3);
}
