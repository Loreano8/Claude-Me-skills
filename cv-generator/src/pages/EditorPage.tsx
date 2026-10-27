import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Award,
  Briefcase,
  Camera,
  GraduationCap,
  Heart,
  Languages,
  Paperclip,
  PenLine,
  Plus,
  Sparkles,
  Trash2,
  Undo2,
  User,
  Wand2,
  Wrench,
  X,
} from 'lucide-react';
import type { Attachment } from '../../shared/schema.ts';
import { settingsForLang, useActiveCv, useStore } from '../store.ts';
import type { Certification, CvDocument, Education, Experience, LanguageSkill } from '../types.ts';
import { api } from '../lib/api.ts';
import { applyAiContent, isCvEmpty, toAiContent, uid } from '../lib/cv.ts';
import { ACCEPTED_DOCS, fileToAttachment } from '../lib/files.ts';
import { PhotoInput } from '../components/PhotoInput.tsx';
import { appendSpoken, MicButton } from '../components/MicButton.tsx';
import { ReviseCard } from '../components/ReviseCard.tsx';
import { learnStyle, WriteLikeMe } from '../components/WriteLikeMe.tsx';
import { useWritingStyle } from '../lib/writingStyle.ts';
import { SignaturePad } from '../components/SignaturePad.tsx';
import { TagInput } from '../components/TagInput.tsx';
import { Button, Card, Field, Notice, Section, Select, TextArea, Toggle } from '../components/ui.tsx';

type Update = (recipe: (cv: CvDocument) => CvDocument) => void;

// ---------------------------------------------------------------------------
// Saisie rapide avec l'IA

const QUICK_PLACEHOLDER = `Écrivez tout comme ça vous vient, dans le désordre. Par exemple :

Awa Diallo, comptable, tél. 07 00 00 00 00, awa.diallo@email.com.
Master en finance en 2020. Depuis 2021 comptable dans une société de transport : déclarations fiscales, paie de 120 salariés, j'ai réduit les retards de paiement de 30 %. Avant : stage de 6 mois dans un cabinet d'audit.
Excel avancé, Sage. Français, anglais courant. J'aime le basket et le bénévolat.`;

const MAX_QUICK_FILES = 8;
/** Taille totale des documents (base64) : reste sous la limite d'envoi du serveur (15 Mo). */
const MAX_QUICK_BYTES = 13 * 1024 * 1024;

function QuickFill() {
  const cv = useActiveCv();
  const updateCv = useStore((s) => s.updateCv);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [merge, setMerge] = useState(true);
  const [busy, setBusy] = useState<'fill' | 'improve' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [undo, setUndo] = useState<CvDocument | null>(null);
  /** Ancien CV importé : proposé ensuite pour « Écrire comme moi », si aucun style n'est encore retenu. */
  const [styleOffer, setStyleOffer] = useState<Attachment[] | null>(null);
  const [styleBusy, setStyleBusy] = useState(false);
  const [styleNote, setStyleNote] = useState<string | null>(null);
  const hasStyle = useWritingStyle((s) => s.style !== null);
  const hasContent = !isCvEmpty(cv);

  async function keepStyle(docs: Attachment[]) {
    setStyleBusy(true);
    try {
      const problem = await learnStyle(docs, '');
      setStyleNote(problem ?? 'C’est noté : vos prochains CV et lettres reprendront votre façon d’écrire.');
      setStyleOffer(null);
    } catch (e) {
      setStyleNote((e as Error).message);
    } finally {
      setStyleBusy(false);
    }
  }

  async function run(mode: 'fill' | 'improve') {
    setBusy(mode);
    setError(null);
    try {
      const before = structuredClone(cv);
      const res = await api.structure({
        text: mode === 'fill' ? text : '',
        file: null,
        files: mode === 'fill' ? files : [],
        current: mode === 'improve' || (hasContent && merge) ? toAiContent(cv) : null,
        // Nouveau CV : l'IA le rédige dans la langue de la personne (anglais si elle parle anglais…).
        lang: hasContent ? cv.settings.headingLang : null,
      });
      updateCv((c) => {
        const next = applyAiContent(c, res.cv);
        return res.language && res.language !== c.settings.headingLang ? { ...next, settings: { ...next.settings, ...settingsForLang(res.language) } } : next;
      });
      setUndo(before);
      setSuggestions(res.suggestions);
      if (mode === 'fill') {
        if (files.length && !hasStyle) setStyleOffer(files);
        setText('');
        setFiles([]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    try {
      const added: Attachment[] = [];
      for (const f of Array.from(list)) {
        const { size: _size, ...att } = await fileToAttachment(f);
        added.push(att);
      }
      setFiles((cur) => {
        const next = [...cur, ...added];
        if (next.length > MAX_QUICK_FILES) {
          setError(`${MAX_QUICK_FILES} documents maximum à la fois.`);
          return cur;
        }
        if (next.reduce((n, a) => n + a.data.length, 0) > MAX_QUICK_BYTES) {
          setError('Ces documents sont trop lourds ensemble. Envoyez-en moins à la fois.');
          return cur;
        }
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card
      className="border-violet-200 bg-gradient-to-br from-violet-50 to-white"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-5 text-violet-600" /> Saisie rapide avec l’IA
        </span>
      }
      subtitle="Racontez votre parcours à voix haute, écrivez-le en vrac ou importez votre ancien CV : l’IA range tout et le rédige aux normes actuelles."
    >
      <div className="mb-3">
        <MicButton
          onText={(t) => setText((cur) => appendSpoken(cur, t))}
          lang={cv.settings.headingLang}
          label="Raconter mon parcours"
          hint="Parlez de vos études, vos emplois, vos compétences… dans le désordre."
        />
      </div>
      <TextArea value={text} onChange={setText} rows={6} placeholder={QUICK_PLACEHOLDER} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPTED_DOCS}
          className="hidden"
          onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {/* Ouvre directement l'appareil photo (téléphone) : ancien CV papier ou notes écrites à la main.
            Une photo par appui : on peut enchaîner les pages. */}
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {files.map((f, i) => (
          <span key={i} className="inline-flex max-w-full items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
            <Paperclip className="size-4 shrink-0 text-slate-500" />
            <span className="truncate">{f.mediaType.startsWith('image/') ? `Photo ${i + 1}` : f.name}</span>
            <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} aria-label="Retirer ce document" className="text-slate-400 hover:text-slate-700">
              <X className="size-4" />
            </button>
          </span>
        ))}
        {files.length < MAX_QUICK_FILES && (
          <>
            <Button variant="secondary" size="sm" icon={<Camera className="size-4" />} onClick={() => cameraInput.current?.click()}>
              {files.length ? 'Ajouter une photo' : 'Prendre en photo'}
            </Button>
            <Button variant="secondary" size="sm" icon={<Paperclip className="size-4" />} onClick={() => fileInput.current?.click()}>
              {files.length ? 'Ajouter un fichier' : 'Importer des fichiers (PDF ou images)'}
            </Button>
          </>
        )}
        <p className="w-full text-xs text-slate-500">
          Ancien CV papier ou parcours écrit à la main : prenez chaque page en photo, bien à plat et avec un bon éclairage ({MAX_QUICK_FILES} documents maximum).
        </p>
      </div>

      {hasContent && (
        <div className="mt-2">
          <Toggle
            label="Compléter mon CV actuel"
            hint={merge ? 'Les nouvelles informations seront ajoutées à celles déjà saisies.' : 'Attention : le CV actuel sera remplacé.'}
            checked={merge}
            onChange={setMerge}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ai" icon={<Wand2 className="size-4" />} loading={busy === 'fill'} disabled={busy !== null || (!text.trim() && !files.length)} onClick={() => run('fill')}>
          Générer mon CV
        </Button>
        {hasContent && (
          <Button variant="secondary" icon={<Sparkles className="size-4" />} loading={busy === 'improve'} disabled={busy !== null} onClick={() => run('improve')}>
            Améliorer la rédaction
          </Button>
        )}
        {undo && !busy && (
          <Button
            variant="ghost"
            icon={<Undo2 className="size-4" />}
            onClick={() => {
              updateCv(() => undo);
              setUndo(null);
              setSuggestions([]);
            }}
          >
            Annuler
          </Button>
        )}
      </div>

      {busy && <p className="mt-3 text-sm text-violet-700">L’IA travaille sur votre CV… cela peut prendre jusqu’à une minute.</p>}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="mt-4 rounded-xl bg-white p-3 ring-1 ring-violet-100">
          <p className="mb-1.5 text-sm font-semibold text-slate-800">C’est fait ! Vérifiez les informations ci-dessous. Conseils de l’IA :</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {styleOffer && (
        <div className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-700 ring-1 ring-brand-100">
          <p>Cet ancien CV, c’est vous qui l’avez écrit ? CV Studio peut retenir votre façon d’écrire pour vos prochains CV et lettres (gratuit).</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" icon={<PenLine className="size-4" />} loading={styleBusy} onClick={() => void keepStyle(styleOffer)}>
              Oui, écrire comme moi
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setStyleOffer(null)}>
              Non merci
            </Button>
          </div>
        </div>
      )}
      {styleNote && <p className="mt-3 text-sm text-brand-700">{styleNote}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sections du formulaire

function moveItem<T>(list: T[], index: number, delta: number): T[] {
  const next = [...list];
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function ItemShell({
  title,
  index,
  count,
  onMove,
  onDelete,
  children,
}: {
  title: string;
  index: number;
  count: number;
  onMove: (delta: number) => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-1">
        <p className="flex-1 truncate text-sm font-semibold text-slate-700">{title}</p>
        <Button variant="ghost" size="sm" aria-label="Monter" disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" aria-label="Descendre" disabled={index === count - 1} onClick={() => onMove(1)}>
          <ArrowDown className="size-4" />
        </Button>
        <Button variant="danger" size="sm" aria-label="Supprimer" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      {children}
    </div>
  );
}

function listOps<K extends 'experiences' | 'education' | 'languages' | 'certifications'>(update: Update, key: K) {
  type Item = CvDocument[K][number];
  return {
    patch: (id: string, patch: Partial<Item>) =>
      update((cv) => ({ ...cv, [key]: (cv[key] as Item[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    move: (index: number, delta: number) => update((cv) => ({ ...cv, [key]: moveItem(cv[key] as Item[], index, delta) })),
    remove: (id: string) => update((cv) => ({ ...cv, [key]: (cv[key] as Item[]).filter((x) => x.id !== id) })),
    add: (item: Item) => update((cv) => ({ ...cv, [key]: [...(cv[key] as Item[]), item] })),
  };
}

const count = (n: number) => (n > 0 ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{n}</span> : null);

function PersonalSection({ cv, update }: { cv: CvDocument; update: Update }) {
  const p = cv.personal;
  const set = (key: keyof typeof p) => (v: string) => update((c) => ({ ...c, personal: { ...c.personal, [key]: v } }));
  return (
    <Section title="Informations personnelles" icon={<User className="size-5" />} defaultOpen>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prénom" value={p.firstName} onChange={set('firstName')} autoComplete="given-name" />
        <Field label="Nom" value={p.lastName} onChange={set('lastName')} autoComplete="family-name" />
        <Field
          className="sm:col-span-2"
          label="Titre du CV (poste visé)"
          value={p.title}
          onChange={set('title')}
          placeholder="Ex. Comptable confirmée, Développeur web, Assistante de direction"
        />
        <Field label="E-mail" type="email" value={p.email} onChange={set('email')} autoComplete="email" />
        <Field label="Téléphone" type="tel" value={p.phone} onChange={set('phone')} autoComplete="tel" hint="Avec l’indicatif du pays si vous postulez à l’étranger." />
        <Field className="sm:col-span-2" label="Adresse" value={p.address} onChange={set('address')} placeholder="Quartier, rue (facultatif)" />
        <Field label="Ville" value={p.city} onChange={set('city')} />
        <Field label="Pays" value={p.country} onChange={set('country')} />
        <Field label="Date de naissance" value={p.birthDate} onChange={set('birthDate')} placeholder="JJ/MM/AAAA" hint="Affichée seulement si vous l’activez dans l’aperçu." />
        <Field label="Nationalité" value={p.nationality} onChange={set('nationality')} hint="Idem : à afficher si l’offre le demande." />
        <Field label="Permis de conduire" value={p.drivingLicense} onChange={set('drivingLicense')} placeholder="Ex. Permis B" />
        <Field label="LinkedIn" value={p.linkedin} onChange={set('linkedin')} placeholder="linkedin.com/in/votre-nom" />
        <Field className="sm:col-span-2" label="Site web / portfolio" value={p.website} onChange={set('website')} />
      </div>
    </Section>
  );
}

function PhotoSection({ cv, update }: { cv: CvDocument; update: Update }) {
  const setSettings = (patch: Partial<CvDocument['settings']>) => update((c) => ({ ...c, settings: { ...c.settings, ...patch } }));
  return (
    <Section title="Photo" icon={<Camera className="size-5" />} badge={cv.photo ? count(1) : null}>
      <PhotoInput value={cv.photo} onChange={(photo) => update((c) => ({ ...c, photo }))} round={cv.settings.photoShape === 'round'} />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Toggle label="Afficher la photo sur le CV" checked={cv.settings.showPhoto} onChange={(showPhoto) => setSettings({ showPhoto })} />
        <Select
          label="Forme"
          value={cv.settings.photoShape}
          onChange={(photoShape) => setSettings({ photoShape })}
          options={[
            { value: 'round', label: 'Ronde' },
            { value: 'square', label: 'Carrée' },
          ]}
        />
      </div>
    </Section>
  );
}

function SummarySection({ cv, update }: { cv: CvDocument; update: Update }) {
  const n = cv.summary.length;
  return (
    <Section title="Profil / accroche" icon={<Sparkles className="size-5" />} badge={n ? count(1) : null}>
      <TextArea
        value={cv.summary}
        onChange={(summary) => update((c) => ({ ...c, summary }))}
        rows={4}
        placeholder="Ex. Comptable avec 5 ans d’expérience en entreprise de transport, spécialisée en fiscalité et en paie. Rigoureuse et autonome, je fiabilise les clôtures mensuelles et réduis les délais de paiement."
        hint={<span className={n > 650 ? 'text-amber-700' : ''}>2 à 4 phrases : votre métier, votre expérience, ce que vous apportez. {n} caractères.</span>}
      />
    </Section>
  );
}

function ExperienceSection({ cv, update }: { cv: CvDocument; update: Update }) {
  const ops = listOps(update, 'experiences');
  const blank = (): Experience => ({ id: uid(), position: '', company: '', location: '', startDate: '', endDate: '', current: false, achievements: '' });
  return (
    <Section title="Expériences professionnelles" icon={<Briefcase className="size-5" />} badge={count(cv.experiences.length)}>
      <div className="space-y-3">
        {cv.experiences.map((e, i) => (
          <ItemShell
            key={e.id}
            title={e.position || e.company || `Expérience ${i + 1}`}
            index={i}
            count={cv.experiences.length}
            onMove={(d) => ops.move(i, d)}
            onDelete={() => ops.remove(e.id)}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Poste" value={e.position} onChange={(position) => ops.patch(e.id, { position })} />
              <Field label="Entreprise / organisation" value={e.company} onChange={(company) => ops.patch(e.id, { company })} />
              <Field label="Lieu" value={e.location} onChange={(location) => ops.patch(e.id, { location })} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Début" value={e.startDate} onChange={(startDate) => ops.patch(e.id, { startDate })} placeholder="MM/AAAA" />
                {!e.current && <Field label="Fin" value={e.endDate} onChange={(endDate) => ops.patch(e.id, { endDate })} placeholder="MM/AAAA" />}
              </div>
              <div className="sm:col-span-2">
                <Toggle label="J’occupe ce poste actuellement" checked={e.current} onChange={(current) => ops.patch(e.id, { current })} />
              </div>
              <TextArea
                className="sm:col-span-2"
                label="Réalisations (une par ligne)"
                value={e.achievements}
                onChange={(achievements) => ops.patch(e.id, { achievements })}
                rows={4}
                placeholder={'Gérer la paie de 120 salariés chaque mois\nRéduire de 30 % les retards de paiement fournisseurs'}
                hint="Commencez par un verbe d’action et chiffrez quand c’est possible."
              />
            </div>
          </ItemShell>
        ))}
        <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => ops.add(blank())}>
          Ajouter une expérience
        </Button>
      </div>
    </Section>
  );
}

function EducationSection({ cv, update }: { cv: CvDocument; update: Update }) {
  const ops = listOps(update, 'education');
  const blank = (): Education => ({ id: uid(), degree: '', school: '', location: '', startDate: '', endDate: '', details: '' });
  return (
    <Section title="Formation" icon={<GraduationCap className="size-5" />} badge={count(cv.education.length)}>
      <div className="space-y-3">
        {cv.education.map((e, i) => (
          <ItemShell
            key={e.id}
            title={e.degree || e.school || `Formation ${i + 1}`}
            index={i}
            count={cv.education.length}
            onMove={(d) => ops.move(i, d)}
            onDelete={() => ops.remove(e.id)}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Diplôme" value={e.degree} onChange={(degree) => ops.patch(e.id, { degree })} placeholder="Ex. Master en finance" />
              <Field label="École / université" value={e.school} onChange={(school) => ops.patch(e.id, { school })} />
              <Field label="Lieu" value={e.location} onChange={(location) => ops.patch(e.id, { location })} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Début" value={e.startDate} onChange={(startDate) => ops.patch(e.id, { startDate })} placeholder="AAAA" />
                <Field label="Fin" value={e.endDate} onChange={(endDate) => ops.patch(e.id, { endDate })} placeholder="AAAA" />
              </div>
              <Field
                className="sm:col-span-2"
                label="Précisions (facultatif)"
                value={e.details}
                onChange={(details) => ops.patch(e.id, { details })}
                placeholder="Mention, spécialité, mémoire…"
              />
            </div>
          </ItemShell>
        ))}
        <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => ops.add(blank())}>
          Ajouter une formation
        </Button>
      </div>
    </Section>
  );
}

function SkillsSection({ cv, update }: { cv: CvDocument; update: Update }) {
  return (
    <Section title="Compétences" icon={<Wrench className="size-5" />} badge={count(cv.skills.length + cv.softSkills.length)}>
      <div className="space-y-4">
        <TagInput
          label="Compétences techniques / métier"
          values={cv.skills}
          onChange={(skills) => update((c) => ({ ...c, skills }))}
          placeholder="Ex. Excel avancé, Sage, Fiscalité… (Entrée pour ajouter)"
          hint="Les mots-clés de votre métier : logiciels, techniques, normes."
        />
        <TagInput
          label="Qualités personnelles"
          values={cv.softSkills}
          onChange={(softSkills) => update((c) => ({ ...c, softSkills }))}
          placeholder="Ex. Rigueur, Travail en équipe…"
        />
      </div>
    </Section>
  );
}

const LEVELS = ['Langue maternelle', 'Bilingue', 'Courant (C1)', 'Avancé (B2)', 'Intermédiaire (B1)', 'Notions (A2)', 'Débutant (A1)'];

function LanguagesSection({ cv, update }: { cv: CvDocument; update: Update }) {
  const ops = listOps(update, 'languages');
  return (
    <Section title="Langues" icon={<Languages className="size-5" />} badge={count(cv.languages.length)}>
      <datalist id="language-levels">
        {LEVELS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      <div className="space-y-2">
        {cv.languages.map((l: LanguageSkill) => (
          <div key={l.id} className="flex items-end gap-2">
            <Field className="flex-1" label="Langue" value={l.name} onChange={(name) => ops.patch(l.id, { name })} />
            <Field className="flex-1" label="Niveau" value={l.level} onChange={(level) => ops.patch(l.id, { level })} list="language-levels" />
            <Button variant="danger" size="sm" className="mb-1.5" aria-label="Supprimer" onClick={() => ops.remove(l.id)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => ops.add({ id: uid(), name: '', level: '' })}>
          Ajouter une langue
        </Button>
      </div>
    </Section>
  );
}

function CertificationsSection({ cv, update }: { cv: CvDocument; update: Update }) {
  const ops = listOps(update, 'certifications');
  return (
    <Section title="Certifications (facultatif)" icon={<Award className="size-5" />} badge={count(cv.certifications.length)}>
      <div className="space-y-2">
        {cv.certifications.map((c: Certification) => (
          <div key={c.id} className="grid grid-cols-[1fr_auto] items-end gap-2 sm:grid-cols-[2fr_1.5fr_1fr_auto]">
            <Field label="Certification" value={c.name} onChange={(name) => ops.patch(c.id, { name })} />
            <Field className="max-sm:order-3" label="Organisme" value={c.issuer} onChange={(issuer) => ops.patch(c.id, { issuer })} />
            <Field className="max-sm:order-4" label="Année" value={c.date} onChange={(date) => ops.patch(c.id, { date })} />
            <Button variant="danger" size="sm" className="mb-1.5 max-sm:order-2" aria-label="Supprimer" onClick={() => ops.remove(c.id)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => ops.add({ id: uid(), name: '', issuer: '', date: '' })}>
          Ajouter une certification
        </Button>
      </div>
    </Section>
  );
}

function InterestsSection({ cv, update }: { cv: CvDocument; update: Update }) {
  return (
    <Section title="Centres d’intérêt" icon={<Heart className="size-5" />} badge={count(cv.interests.length)}>
      <TagInput
        label="Loisirs, engagements"
        values={cv.interests}
        onChange={(interests) => update((c) => ({ ...c, interests }))}
        placeholder="Ex. Basket (club amateur), Bénévolat…"
        hint="Restez précis : « Course à pied (semi-marathon) » dit plus que « Sport »."
      />
    </Section>
  );
}

function SignatureSection({ cv, update }: { cv: CvDocument; update: Update }) {
  const setSettings = (patch: Partial<CvDocument['settings']>) => update((c) => ({ ...c, settings: { ...c.settings, ...patch } }));
  return (
    <Section title="Signature" icon={<PenLine className="size-5" />} badge={cv.signature ? count(1) : null}>
      <SignaturePad value={cv.signature} onChange={(signature) => update((c) => ({ ...c, signature }))} />
      <div className="mt-4 space-y-3">
        <Toggle
          label="Ajouter la signature au bas du CV"
          hint="Utile pour certains concours et administrations. Elle est toujours proposée sur la lettre de motivation."
          checked={cv.settings.showSignature}
          onChange={(showSignature) => setSettings({ showSignature })}
        />
        {cv.settings.showSignature && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fait à" value={cv.settings.signaturePlace} onChange={(signaturePlace) => setSettings({ signaturePlace })} placeholder={cv.personal.city || 'Ville'} />
            <Field label="Le" value={cv.settings.signatureDate} onChange={(signatureDate) => setSettings({ signatureDate })} placeholder="JJ/MM/AAAA" />
          </div>
        )}
      </div>
    </Section>
  );
}

export function EditorPage() {
  const cv = useActiveCv();
  const update = useStore((s) => s.updateCv);
  return (
    <div className="space-y-3">
      {cv.adaptation && (
        <Notice tone="info">
          Vous modifiez la version adaptée à l’offre <strong>{[cv.adaptation.job.title, cv.adaptation.job.company].filter(Boolean).join(' – ')}</strong>. Votre CV d’origine n’est pas modifié.
        </Notice>
      )}
      <QuickFill />
      <WriteLikeMe compact />
      {!isCvEmpty(cv) && <ReviseCard />}
      <PersonalSection cv={cv} update={update} />
      <PhotoSection cv={cv} update={update} />
      <SummarySection cv={cv} update={update} />
      <ExperienceSection cv={cv} update={update} />
      <EducationSection cv={cv} update={update} />
      <SkillsSection cv={cv} update={update} />
      <LanguagesSection cv={cv} update={update} />
      <CertificationsSection cv={cv} update={update} />
      <InterestsSection cv={cv} update={update} />
      <SignatureSection cv={cv} update={update} />
    </div>
  );
}
