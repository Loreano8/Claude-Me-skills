import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Target } from 'lucide-react';

// Accueil : un CV qui se transforme quand on fait défiler la page.
// 1. le parcours écrit en vrac, 2. le CV propre, 3. le CV adapté à une offre, avec le score qui monte.
// Rien que du texte et du CSS : léger sur un petit forfait, et ça marche au doigt sur téléphone.

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 avant `a`, 1 après `b`, transition douce entre les deux. */
const step = (p: number, a: number, b: number) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const NOTES = [
  'awa diallo, comptable',
  'master finance en 2020',
  'depuis 2021 compta dans une sté de transport',
  'déclarations fiscales, paie de 120 salariés',
  'retards de paiement réduits de 30 % !!',
  'excel, sage, anglais courant',
];

const STEPS = [
  { n: 1, title: 'Vous écrivez comme ça vient', text: 'En vrac, au clavier ou à la voix.' },
  { n: 2, title: 'Votre CV, propre et aux normes', text: 'Rangé, sans rien inventer.' },
  { n: 3, title: 'Adapté à l’offre, avec le score', text: 'Les mots de l’annonce, vos vrais atouts en premier.' },
];

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

/** Surligneur qui passe sur un mot-clé de l'offre. */
function Mark({ on, children }: { on: number; children: ReactNode }) {
  return (
    <span
      className="rounded-sm bg-no-repeat"
      style={{ backgroundImage: 'linear-gradient(#fde68a, #fde68a)', backgroundSize: `${on * 100}% 100%`, backgroundPosition: '0 0' }}
    >
      {children}
    </span>
  );
}

/** Le document lui-même, dessiné pour un état d'avancement p (0 à 1). */
function CvDocument({ p }: { p: number }) {
  const messy = 1 - step(p, 0.24, 0.4);
  const clean = step(p, 0.3, 0.44);
  const offer = step(p, 0.6, 0.7);
  const marks = step(p, 0.7, 0.84);
  const adapted = p > 0.7;
  const score = Math.round(54 + 32 * step(p, 0.7, 0.94));

  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      {/* L'offre arrive au-dessus du CV. */}
      <div
        className="absolute inset-x-3 -top-3 z-10 flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
        style={{ opacity: offer, transform: `translateY(${(1 - offer) * -24}px)` }}
        aria-hidden={offer < 0.5}
      >
        <Target className="size-4 shrink-0 text-amber-300" />
        <span className="min-w-0 flex-1 truncate">
          Offre : <strong>Responsable comptable</strong> · paie, déclarations fiscales
        </span>
      </div>

      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        {/* 1. Les notes en vrac */}
        <div className="absolute inset-0 bg-amber-50/60 p-5" style={{ opacity: messy }}>
          {NOTES.map((line, i) => (
            <p
              key={line}
              className="font-medium text-slate-700 italic"
              style={{
                marginTop: i ? 14 : 4,
                fontSize: 15,
                transform: `translate(${(i % 2 ? 10 : -4) * messy}px, ${(1 - messy) * -12}px) rotate(${(i % 3 === 0 ? -2.5 : i % 3 === 1 ? 1.8 : -1) * messy}deg)`,
              }}
            >
              {line}
            </p>
          ))}
        </div>

        {/* 2. et 3. Le CV propre, puis adapté */}
        <div className="absolute inset-0 flex flex-col p-5 text-left" style={{ opacity: clean, transform: `translateY(${(1 - clean) * 16}px)` }}>
          <div className="border-b-2 border-brand-600 pb-2">
            <p className="text-lg leading-tight font-bold text-slate-900">Awa Diallo</p>
            <p className="text-sm font-semibold text-brand-700">{adapted ? 'Responsable comptable' : 'Comptable'}</p>
          </div>
          <p className="mt-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase">Expérience</p>
          <p className="mt-0.5 text-[12px] font-semibold text-slate-800">Comptable · Société de transport</p>
          <p className="text-[10px] text-slate-500">Depuis 2021</p>
          <ul className="mt-1 space-y-0.5 text-[11.5px] text-slate-700">
            <li>
              • <Mark on={marks}>Déclarations fiscales</Mark> mensuelles
            </li>
            <li>
              • <Mark on={marks}>Paie</Mark> de 120 salariés
            </li>
            <li>• Retards de paiement réduits de 30 %</li>
          </ul>
          <p className="mt-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase">Formation</p>
          <p className="mt-0.5 text-[12px] text-slate-800">Master en finance · 2020</p>
          <p className="mt-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase">Compétences</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {['Excel', 'Sage', 'Anglais courant'].map((s) => (
              <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-700">
                {s}
              </span>
            ))}
          </div>

          {/* Le score, une fois l'offre arrivée */}
          <div className="mt-auto flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2" style={{ opacity: offer }}>
            <p className="text-[11px] font-semibold text-emerald-800">Compatibilité</p>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-emerald-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${score}%` }} />
            </div>
            <p className="text-sm font-bold text-emerald-700 tabular-nums">{score} %</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Steps({ active, style }: { active: number; style?: CSSProperties }) {
  return (
    <ol className="mx-auto mb-5 grid max-w-md grid-cols-3 gap-2 text-center" style={style}>
      {STEPS.map((s, i) => (
        <li key={s.n} className="transition-opacity duration-300" style={{ opacity: i === active ? 1 : 0.35 }}>
          <span className={`mx-auto flex size-7 items-center justify-center rounded-full text-sm font-bold ${i === active ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
            {s.n}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function CvStory() {
  const ref = useRef<HTMLElement>(null);
  const p = useScrollProgress(ref);
  const reduced = usePrefersReducedMotion();

  // Animations réduites : les trois étapes, posées l'une sous l'autre.
  if (reduced) {
    return (
      <section className="px-4 py-12" aria-label="Comment votre CV se transforme">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          {[0.1, 0.5, 1].map((at, i) => (
            <div key={at}>
              <p className="mb-6 text-center font-semibold text-slate-900">
                {STEPS[i].n}. {STEPS[i].title}
              </p>
              <CvDocument p={at} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const active = p < 0.36 ? 0 : p < 0.64 ? 1 : 2;
  const current = STEPS[active];
  return (
    <section ref={ref} className="relative h-[260vh]" aria-label="Comment votre CV se transforme">
      <div className="sticky top-14 flex h-[calc(100svh-3.5rem)] flex-col justify-center px-4">
        <Steps active={active} />
        <div className="mb-6 text-center">
          <p key={current.n} className="animate-[fadeIn_0.3s_ease-out] text-xl font-bold text-slate-900 sm:text-2xl">
            {current.title}
          </p>
          <p className="mt-1 text-sm text-slate-600">{current.text}</p>
        </div>
        <CvDocument p={p} />
        <p className="mt-6 text-center text-xs text-slate-400" style={{ opacity: 1 - step(p, 0.05, 0.15) }}>
          Faites défiler pour voir la suite
        </p>
      </div>
    </section>
  );
}
