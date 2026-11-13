import { useRef, useState } from 'react';
import { AlignLeft, ArrowDown, BellRing, Eye, Target, ArrowUp, Award, Briefcase, Camera, FileText, GraduationCap, Heart, Languages, ListChecks, Paperclip, PenLine, Plus, Trash2, Undo2, User, Wrench, X } from 'lucide-react';
import type { Attachment } from '../../shared/schema.ts';
import { settingsForLang, useActiveCv, useStore } from '../store.ts';
import type { Certification, CvDocument, Education, Experience, LanguageSkill } from '../types.ts';
import { api } from '../lib/api.ts';
import { applyAiContent, isCvEmpty, toAiContent, uid } from '../lib/cv.ts';
import { ACCEPTED_DOCS, fileToAttachment } from '../lib/files.ts';
import { PhotoInput } from '../components/PhotoInput.tsx';
import { NextSteps } from '../components/NextSteps.tsx';
import { appendSpoken, MicButton } from '../components/MicButton.tsx';
import { ReviseCard } from '../components/ReviseCard.tsx';
import { learnStyle, WriteLikeMe } from '../components/WriteLikeMe.tsx';
import { useWritingStyle } from '../lib/writingStyle.ts';
import { SignaturePad } from '../components/SignaturePad.tsx';
import { TagInput } from '../components/TagInput.tsx';
import { Button, Card, Cost, Field, Notice, Section, Select, TextArea, Toggle } from '../components/ui.tsx';

import { t } from '../i18n.ts';
type Update = (recipe: (cv: CvDocument) => CvDocument) => void;

// ---------------------------------------------------------------------------
// Saisie rapide avec l'IA

const QUICK_PLACEHOLDER = t('Écrivez tout comme ça vous vient, dans le désordre. Par exemple :\n\nPrénom Nom, comptable, tél. 01 00 00 00 00, prenom.nom@email.com.\nMaster en finance en 2020. Depuis 2021 comptable dans une société de transport : déclarations fiscales, paie de 120 salariés, j\'ai réduit les retards de paiement de 30 %. Avant : stage de 6 mois dans un cabinet d\'audit.\nExcel avancé, Sage. Français, anglais courant. J\'aime le basket et le bénévolat.');

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
      setStyleNote(problem ?? t('C’est noté : vos prochains CV et lettres reprendront votre façon d’écrire.'));
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
          setError(t('{0} documents maximum à la fois.', [MAX_QUICK_FILES]));
          return cur;
        }
        if (next.reduce((n, a) => n + a.data.length, 0) > MAX_QUICK_BYTES) {
          setError(t('Ces documents sont trop lourds ensemble. Envoyez-en moins à la fois.'));
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
      className="border-brand-100"
      tour="quickfill"
      title={
        <span className="flex items-center gap-2">
          <PenLine className="size-5 text-brand-600" /> {' '}{t('Saisie rapide')}</span>
      }
      subtitle={t('Partez de votre ancien CV ou de quelques lignes : CVCasa range tout et le met aux normes actuelles.')}
    >
      {/* Ordre voulu : l'ancien CV d'abord, puis l'écrit ; la dictée n'est qu'une aide pour écrire, pas le point de départ. */}
      <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-900">{t('Vous avez déjà un CV ?')}</p>
        <p className="mt-0.5 text-xs text-slate-500">{t('En PDF, en image, ou sur papier : prenez chaque page en photo, bien à plat et avec un bon éclairage ({0} documents maximum).', [MAX_QUICK_FILES])}</p>
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
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {files.map((f, i) => (
            <span key={i} className="inline-flex max-w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
              <Paperclip className="size-4 shrink-0 text-slate-500" />
              <span className="truncate">{f.mediaType.startsWith('image/') ? t('Page {0}', [i + 1]) : f.name}</span>
              <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} aria-label={t('Retirer ce document')} className="text-slate-400 hover:text-slate-700">
                <X className="size-4" />
              </button>
            </span>
          ))}
          {files.length < MAX_QUICK_FILES && (
            <>
              <Button data-tour="import" variant={files.length ? 'secondary' : 'primary'} icon={<Paperclip className="size-4" />} onClick={() => fileInput.current?.click()}>
                {files.length ? t('Ajouter un fichier') : t('Importer mon ancien CV')}
              </Button>
              <Button variant="secondary" icon={<Camera className="size-4" />} onClick={() => cameraInput.current?.click()}>
                {files.length ? t('Photographier une autre page') : t('Photographier mon CV papier')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <label htmlFor="quick-text" className="text-sm font-semibold text-slate-900">
          {files.length ? t('Quelque chose à ajouter ? (facultatif)') : t('Pas de CV ? Écrivez votre parcours en quelques lignes')}
        </label>
        <p className="mt-0.5 mb-2 text-xs text-slate-500">{t('Dans le désordre, sans phrases parfaites : vos études, vos emplois, ce que vous savez faire.')}</p>
        <TextArea id="quick-text" value={text} onChange={setText} rows={6} placeholder={QUICK_PLACEHOLDER} />
        <div className="mt-2" data-tour="mic">
          <MicButton
            onText={(t) => setText((cur) => appendSpoken(cur, t))}
            lang={cv.settings.headingLang}
            label={t('Dicter au lieu d’écrire')}
            hint={t('Facultatif : parlez, le texte s’écrit tout seul.')}
          />
        </div>
      </div>

      {hasContent && (
        <div className="mt-2">
          <Toggle
            label={t('Compléter mon CV actuel')}
            hint={merge ? t('Les nouvelles informations seront ajoutées à celles déjà saisies.') : t('Attention : le CV actuel sera remplacé.')}
            checked={merge}
            onChange={setMerge}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ai" data-tour="generate" icon={<FileText className="size-4" />} loading={busy === 'fill'} disabled={busy !== null || (!text.trim() && !files.length)} onClick={() => run('fill')}>
          {t('Générer mon CV')}{' '}<Cost />
        </Button>
        {hasContent && (
          <Button variant="secondary" icon={<PenLine className="size-4" />} loading={busy === 'improve'} disabled={busy !== null} onClick={() => run('improve')}>
            {t('Améliorer la rédaction')}{' '}<Cost />
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
            {t('Annuler')}</Button>
        )}
      </div>

      {busy && <p className="mt-3 text-sm text-brand-700">{t('Rédaction de votre CV… cela peut prendre jusqu’à une minute.')}</p>}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="mt-4 rounded-xl bg-white p-3 ring-1 ring-brand-100">
          <p className="mb-1.5 text-sm font-semibold text-slate-800">{t('C’est fait ! Vérifiez les informations ci-dessous. Nos conseils :')}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {suggestions.length > 0 && !cv.photo && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-brand-100">
          <Camera className="size-5 shrink-0 text-brand-600" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-slate-700">{t('Pas encore de photo sur votre CV (facultatif).')}</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const section = document.querySelector<HTMLElement>('[data-tour="photo"]');
              const toggle = section?.querySelector<HTMLButtonElement>('button[aria-expanded]');
              if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
              section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          >
            {t('Ajouter ma photo')}</Button>
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="mt-3">
          <NextSteps
            id="apres-cv"
            steps={[
              { icon: Eye, label: t('Voir et télécharger'), text: t('Votre CV en PDF, prêt à envoyer.'), tab: 'apercu' },
              { icon: Target, label: t('L’adapter à une offre'), text: t('Collez une annonce : le CV reprend ses mots-clés.'), tab: 'offre' },
              { icon: BellRing, label: t('Recevoir des offres'), text: t('La veille emploi vous envoie les annonces qui vous correspondent.'), tab: 'veille' },
            ]}
          />
        </div>
      )}
      {styleOffer && (
        <div className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-700 ring-1 ring-brand-100">
          <p>{t('Cet ancien CV, c’est vous qui l’avez écrit ? CVCasa peut retenir votre façon d’écrire pour vos prochains CV et lettres (gratuit).')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" icon={<PenLine className="size-4" />} loading={styleBusy} onClick={() => void keepStyle(styleOffer)}>
              {t('Oui, écrire comme moi')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setStyleOffer(null)}>
              {t('Non merci')}</Button>
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
        <Button variant="ghost" size="sm" aria-label={t('Monter')} disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" aria-label={t('Descendre')} disabled={index === count - 1} onClick={() => onMove(1)}>
          <ArrowDown className="size-4" />
        </Button>
        <Button variant="danger" size="sm" aria-label={t('Supprimer')} onClick={onDelete}>
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
    <Section title={t('Informations personnelles')} icon={<User className="size-5" />} defaultOpen tour="sections">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('Prénom')} value={p.firstName} onChange={set('firstName')} autoComplete="given-name" />
        <Field label={t('Nom')} value={p.lastName} onChange={set('lastName')} autoComplete="family-name" />
        <Field
          className="sm:col-span-2"
          label={t('Titre du CV (poste visé)')}
          value={p.title}
          onChange={set('title')}
          placeholder={t('Ex. Comptable confirmée, Développeur web, Assistante de direction')}
        />
        <Field label="E-mail" type="email" value={p.email} onChange={set('email')} autoComplete="email" />
        <Field label={t('Téléphone')} type="tel" value={p.phone} onChange={set('phone')} autoComplete="tel" hint={t('Avec l’indicatif du pays si vous postulez à l’étranger.')} />
        <Field className="sm:col-span-2" label={t('Adresse')} value={p.address} onChange={set('address')} placeholder={t('Quartier, rue (facultatif)')} />
        <Field label={t('Ville')} value={p.city} onChange={set('city')} />
        <Field label={t('Pays')} value={p.country} onChange={set('country')} />
        <Field label={t('Date de naissance')} value={p.birthDate} onChange={set('birthDate')} placeholder={t('JJ/MM/AAAA')} hint={t('Affichée seulement si vous l’activez dans l’aperçu.')} />
        <Field label={t('Nationalité')} value={p.nationality} onChange={set('nationality')} hint={t('Idem : à afficher si l’offre le demande.')} />
        <Field label={t('Permis de conduire')} value={p.drivingLicense} onChange={set('drivingLicense')} placeholder={t('Ex. Permis B')} />
        <Field label="LinkedIn" value={p.linkedin} onChange={set('linkedin')} placeholder={t('linkedin.com/in/votre-nom')} />
        <Field className="sm:col-span-2" label={t('Site web / portfolio')} value={p.website} onChange={set('website')} />
      </div>
    </Section>
  );
}

function PhotoSection({ cv, update }: { cv: CvDocument; update: Update }) {
  const setSettings = (patch: Partial<CvDocument['settings']>) => update((c) => ({ ...c, settings: { ...c.settings, ...patch } }));
  return (
    <Section tour="photo" title={t('Photo')} icon={<Camera className="size-5" />} badge={cv.photo ? count(1) : null}>
      <PhotoInput value={cv.photo} onChange={(photo) => update((c) => ({ ...c, photo }))} round={cv.settings.photoShape === 'round'} />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Toggle label={t('Afficher la photo sur le CV')} checked={cv.settings.showPhoto} onChange={(showPhoto) => setSettings({ showPhoto })} />
        <Select
          label={t('Forme')}
          value={cv.settings.photoShape}
          onChange={(photoShape) => setSettings({ photoShape })}
          options={[
            { value: 'round', label: t('Ronde') },
            { value: 'square', label: t('Carrée') },
          ]}
        />
      </div>
    </Section>
  );
}

function SummarySection({ cv, update }: { cv: CvDocument; update: Update }) {
  const n = cv.summary.length;
  return (
    <Section title={t('Profil / accroche')} icon={<AlignLeft className="size-5" />} badge={n ? count(1) : null}>
      <TextArea
        value={cv.summary}
        onChange={(summary) => update((c) => ({ ...c, summary }))}
        rows={4}
        placeholder={t('Ex. Comptable avec 5 ans d’expérience en entreprise de transport, spécialisée en fiscalité et en paie. Rigoureuse et autonome, je fiabilise les clôtures mensuelles et réduis les délais de paiement.')}
        hint={<span className={n > 650 ? 'text-amber-700' : ''}>{t('2 à 4 phrases : votre métier, votre expérience, ce que vous apportez. {0} caractères.', [n])}</span>}
      />
    </Section>
  );
}

function ExperienceSection({ cv, update }: { cv: CvDocument; update: Update }) {
  const ops = listOps(update, 'experiences');
  const blank = (): Experience => ({ id: uid(), position: '', company: '', location: '', startDate: '', endDate: '', current: false, achievements: '' });
  return (
    <Section title={t('Expériences professionnelles')} icon={<Briefcase className="size-5" />} badge={count(cv.experiences.length)}>
      <div className="space-y-3">
        {cv.experiences.map((e, i) => (
          <ItemShell
            key={e.id}
            title={e.position || e.company || t('Expérience {0}', [i + 1])}
            index={i}
            count={cv.experiences.length}
            onMove={(d) => ops.move(i, d)}
            onDelete={() => ops.remove(e.id)}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('Poste')} value={e.position} onChange={(position) => ops.patch(e.id, { position })} />
              <Field label={t('Entreprise / organisation')} value={e.company} onChange={(company) => ops.patch(e.id, { company })} />
              <Field label={t('Lieu')} value={e.location} onChange={(location) => ops.patch(e.id, { location })} />
              <div className="grid grid-cols-2 gap-2">
                <Field label={t('Début')} value={e.startDate} onChange={(startDate) => ops.patch(e.id, { startDate })} placeholder={t('MM/AAAA')} />
                {!e.current && <Field label={t('Fin')} value={e.endDate} onChange={(endDate) => ops.patch(e.id, { endDate })} placeholder={t('MM/AAAA')} />}
              </div>
              <div className="sm:col-span-2">
                <Toggle label={t('J’occupe ce poste actuellement')} checked={e.current} onChange={(current) => ops.patch(e.id, { current })} />
              </div>
              <TextArea
                className="sm:col-span-2"
                label={t('Réalisations (une par ligne)')}
                value={e.achievements}
                onChange={(achievements) => ops.patch(e.id, { achievements })}
                rows={4}
                placeholder={t('Gérer la paie de 120 salariés chaque mois\nRéduire de 30 % les retards de paiement fournisseurs')}
                hint={t('Une ligne = ce que vous avez fait, pour qui, et le résultat. Ex. « Former 20 nouveaux employés aux règles d’hygiène, sans aucun écart au contrôle ». 3 ou 4 lignes suffisent.')}
              />
            </div>
          </ItemShell>
        ))}
        <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => ops.add(blank())}>
          {t('Ajouter une expérience')}</Button>
      </div>
    </Section>
  );
}

function EducationSection({ cv, update }: { cv: CvDocument; update: Update }) {
  const ops = listOps(update, 'education');
  const blank = (): Education => ({ id: uid(), degree: '', school: '', location: '', startDate: '', endDate: '', details: '' });
  return (
    <Section title={t('Formation')} icon={<GraduationCap className="size-5" />} badge={count(cv.education.length)}>
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
              <Field label={t('Diplôme')} value={e.degree} onChange={(degree) => ops.patch(e.id, { degree })} placeholder={t('Ex. Master en finance')} />
              <Field label={t('École / université')} value={e.school} onChange={(school) => ops.patch(e.id, { school })} />
              <Field label={t('Lieu')} value={e.location} onChange={(location) => ops.patch(e.id, { location })} />
              <div className="grid grid-cols-2 gap-2">
                <Field label={t('Début')} value={e.startDate} onChange={(startDate) => ops.patch(e.id, { startDate })} placeholder={t('AAAA')} />
                <Field label={t('Fin')} value={e.endDate} onChange={(endDate) => ops.patch(e.id, { endDate })} placeholder={t('AAAA')} />
              </div>
              <Field
                className="sm:col-span-2"
                label={t('Précisions (facultatif)')}
                value={e.details}
                onChange={(details) => ops.patch(e.id, { details })}
                placeholder={t('Mention, spécialité, mémoire…')}
              />
            </div>
          </ItemShell>
        ))}
        <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => ops.add(blank())}>
          {t('Ajouter une formation')}</Button>
      </div>
    </Section>
  );
}

function SkillsSection({ cv, update }: { cv: CvDocument; update: Update }) {
  return (
    <Section title={t('Compétences')} icon={<Wrench className="size-5" />} badge={count(cv.skills.length + cv.softSkills.length)}>
      <div className="space-y-4">
        <TagInput
          label={t('Compétences techniques / métier')}
          values={cv.skills}
          onChange={(skills) => update((c) => ({ ...c, skills }))}
          placeholder={t('Ex. Excel avancé, Sage, Fiscalité… (Entrée pour ajouter)')}
          hint={t('Les mots-clés de votre métier : logiciels, techniques, normes.')}
        />
        <TagInput
          label={t('Qualités personnelles')}
          values={cv.softSkills}
          onChange={(softSkills) => update((c) => ({ ...c, softSkills }))}
          placeholder={t('Ex. Rigueur, Travail en équipe…')}
        />
      </div>
    </Section>
  );
}

// Ces niveaux s'écrivent dans le CV : ils suivent la langue du CV, pas celle de l'interface.
const LEVELS: Record<'fr' | 'en', string[]> = {
  fr: ['Langue maternelle', 'Bilingue', 'Courant (C1)', 'Avancé (B2)', 'Intermédiaire (B1)', 'Notions (A2)', 'Débutant (A1)'],
  en: ['Native', 'Bilingual', 'Fluent (C1)', 'Advanced (B2)', 'Intermediate (B1)', 'Basic (A2)', 'Beginner (A1)'],
};

function LanguagesSection({ cv, update }: { cv: CvDocument; update: Update }) {
  const ops = listOps(update, 'languages');
  return (
    <Section title={t('Langues')} icon={<Languages className="size-5" />} badge={count(cv.languages.length)}>
      <datalist id="language-levels">
        {LEVELS[cv.settings.headingLang].map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      <div className="space-y-2">
        {cv.languages.map((l: LanguageSkill) => (
          <div key={l.id} className="flex items-end gap-2">
            <Field className="flex-1" label={t('Langue')} value={l.name} onChange={(name) => ops.patch(l.id, { name })} />
            <Field className="flex-1" label={t('Niveau')} value={l.level} onChange={(level) => ops.patch(l.id, { level })} list="language-levels" />
            <Button variant="danger" size="sm" className="mb-1.5" aria-label={t('Supprimer')} onClick={() => ops.remove(l.id)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => ops.add({ id: uid(), name: '', level: '' })}>
          {t('Ajouter une langue')}</Button>
      </div>
    </Section>
  );
}

function CertificationsSection({ cv, update }: { cv: CvDocument; update: Update }) {
  const ops = listOps(update, 'certifications');
  return (
    <Section title={t('Certifications (facultatif)')} icon={<Award className="size-5" />} badge={count(cv.certifications.length)}>
      <div className="space-y-2">
        {cv.certifications.map((c: Certification) => (
          <div key={c.id} className="grid grid-cols-[1fr_auto] items-end gap-2 sm:grid-cols-[2fr_1.5fr_1fr_auto]">
            <Field label={t('Certification')} value={c.name} onChange={(name) => ops.patch(c.id, { name })} />
            <Field className="max-sm:order-3" label={t('Organisme')} value={c.issuer} onChange={(issuer) => ops.patch(c.id, { issuer })} />
            <Field className="max-sm:order-4" label={t('Année')} value={c.date} onChange={(date) => ops.patch(c.id, { date })} />
            <Button variant="danger" size="sm" className="mb-1.5 max-sm:order-2" aria-label={t('Supprimer')} onClick={() => ops.remove(c.id)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => ops.add({ id: uid(), name: '', issuer: '', date: '' })}>
          {t('Ajouter une certification')}</Button>
      </div>
    </Section>
  );
}

function InterestsSection({ cv, update }: { cv: CvDocument; update: Update }) {
  return (
    <Section title={t('Centres d’intérêt')} icon={<Heart className="size-5" />} badge={count(cv.interests.length)}>
      <TagInput
        label={t('Loisirs, engagements')}
        values={cv.interests}
        onChange={(interests) => update((c) => ({ ...c, interests }))}
        placeholder={t('Ex. Basket (club amateur), Bénévolat…')}
        hint={t('Restez précis : « Course à pied (semi-marathon) » dit plus que « Sport ».')}
      />
    </Section>
  );
}

function SignatureSection({ cv, update }: { cv: CvDocument; update: Update }) {
  const setSettings = (patch: Partial<CvDocument['settings']>) => update((c) => ({ ...c, settings: { ...c.settings, ...patch } }));
  return (
    <Section title={t('Signature')} icon={<PenLine className="size-5" />} badge={cv.signature ? count(1) : null}>
      <SignaturePad value={cv.signature} onChange={(signature) => update((c) => ({ ...c, signature }))} />
      <div className="mt-4 space-y-3">
        <Toggle
          label={t('Ajouter la signature au bas du CV')}
          hint={t('Utile pour certains concours et administrations. Elle est toujours proposée sur la lettre de motivation.')}
          checked={cv.settings.showSignature}
          onChange={(showSignature) => setSettings({ showSignature })}
        />
        {cv.settings.showSignature && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('Fait à')} value={cv.settings.signaturePlace} onChange={(signaturePlace) => setSettings({ signaturePlace })} placeholder={cv.personal.city || t('Ville')} />
            <Field label={t('Le')} value={cv.settings.signatureDate} onChange={(signatureDate) => setSettings({ signatureDate })} placeholder={t('JJ/MM/AAAA')} />
          </div>
        )}
      </div>
    </Section>
  );
}

export function EditorPage() {
  const cv = useActiveCv();
  const update = useStore((s) => s.updateCv);
  const empty = isCvEmpty(cv);
  const [manual, setManual] = useState(false);
  return (
    <div className="space-y-3">
      {cv.adaptation && (
        <Notice tone="info">
          {t('Vous modifiez la version adaptée à l’offre')}{' '}<strong>{[cv.adaptation.job.title, cv.adaptation.job.company].filter(Boolean).join(' – ')}</strong>{t('. Votre CV d’origine n’est pas modifié.')}</Notice>
      )}
      <QuickFill />
      {/* Tant que le CV est vide, une seule chose à faire : la saisie rapide. Le reste attend derrière un lien. */}
      {empty && !manual && (
        <button type="button" onClick={() => setManual(true)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-white">
          <ListChecks className="size-4" aria-hidden="true" /> {' '}{t('Je préfère remplir rubrique par rubrique')}</button>
      )}
      {(!empty || manual) && <EditorSections cv={cv} update={update} empty={empty} />}
    </div>
  );
}

function EditorSections({ cv, update, empty }: { cv: CvDocument; update: ReturnType<typeof useStore.getState>['updateCv']; empty: boolean }) {
  return (
    <>
      {!empty && <WriteLikeMe compact />}
      {!empty && <ReviseCard />}
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
    </>
  );
}
