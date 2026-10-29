import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Target } from 'lucide-react';

// Accueil : le CV se construit sous les yeux quand on fait défiler la page.
// 1. des notes griffonnées en vrac ; 2. chaque ligne glisse à sa place dans un CV propre ;
// 3. l'offre arrive, les mots-clés se surlignent, la compatibilité monte et le CV est « prêt à envoyer ».
// Rien que du texte et du CSS : léger sur un petit forfait, et ça marche au doigt sur téléphone.

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 avant `a`, 1 après `b`, transition douce entre les deux. */
const step = (p: number, a: number, b: number) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Le CV est dessiné dans une boîte de 340 × 453 (format A4), agrandie sur grand écran. */
const W = 340;
const H = 453;

const STEPS = [
  { title: 'Vous écrivez comme ça vient', text: 'En vrac, au clavier ou à la voix, sans vous soucier de la mise en forme.' },
  { title: 'Chaque ligne trouve sa place', text: 'Un CV propre et aux normes des recruteurs, avec vos vraies expériences.' },
  { title: 'Adapté à l’offre, avec le score', text: 'Les mots de l’annonce, vos vrais atouts en premier, et la compatibilité qui grimpe.' },
];

/** Une ligne de notes : sa position griffonnée, sa place dans le CV, et ses deux écritures. */
interface Line {
  from: { x: number; y: number; r: number };
  to: { x: number; y: number };
  messy: string;
  clean: (adapted: number, marks: number) => ReactNode;
}

function Mark({ on, children }: { on: number; children: ReactNode }) {
  return (
    <span className="rounded-sm bg-no-repeat" style={{ backgroundImage: 'linear-gradient(#fde68a, #fde68a)', backgroundSize: `${on * 100}% 100%` }}>
      {children}
    </span>
  );
}

const Label = ({ children }: { children: ReactNode }) => <p className="text-[9.5px] font-bold tracking-wider text-slate-500 uppercase">{children}</p>;

const LINES: Line[] = [
  {
    from: { x: 22, y: 26, r: -2.5 },
    to: { x: 22, y: 20 },
    messy: 'awa diallo, comptable',
    clean: (adapted) => (
      <div>
        <p className="text-[19px] leading-tight font-bold text-slate-900">Awa Diallo</p>
        <p className="relative h-4 text-[12.5px] font-semibold text-brand-700">
          <span className="absolute inset-0" style={{ opacity: 1 - adapted }}>
            Comptable
          </span>
          <span className="absolute inset-0 whitespace-nowrap" style={{ opacity: adapted, transform: `translateY(${(1 - adapted) * 6}px)` }}>
            Responsable comptable
          </span>
        </p>
      </div>
    ),
  },
  {
    from: { x: 40, y: 66, r: 1.8 },
    to: { x: 22, y: 230 },
    messy: 'master finance en 2020',
    clean: () => <p className="text-[11.5px] text-slate-800">Master en finance · 2020</p>,
  },
  {
    from: { x: 16, y: 104, r: -1 },
    to: { x: 22, y: 96 },
    messy: 'depuis 2021 compta dans une sté de transport',
    clean: () => (
      <div>
        <p className="text-[11.5px] font-semibold text-slate-800">Comptable · Société de transport</p>
        <p className="text-[9.5px] text-slate-500">Depuis 2021</p>
      </div>
    ),
  },
  {
    from: { x: 30, y: 166, r: 1.5 },
    to: { x: 22, y: 128 },
    messy: 'déclarations fiscales, paie de 120 salariés',
    clean: (_a, marks) => (
      <div className="space-y-0.5 text-[11px] text-slate-700">
        <p>
          • <Mark on={marks}>Déclarations fiscales</Mark> mensuelles
        </p>
        <p>
          • <Mark on={marks}>Paie</Mark> de 120 salariés
        </p>
      </div>
    ),
  },
  {
    from: { x: 18, y: 222, r: -1.8 },
    to: { x: 22, y: 162 },
    messy: 'retards de paiement réduits de 30 % !!',
    clean: () => <p className="text-[11px] text-slate-700">• Retards de paiement réduits de 30 %</p>,
  },
  {
    from: { x: 36, y: 272, r: 1.2 },
    to: { x: 22, y: 280 },
    messy: 'excel, sage, anglais courant',
    clean: (_a, marks) => (
      <div className="flex gap-1">
        {['Excel', 'Sage', 'Anglais courant'].map((s, i) => (
          <span key={s} className="rounded px-1.5 py-0.5 text-[10px] text-slate-700" style={{ background: i === 1 ? `rgba(253,230,138,${marks})` : '#f1f5f9' }}>
            {s}
          </span>
        ))}
      </div>
    ),
  },
];

/** Jauge circulaire de compatibilité. */
function Ring({ value, size = 64 }: { value: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#d1fae5" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#10b981"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" className="fill-emerald-700 text-[15px] font-bold">
        {value} %
      </text>
    </svg>
  );
}

/** Le document, dessiné pour un avancement p (0 à 1). */
function CvCanvas({ p }: { p: number }) {
  const paper = step(p, 0.2, 0.4);
  const labels = step(p, 0.36, 0.46);
  const offer = step(p, 0.58, 0.68);
  const adapted = step(p, 0.68, 0.74);
  const marks = step(p, 0.7, 0.82);
  const score = Math.round(54 + 32 * step(p, 0.72, 0.92));
  const gain = step(p, 0.9, 0.95);
  const stamp = step(p, 0.94, 0.98);

  return (
    <div className="relative" style={{ width: W, height: H }}>
      {/* L'offre arrive au-dessus du CV. */}
      <div
        className="absolute inset-x-3 -top-4 z-20 flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-xl"
        style={{ opacity: offer, transform: `translateY(${(1 - offer) * -28}px) rotate(${(1 - offer) * -2}deg)` }}
        aria-hidden={offer < 0.5}
      >
        <Target className="size-4 shrink-0 text-amber-300" />
        <span className="min-w-0 flex-1 truncate">
          Offre : <strong>Responsable comptable</strong> · paie, déclarations fiscales, Sage
        </span>
      </div>

      <div
        className="absolute inset-0 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-slate-200"
        style={{ background: `rgb(${mix(255, 255, paper)}, ${mix(251, 255, paper)}, ${mix(235, 255, paper)})` }}
      >
        {/* Lignes de cahier, qui s'effacent quand le CV se range. */}
        <div
          className="absolute inset-0"
          style={{ opacity: 1 - paper, backgroundImage: 'repeating-linear-gradient(transparent 0 37px, #fcd9a8 37px 38px)', backgroundPosition: '0 18px' }}
        />
        {/* Trait sous le nom et titres de rubriques. */}
        <div className="absolute top-[64px] left-[22px] h-[2px] bg-brand-600" style={{ width: (W - 44) * labels }} />
        <div className="absolute top-[78px] left-[22px]" style={{ opacity: labels }}>
          <Label>Expérience</Label>
        </div>
        <div className="absolute top-[212px] left-[22px]" style={{ opacity: labels }}>
          <Label>Formation</Label>
        </div>
        <div className="absolute top-[262px] left-[22px]" style={{ opacity: labels }}>
          <Label>Compétences</Label>
        </div>

        {/* Chaque ligne glisse de la note griffonnée à sa place dans le CV. */}
        {LINES.map((line, i) => {
          const t = step(p, 0.17 + i * 0.03, 0.34 + i * 0.03);
          const swap = step(t, 0.35, 0.75);
          const style: CSSProperties = {
            transform: `translate(${mix(line.from.x, line.to.x, t)}px, ${mix(line.from.y, line.to.y, t)}px) rotate(${line.from.r * (1 - t)}deg)`,
          };
          return (
            <div key={line.messy} className="absolute top-0 left-0 w-[296px]" style={style}>
              <p className="absolute font-medium text-slate-700 italic" style={{ opacity: 1 - swap, fontSize: 15, fontFamily: 'ui-serif, Georgia, serif' }}>
                {line.messy}
              </p>
              <div style={{ opacity: swap }}>{line.clean(adapted, marks)}</div>
            </div>
          );
        })}

        {/* La compatibilité avec l'offre, avant → après. */}
        <div className="absolute inset-x-[22px] bottom-[20px] flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2" style={{ opacity: offer }}>
          <Ring value={score} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-emerald-900">Compatibilité avec l’offre</p>
            <p className="text-[11px] text-emerald-800">Avant : 54 %</p>
          </div>
          <span
            className="rounded-full bg-emerald-600 px-2 py-0.5 text-[12px] font-bold text-white"
            style={{ opacity: gain, transform: `scale(${mix(0.6, 1, gain)})` }}
          >
            +32
          </span>
        </div>
      </div>

      {/* Le tampon final. */}
      <div
        className="pointer-events-none absolute top-[318px] right-[26px] z-20 rounded-lg border-[3px] border-emerald-600 px-3 py-1 text-[15px] font-extrabold tracking-wide text-emerald-600 uppercase"
        style={{ opacity: stamp, transform: `rotate(-12deg) scale(${mix(1.6, 1, stamp)})`, background: 'rgba(255,255,255,0.85)' }}
        aria-hidden={stamp < 0.5}
      >
        Prêt à envoyer
      </div>
    </div>
  );
}

/** Agrandit le dessin selon la place disponible (plus grand sur ordinateur, plus petit sur très petit téléphone). */
function useCanvasScale(): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w >= 1024) setScale(Math.min(1.4, (h - 150) / H));
      else setScale(Math.min(1, (w - 32) / W, (h - 300) / H));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return Math.max(0.6, scale);
}

function useScrollProgress(ref: React.RefObject<HTMLElement | null>): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const run = rect.height - window.innerHeight;
      setP(run > 0 ? clamp(-rect.top / run) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);
  return p;
}

function usePrefersReducedMotion(): boolean {
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  return reduced;
}

function Scaled({ scale, children }: { scale: number; children: ReactNode }) {
  return (
    <div style={{ width: W * scale, height: H * scale }} className="mx-auto">
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  );
}

export function CvStory() {
  const ref = useRef<HTMLElement>(null);
  const p = useScrollProgress(ref);
  const reduced = usePrefersReducedMotion();
  const scale = useCanvasScale();

  // Animations réduites : le CV terminé, avec les trois étapes à côté.
  if (reduced) {
    return (
      <section className="px-4 py-12" aria-label="Comment votre CV se construit">
        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
          <ol className="space-y-5">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <p className="font-bold text-slate-900">
                  {i + 1}. {s.title}
                </p>
                <p className="text-sm text-slate-600">{s.text}</p>
              </li>
            ))}
          </ol>
          <Scaled scale={Math.min(scale, 1)}>
            <CvCanvas p={1} />
          </Scaled>
        </div>
      </section>
    );
  }

  const active = p < 0.36 ? 0 : p < 0.62 ? 1 : 2;
  return (
    <section ref={ref} className="relative h-[320vh]" aria-label="Comment votre CV se construit">
      <div className="sticky top-14 flex h-[calc(100svh-3.5rem-4rem)] items-center px-4 lg:h-[calc(100svh-3.5rem)]">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-6 lg:grid-cols-[1fr_auto] lg:gap-16">
          {/* Les étapes : en liste sur ordinateur, l'étape en cours seulement sur téléphone. */}
          <div>
            <ol className="hidden space-y-6 lg:block">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4 transition-opacity duration-300" style={{ opacity: i === active ? 1 : 0.35 }}>
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-bold transition-colors ${i <= active ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-slate-900">{s.title}</p>
                    <p className="mt-1 text-slate-600">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="text-center lg:hidden">
              <div className="mb-3 flex justify-center gap-2">
                {STEPS.map((s, i) => (
                  <span key={s.title} className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-8 bg-brand-600' : 'w-4 bg-slate-300'}`} />
                ))}
              </div>
              <p key={active} className="animate-[fadeIn_0.3s_ease-out] text-xl font-bold text-slate-900">
                {STEPS[active].title}
              </p>
              <p className="mt-1 text-sm text-slate-600">{STEPS[active].text}</p>
            </div>
          </div>
          <div className="pt-4">
            <Scaled scale={scale}>
              <CvCanvas p={p} />
            </Scaled>
            <p className="mt-4 text-center text-xs text-slate-400" style={{ opacity: 1 - step(p, 0.05, 0.15) }}>
              Faites défiler pour voir votre CV se construire
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
