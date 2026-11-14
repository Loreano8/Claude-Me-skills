import type { ReactNode } from 'react';
import type { CvDocument } from '../../types.ts';
import { achievementsList, fullName } from '../../lib/cv.ts';
import { LABELS, type Labels } from '../labels.ts';
import { orderMain } from '../order.ts';
import { Photo, SignatureBlock, FreeMark } from '../parts.tsx';
import { FONT, SERIF, contactItems, dateRange, tint } from '../theme.ts';
import { Page, Text, View } from '../fit.tsx';
import { BulletList, Certifications, Dots, MainColumn, SideColumn, doc, languageLevel, type Theme } from './Premium.tsx';

/**
 * Série « épurée » : beaucoup d'espace, des filets fins, très peu de couleur.
 * - gratuit : Clarté ;
 * - Pro : Épure, Ligne, Nord, Pastel.
 */
export type PureId = 'clarte' | 'epure' | 'ligne' | 'nord' | 'pastel';

const hasPhoto = (cv: CvDocument) => cv.settings.showPhoto && !!cv.photo;
const withoutContact = (cv: CvDocument): CvDocument => ({
  ...cv,
  personal: { ...cv.personal, email: '', phone: '', address: '', city: '', country: '', linkedin: '', website: '', drivingLicense: '', birthDate: '' },
  settings: { ...cv.settings, showNationality: false, showBirthDate: false },
});

/** Compétences, langues (en points) et centres d'intérêt côte à côte, sans cadre. */
function BottomColumns({ cv, L, accent, title }: { cv: CvDocument; L: Labels; accent: string; title: (t: string) => ReactNode }) {
  const cols: { key: string; node: ReactNode }[] = [];
  if (cv.skills.length) cols.push({ key: 'skills', node: <>{title(L.skills)}{cv.skills.map((s, i) => <Text key={i} style={{ fontSize: 8.8, marginBottom: 2.5 }}>{s}</Text>)}</> });
  if (cv.languages.length)
    cols.push({
      key: 'lang',
      node: (
        <>
          {title(L.languages)}
          {cv.languages.map((l) => (
            <View key={l.id} style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 8.8 }}>{l.name}{!languageLevel(l.level) && l.level ? ` · ${l.level}` : ''}</Text>
              <Dots value={languageLevel(l.level)} on={accent} off={tint(accent, 0.8)} size={5} />
            </View>
          ))}
        </>
      ),
    });
  if (cv.softSkills.length || cv.interests.length)
    cols.push({
      key: 'more',
      node: (
        <>
          {cv.softSkills.length ? <>{title(L.softSkills)}<Text style={{ fontSize: 8.8, marginBottom: 6 }}>{cv.softSkills.join(' · ')}</Text></> : null}
          {cv.interests.length ? <>{title(L.interests)}<Text style={{ fontSize: 8.8 }}>{cv.interests.join(' · ')}</Text></> : null}
        </>
      ),
    });
  if (!cols.length) return null;
  return (
    <View wrap={false} style={{ flexDirection: 'row', marginTop: 4 }}>
      {cols.map((c, i) => (
        <View key={c.key} style={{ flex: 1, paddingLeft: i ? 16 : 0 }}>
          {c.node}
        </View>
      ))}
    </View>
  );
}

/** Clarté (gratuit) : fine barre de couleur en haut, titres suivis d'un filet, frise des expériences. */
function Clarte({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const contacts = contactItems(cv, L);
  const th: Theme = {
    accent,
    text: '#1f2937',
    muted: '#6b7280',
    head: FONT,
    timeline: true,
    heading: (title) => (
      <View minPresenceAhead={40} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 15, marginBottom: 8 }}>
        <Text style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: '#111827' }}>{title}</Text>
        <View style={{ flex: 1, height: 0.7, backgroundColor: '#d1d5db', marginLeft: 10 }} />
      </View>
    ),
  };
  const small = (title: string) => <Text style={{ fontSize: 8.6, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: accent, marginBottom: 5, marginTop: 12 }}>{title}</Text>;
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.42, paddingTop: 42, paddingBottom: 34, paddingHorizontal: 46, color: '#1f2937' }}>
      <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: accent }} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {hasPhoto(cv) ? <View style={{ marginRight: 16 }}><Photo cv={cv} size={72} /></View> : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: 700, color: accent, lineHeight: 1.15 }}>{fullName(cv.personal) || ' '}</Text>
          {cv.personal.title ? <Text style={{ fontSize: 11.5, fontWeight: 500, color: '#374151', marginTop: 2 }}>{cv.personal.title}</Text> : null}
          {contacts.length ? <Text style={{ fontSize: 8.5, color: '#6b7280', marginTop: 6 }}>{contacts.map((c) => c.value).join('   ·   ')}</Text> : null}
        </View>
      </View>
      <MainColumn cv={cv} L={L} th={th} />
      <Certifications cv={cv} L={L} th={th} />
      <BottomColumns cv={cv} L={L} accent={accent} title={small} />
      <SignatureBlock cv={cv} L={L} />
      <FreeMark cv={cv} />
    </Page>,
  );
}

/** Épure (Pro) : nom en grand et en maigre, dates dans une colonne, filets très fins. Le plus minimal. */
function Epure({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const contacts = contactItems(cv, L);
  const D = 98;
  const heading = (title: string) => (
    <View minPresenceAhead={40} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 9 }}>
      <View style={{ width: 16, height: 1.5, backgroundColor: accent, marginRight: 8 }} />
      <Text style={{ fontSize: 8.4, fontWeight: 600, letterSpacing: 2.4, textTransform: 'uppercase', color: '#52525b' }}>{title}</Text>
    </View>
  );
  const row = (key: string, dates: string, body: ReactNode) => (
    <View key={key} style={{ flexDirection: 'row', marginBottom: 9 }}>
      <Text style={{ width: D, fontSize: 8.4, color: '#a1a1aa', paddingTop: 1 }}>{dates}</Text>
      <View style={{ flex: 1 }}>{body}</View>
    </View>
  );
  const exp = cv.experiences.length ? (
    <View key="exp">
      {heading(L.experience)}
      {cv.experiences.map((e) =>
        row(
          e.id,
          dateRange(e.startDate, e.endDate, e.current, L),
          <>
            <Text style={{ fontSize: 10.2, fontWeight: 600, color: '#18181b' }}>{e.position}</Text>
            <Text style={{ fontSize: 9, color: '#71717a' }}>{[e.company, e.location].filter(Boolean).join(', ')}</Text>
            <BulletList items={achievementsList(e.achievements)} color="#a1a1aa" />
          </>,
        ),
      )}
    </View>
  ) : null;
  const edu = cv.education.length ? (
    <View key="edu">
      {heading(L.education)}
      {cv.education.map((e) =>
        row(
          e.id,
          dateRange(e.startDate, e.endDate, false, L),
          <>
            <Text style={{ fontSize: 10, fontWeight: 600, color: '#18181b' }}>{e.degree}</Text>
            <Text style={{ fontSize: 9, color: '#71717a' }}>{[e.school, e.location].filter(Boolean).join(', ')}</Text>
            {e.details ? <Text style={{ fontSize: 8.8, color: '#a1a1aa' }}>{e.details}</Text> : null}
          </>,
        ),
      )}
    </View>
  ) : null;
  const line = (label: string, text: string) => (
    <View key={label} wrap={false} style={{ flexDirection: 'row', marginBottom: 5 }}>
      <Text style={{ width: D, fontSize: 8.4, color: '#a1a1aa', paddingTop: 0.5 }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 9.1 }}>{text}</Text>
    </View>
  );
  const extras: [string, string][] = [];
  if (cv.skills.length) extras.push([L.skills, cv.skills.join(' · ')]);
  if (cv.languages.length) extras.push([L.languages, cv.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(' · ')]);
  if (cv.certifications.length) extras.push([L.certifications, cv.certifications.map((c) => [c.name, c.issuer, c.date].filter(Boolean).join(', ')).join(' · ')]);
  if (cv.softSkills.length) extras.push([L.softSkills, cv.softSkills.join(' · ')]);
  if (cv.interests.length) extras.push([L.interests, cv.interests.join(' · ')]);
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.45, paddingVertical: 48, paddingHorizontal: 54, color: '#27272a' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 31, fontWeight: 400, letterSpacing: -0.4, color: '#09090b', lineHeight: 1.1 }}>{fullName(cv.personal) || ' '}</Text>
          {cv.personal.title ? <Text style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: 2.6, color: accent, marginTop: 7 }}>{cv.personal.title.toUpperCase()}</Text> : null}
        </View>
        {hasPhoto(cv) ? <Photo cv={cv} size={70} /> : null}
      </View>
      {contacts.length ? (
        <View style={{ marginTop: 14, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#d4d4d8' }}>
          <Text style={{ fontSize: 8.5, color: '#71717a' }}>{contacts.map((c) => c.value).join('     ')}</Text>
        </View>
      ) : null}
      {cv.summary ? (
        <View>
          {heading(L.profile)}
          <Text style={{ fontSize: 9.6, lineHeight: 1.55, color: '#3f3f46' }}>{cv.summary}</Text>
        </View>
      ) : null}
      {orderMain(cv, exp, edu)}
      {extras.length ? (
        <View>
          {heading(L.skills)}
          {extras.map(([l, t]) => line(l, t))}
        </View>
      ) : null}
      <SignatureBlock cv={cv} L={L} />
      <FreeMark cv={cv} />
    </Page>,
  );
}

/** Ligne (Pro) : un fil vertical relie les rubriques, chacune marquée d'un point. */
function Ligne({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const contacts = contactItems(cv, L);
  const PAD = 74;
  const SPINE = 50;
  const mark = (title: string) => (
    <View minPresenceAhead={40} style={{ position: 'relative', marginTop: 16, marginBottom: 7 }}>
      <View style={{ position: 'absolute', left: SPINE - PAD - 4.6, top: 1.5, width: 10, height: 10, borderRadius: 5, backgroundColor: '#ffffff', borderWidth: 2, borderColor: accent }} />
      <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', color: '#0f172a' }}>{title}</Text>
    </View>
  );
  const th: Theme = { accent, text: '#1f2937', muted: '#64748b', head: FONT, heading: (title) => mark(title) };
  const small = (title: string) => <Text style={{ fontSize: 8.6, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: accent, marginBottom: 5, marginTop: 4 }}>{title}</Text>;
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.42, paddingVertical: 40, paddingLeft: PAD, paddingRight: 44, color: '#1f2937' }}>
      <View fixed style={{ position: 'absolute', top: 40, bottom: 34, left: SPINE, width: 0.9, backgroundColor: tint(accent, 0.55) }} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 27, fontWeight: 700, color: '#0f172a', lineHeight: 1.12 }}>{fullName(cv.personal) || ' '}</Text>
          {cv.personal.title ? <Text style={{ fontSize: 11.5, fontWeight: 500, color: accent, marginTop: 3 }}>{cv.personal.title}</Text> : null}
          {contacts.length ? <Text style={{ fontSize: 8.5, color: '#64748b', marginTop: 7 }}>{contacts.map((c) => c.value).join('   ·   ')}</Text> : null}
        </View>
        {hasPhoto(cv) ? <View style={{ marginLeft: 14 }}><Photo cv={cv} size={78} /></View> : null}
      </View>
      <MainColumn cv={cv} L={L} th={th} />
      <Certifications cv={cv} L={L} th={th} />
      {cv.skills.length || cv.languages.length || cv.softSkills.length || cv.interests.length ? (
        <View wrap={false}>
          {mark(L.skills)}
          <BottomColumns cv={{ ...cv }} L={L} accent={accent} title={small} />
        </View>
      ) : null}
      <SignatureBlock cv={cv} L={L} />
      <FreeMark cv={cv} />
    </Page>,
  );
}

/** Nord (Pro) : fond crème, titres à empattement, colonne discrète à droite. Doux et élégant. */
function Nord({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const paper = '#faf7f2';
  const ink = '#1c1917';
  const contacts = contactItems(cv, L);
  const SIDE = 164;
  const dot = <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: accent, marginRight: 7 }} />;
  const th: Theme = {
    accent,
    text: '#292524',
    muted: '#78716c',
    head: SERIF,
    heading: (title) => (
      <View minPresenceAhead={40} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 7 }}>
        {dot}
        <Text style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 600, color: ink }}>{title}</Text>
      </View>
    ),
  };
  const side = (title: string) => <Text style={{ fontSize: 8.4, fontWeight: 600, letterSpacing: 1.8, textTransform: 'uppercase', color: '#78716c', marginTop: 16, marginBottom: 6 }}>{title}</Text>;
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.45, paddingVertical: 44, paddingHorizontal: 46, backgroundColor: paper, color: '#292524' }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, paddingRight: 26 }}>
          <Text style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 600, color: ink, lineHeight: 1.1 }}>{fullName(cv.personal) || ' '}</Text>
          {cv.personal.title ? <Text style={{ fontSize: 9.8, fontWeight: 500, letterSpacing: 2.2, color: accent, marginTop: 6 }}>{cv.personal.title.toUpperCase()}</Text> : null}
          <View style={{ width: 40, height: 1.2, backgroundColor: ink, marginTop: 12 }} />
          <MainColumn cv={cv} L={L} th={th} />
          <Certifications cv={cv} L={L} th={th} />
          <SignatureBlock cv={cv} L={L} align="left" />
        </View>
        <View style={{ width: SIDE, paddingLeft: 20, borderLeftWidth: 0.6, borderLeftColor: '#d6d3d1' }}>
          {hasPhoto(cv) ? <Photo cv={{ ...cv, settings: { ...cv.settings, photoShape: 'square' } }} size={SIDE - 20} /> : null}
          {contacts.length ? (
            <View>
              <Text style={{ fontSize: 8.4, fontWeight: 600, letterSpacing: 1.8, textTransform: 'uppercase', color: '#78716c', marginTop: hasPhoto(cv) ? 14 : 2, marginBottom: 6 }}>{L.contact}</Text>
              {contacts.map((c, i) => (
                <Text key={i} style={{ fontSize: 8.6, marginBottom: 3.5 }}>
                  {c.value}
                </Text>
              ))}
            </View>
          ) : null}
          <SideColumn cv={withoutContact(cv)} L={L} heading={side} text="#292524" muted="#78716c" dot={accent} dotOff="#e7e5e4" />
        </View>
      </View>
      <FreeMark cv={cv} />
    </Page>,
  );
}

/** Pastel (Pro) : en-tête dans une carte de couleur douce, coordonnées en pastilles, deux colonnes. */
function Pastel({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const soft = tint(accent, 0.88);
  const contacts = contactItems(cv, L);
  const SIDE = 166;
  const th: Theme = {
    accent,
    text: '#1f2937',
    muted: '#64748b',
    head: FONT,
    heading: (title) => (
      <View minPresenceAhead={40} style={{ marginTop: 15, marginBottom: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{title}</Text>
        <View style={{ width: 30, height: 4, borderRadius: 2, backgroundColor: tint(accent, 0.6), marginTop: 3 }} />
      </View>
    ),
  };
  const side = (title: string) => <Text style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#0f172a', marginTop: 15, marginBottom: 6 }}>{title}</Text>;
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.42, paddingVertical: 30, paddingHorizontal: 34, color: '#1f2937' }}>
      <View style={{ backgroundColor: soft, borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center' }}>
        {hasPhoto(cv) ? <View style={{ marginRight: 18 }}><Photo cv={cv} size={88} border="#ffffff" /></View> : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', lineHeight: 1.12 }}>{fullName(cv.personal) || ' '}</Text>
          {cv.personal.title ? <Text style={{ fontSize: 11.5, fontWeight: 600, color: accent, marginTop: 3 }}>{cv.personal.title}</Text> : null}
          {contacts.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 9 }}>
              {contacts.map((c, i) => (
                <Text key={i} style={{ fontSize: 8.2, color: '#334155', backgroundColor: '#ffffff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9, marginRight: 5, marginBottom: 4 }}>
                  {c.value}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 4, paddingHorizontal: 6 }}>
        <View style={{ width: SIDE, paddingRight: 20 }}>
          <SideColumn cv={withoutContact(cv)} L={L} heading={side} text="#1f2937" muted="#64748b" dot={accent} dotOff={tint(accent, 0.8)} tags={{ bg: soft, fg: '#1f2937' }} extra={<Certifications cv={cv} L={L} th={{ ...th, heading: (t) => side(t) }} />} />
        </View>
        <View style={{ flex: 1 }}>
          <MainColumn cv={cv} L={L} th={th} />
          <SignatureBlock cv={cv} L={L} />
        </View>
      </View>
      <FreeMark cv={cv} />
    </Page>,
  );
}

export function PureTemplate({ cv, id }: { cv: CvDocument; id: PureId }) {
  switch (id) {
    case 'clarte':
      return <Clarte cv={cv} />;
    case 'epure':
      return <Epure cv={cv} />;
    case 'ligne':
      return <Ligne cv={cv} />;
    case 'nord':
      return <Nord cv={cv} />;
    default:
      return <Pastel cv={cv} />;
  }
}
