import type { ReactNode } from 'react';
import type { CvDocument } from '../../types.ts';
import { achievementsList, fullName } from '../../lib/cv.ts';
import { LABELS, type Labels } from '../labels.ts';
import { orderMain } from '../order.ts';
import { Photo, SignatureBlock, FreeMark } from '../parts.tsx';
import { FONT, SERIF, contactItems, dateRange, tint } from '../theme.ts';
import { Page, Text, View } from '../fit.tsx';
import { BulletList, Certifications, Dots, Education, Experience, MainColumn, SideColumn, Summary, doc, languageLevel, type Theme } from './Premium.tsx';

/**
 * Deuxième série de modèles dessinés à la main :
 * - gratuits : Simple (une colonne, très lisible par les logiciels de tri), Bicolore (colonne grise), Compact (titres en marge) ;
 * - Pro : Ardoise (en-tête sombre et bande de contact), Galerie (grand bloc photo, dates en colonne),
 *   Cadre (page encadrée, typographie classique), Mosaïque (rubriques en cartes).
 */
export type CollectionId = 'simple' | 'bicolore' | 'compact' | 'ardoise' | 'galerie' | 'cadre' | 'mosaique';

const initialsOf = (cv: CvDocument) => [cv.personal.firstName, cv.personal.lastName].map((x) => x.trim()[0] ?? '').join('').toUpperCase() || 'CV';
const hasPhoto = (cv: CvDocument) => cv.settings.showPhoto && !!cv.photo;

/** Compétences, langues, qualités, centres d'intérêt en lignes simples (lu sans difficulté par les logiciels de tri). */
function InlineExtras({ cv, L, th }: { cv: CvDocument; L: Labels; th: Theme }) {
  const rows: [string, string][] = [];
  if (cv.skills.length) rows.push([L.skills, cv.skills.join(' · ')]);
  if (cv.languages.length) rows.push([L.languages, cv.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(' · ')]);
  if (cv.softSkills.length) rows.push([L.softSkills, cv.softSkills.join(' · ')]);
  if (cv.interests.length) rows.push([L.interests, cv.interests.join(' · ')]);
  return (
    <>
      {rows.map(([title, text]) => (
        <View key={title} wrap={false}>
          {th.heading(title)}
          <Text style={{ fontSize: 9.2, color: th.text }}>{text}</Text>
        </View>
      ))}
    </>
  );
}

/** Simple (gratuit) : une colonne, filets fins, photo facultative à droite. Le plus sûr pour les logiciels de tri. */
function Simple({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const contacts = contactItems(cv, L);
  const th: Theme = {
    accent,
    text: '#1f2937',
    muted: '#6b7280',
    head: FONT,
    heading: (title) => (
      <View minPresenceAhead={40} style={{ marginTop: 13, marginBottom: 6, borderBottomWidth: 0.8, borderBottomColor: tint(accent, 0.6), paddingBottom: 2 }}>
        <Text style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: accent }}>{title}</Text>
      </View>
    ),
  };
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.4, paddingVertical: 38, paddingHorizontal: 46, color: '#1f2937' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 24, fontWeight: 700, color: '#111827', lineHeight: 1.15 }}>{fullName(cv.personal) || ' '}</Text>
          {cv.personal.title ? <Text style={{ fontSize: 11.5, fontWeight: 500, color: accent, marginTop: 3 }}>{cv.personal.title}</Text> : null}
          {contacts.length ? <Text style={{ fontSize: 8.6, color: '#4b5563', marginTop: 6 }}>{contacts.map((c) => c.value).join('  ·  ')}</Text> : null}
        </View>
        {hasPhoto(cv) ? <View style={{ marginLeft: 16 }}><Photo cv={cv} size={74} /></View> : null}
      </View>
      <View style={{ height: 2, backgroundColor: accent, marginTop: 12 }} />
      <MainColumn cv={cv} L={L} th={th} />
      <Certifications cv={cv} L={L} th={th} />
      <InlineExtras cv={cv} L={L} th={th} />
      <SignatureBlock cv={cv} L={L} />
      <FreeMark cv={cv} />
    </Page>,
  );
}

/** Bicolore (gratuit) : colonne gris clair à gauche, titres colorés à droite. */
function Bicolore({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const W = 188;
  const th: Theme = {
    accent,
    text: '#1f2937',
    muted: '#6b7280',
    head: FONT,
    heading: (title) => (
      <View minPresenceAhead={40} style={{ marginTop: 14, marginBottom: 7 }}>
        <Text style={{ fontSize: 12, fontWeight: 700, color: accent }}>{title}</Text>
        <View style={{ width: 24, height: 2.5, borderRadius: 1, backgroundColor: accent, marginTop: 2 }} />
      </View>
    ),
  };
  const side = (title: string) => <Text style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#334155', marginTop: 14, marginBottom: 6 }}>{title}</Text>;
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.4, flexDirection: 'row', paddingVertical: 32 }}>
      <View fixed style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: W, backgroundColor: '#f1f5f9' }} />
      <View style={{ width: W, paddingHorizontal: 18 }}>
        {hasPhoto(cv) ? (
          <View style={{ alignItems: 'center', marginBottom: 6 }}>
            <Photo cv={cv} size={104} />
          </View>
        ) : null}
        <SideColumn cv={cv} L={L} heading={side} text="#334155" muted="#64748b" dot={accent} dotOff="#cbd5e1" />
      </View>
      <View style={{ flex: 1, paddingLeft: 24, paddingRight: 30 }}>
        <Text style={{ fontSize: 25, fontWeight: 700, color: '#0f172a', lineHeight: 1.12 }}>{fullName(cv.personal) || ' '}</Text>
        {cv.personal.title ? <Text style={{ fontSize: 11, fontWeight: 600, color: accent, marginTop: 4 }}>{cv.personal.title}</Text> : null}
        <MainColumn cv={cv} L={L} th={th} />
        <Certifications cv={cv} L={L} th={th} />
        <SignatureBlock cv={cv} L={L} />
      </View>
      <FreeMark cv={cv} left={W} />
    </Page>,
  );
}

/** Compact (gratuit) : titres de rubriques dans une marge à gauche, dates alignées. Beaucoup d'informations sur une page. */
function Compact({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const M = 96;
  const contacts = contactItems(cv, L);
  const row = (title: string, body: ReactNode, key?: string) => (
    <View key={key ?? title} style={{ flexDirection: 'row', marginTop: 11, paddingTop: 7, borderTopWidth: 0.6, borderTopColor: '#e5e7eb' }}>
      <Text style={{ width: M, paddingRight: 10, fontSize: 8.6, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: accent }}>{title}</Text>
      <View style={{ flex: 1 }}>{body}</View>
    </View>
  );
  const item = (title: string, sub: string, dates: string, bullets?: string[], details?: string) => (
    <View style={{ marginBottom: 6 }}>
      <View wrap={false} style={{ flexDirection: 'row' }}>
        <Text style={{ flex: 1, fontSize: 9.6, fontWeight: 700 }}>
          {title}
          {sub ? <Text style={{ fontWeight: 400, color: '#4b5563' }}>{`  ·  ${sub}`}</Text> : null}
        </Text>
        <Text style={{ fontSize: 8.4, color: '#6b7280', marginLeft: 8 }}>{dates}</Text>
      </View>
      {details ? <Text style={{ fontSize: 8.8, color: '#6b7280' }}>{details}</Text> : null}
      {bullets?.length ? <BulletList items={bullets} color={accent} size={8.8} /> : null}
    </View>
  );
  const exp = cv.experiences.length ? row(L.experience, cv.experiences.map((e) => <View key={e.id}>{item(e.position, [e.company, e.location].filter(Boolean).join(', '), dateRange(e.startDate, e.endDate, e.current, L), achievementsList(e.achievements))}</View>), 'exp') : null;
  const edu = cv.education.length ? row(L.education, cv.education.map((e) => <View key={e.id}>{item(e.degree, [e.school, e.location].filter(Boolean).join(', '), dateRange(e.startDate, e.endDate, false, L), undefined, e.details)}</View>), 'edu') : null;
  const line = (items: string[]) => <Text style={{ fontSize: 9 }}>{items.join(' · ')}</Text>;
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9, lineHeight: 1.38, paddingVertical: 34, paddingHorizontal: 40, color: '#1f2937' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1.15 }}>{fullName(cv.personal) || ' '}</Text>
          {cv.personal.title ? <Text style={{ fontSize: 10.5, color: accent, fontWeight: 600, marginTop: 2 }}>{cv.personal.title}</Text> : null}
        </View>
        <View style={{ width: 200, alignItems: 'flex-end' }}>
          {contacts.map((c, i) => (
            <Text key={i} style={{ fontSize: 8.3, color: '#4b5563', textAlign: 'right' }}>
              {c.value}
            </Text>
          ))}
        </View>
        {hasPhoto(cv) ? <View style={{ marginLeft: 12 }}><Photo cv={cv} size={62} /></View> : null}
      </View>
      {cv.summary ? row(L.profile, <Text style={{ fontSize: 9.1, textAlign: 'justify' }}>{cv.summary}</Text>) : null}
      {orderMain(cv, exp, edu)}
      {cv.skills.length ? row(L.skills, line(cv.skills)) : null}
      {cv.languages.length ? row(L.languages, line(cv.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)))) : null}
      {cv.certifications.length ? row(L.certifications, line(cv.certifications.map((c) => [c.name, c.issuer, c.date].filter(Boolean).join(', ')))) : null}
      {cv.softSkills.length ? row(L.softSkills, line(cv.softSkills)) : null}
      {cv.interests.length ? row(L.interests, line(cv.interests)) : null}
      <SignatureBlock cv={cv} L={L} />
      <FreeMark cv={cv} />
    </Page>,
  );
}

/** Ardoise (Pro) : en-tête ardoise pleine largeur, bande de contact colorée, deux colonnes. */
function Ardoise({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const slate = '#1e293b';
  const SIDE = 172;
  const contacts = contactItems(cv, L);
  const th: Theme = {
    accent,
    text: '#1f2937',
    muted: '#64748b',
    head: FONT,
    heading: (title) => (
      <View minPresenceAhead={40} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 7 }}>
        <View style={{ width: 8, height: 8, backgroundColor: accent, marginRight: 7 }} />
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: slate }}>{title}</Text>
        <View style={{ flex: 1, height: 0.6, backgroundColor: '#cbd5e1', marginLeft: 8 }} />
      </View>
    ),
  };
  const side = (title: string) => <Text style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: slate, marginTop: 14, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1.5, borderBottomColor: accent }}>{title}</Text>;
  const noContact = { ...cv, personal: { ...cv.personal, email: '', phone: '', address: '', city: '', country: '', linkedin: '', website: '', drivingLicense: '', birthDate: '' }, settings: { ...cv.settings, showNationality: false, showBirthDate: false } };
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.4, paddingTop: 30, paddingBottom: 30, color: '#1f2937' }}>
      <View style={{ marginTop: -30, backgroundColor: slate, paddingHorizontal: 36, paddingVertical: 26, flexDirection: 'row', alignItems: 'center' }}>
        {hasPhoto(cv) ? <View style={{ marginRight: 20 }}><Photo cv={cv} size={86} border={accent} /></View> : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 27, fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>{fullName(cv.personal) || ' '}</Text>
          {cv.personal.title ? <Text style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: tint(accent, 0.35), marginTop: 5 }}>{cv.personal.title}</Text> : null}
        </View>
      </View>
      {contacts.length ? (
        <View style={{ backgroundColor: accent, paddingHorizontal: 36, paddingVertical: 7, flexDirection: 'row', flexWrap: 'wrap' }}>
          {contacts.map((c, i) => (
            <Text key={i} style={{ fontSize: 8.4, color: '#ffffff', marginRight: 16 }}>
              {c.value}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', paddingHorizontal: 36, marginTop: 4 }}>
        <View style={{ flex: 1, paddingRight: 22 }}>
          <MainColumn cv={cv} L={L} th={th} />
          <Certifications cv={cv} L={L} th={th} />
          <SignatureBlock cv={cv} L={L} />
        </View>
        <View style={{ width: SIDE }}>
          <SideColumn cv={noContact} L={L} heading={side} text="#1f2937" muted="#64748b" dot={accent} dotOff="#e2e8f0" tags={{ bg: tint(accent, 0.88), fg: '#1f2937' }} />
        </View>
      </View>
      <FreeMark cv={cv} />
    </Page>,
  );
}

/** Galerie (Pro) : grand bloc photo coloré, accroche à côté, expériences avec les dates dans une colonne. */
function Galerie({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const BLOCK = 168;
  const contacts = contactItems(cv, L);
  const th: Theme = {
    accent,
    text: '#1f2937',
    muted: '#6b7280',
    head: SERIF,
    heading: (title) => (
      <View minPresenceAhead={40} style={{ marginTop: 14, marginBottom: 7 }}>
        <Text style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: accent }}>{title}</Text>
      </View>
    ),
  };
  const dated = (key: string, start: string, end: string, body: ReactNode) => (
    <View key={key} style={{ flexDirection: 'row', marginBottom: 9 }}>
      <View style={{ width: 72, paddingRight: 8, borderRightWidth: 1.5, borderRightColor: tint(accent, 0.6) }}>
        <Text style={{ fontSize: 9.5, fontWeight: 700, color: accent }}>{start || ' '}</Text>
        {end ? <Text style={{ fontSize: 8.4, color: '#6b7280' }}>{end}</Text> : null}
      </View>
      <View style={{ flex: 1, paddingLeft: 10 }}>{body}</View>
    </View>
  );
  const exp = cv.experiences.length ? (
    <View key="exp">
      {th.heading(L.experience)}
      {cv.experiences.map((e) =>
        dated(
          e.id,
          e.startDate,
          e.current ? L.present : e.endDate,
          <>
            <Text style={{ fontSize: 10.2, fontWeight: 700 }}>{e.position}</Text>
            <Text style={{ fontSize: 9, color: '#4b5563', fontWeight: 600 }}>{[e.company, e.location].filter(Boolean).join(' · ')}</Text>
            <BulletList items={achievementsList(e.achievements)} color={accent} />
          </>,
        ),
      )}
    </View>
  ) : null;
  const edu = cv.education.length ? (
    <View key="edu">
      {th.heading(L.education)}
      {cv.education.map((e) =>
        dated(
          e.id,
          e.startDate,
          e.endDate,
          <>
            <Text style={{ fontSize: 10, fontWeight: 700 }}>{e.degree}</Text>
            <Text style={{ fontSize: 9, color: '#4b5563' }}>{[e.school, e.location].filter(Boolean).join(' · ')}</Text>
            {e.details ? <Text style={{ fontSize: 8.8, color: '#6b7280' }}>{e.details}</Text> : null}
          </>,
        ),
      )}
    </View>
  ) : null;
  const facts: { title: string; node: ReactNode }[] = [];
  if (contacts.length) facts.push({ title: L.contact, node: contacts.map((c, i) => <Text key={i} style={{ fontSize: 8.5 }}>{c.value}</Text>) });
  if (cv.skills.length) facts.push({ title: L.skills, node: <Text style={{ fontSize: 8.8 }}>{cv.skills.join(' · ')}</Text> });
  if (cv.languages.length)
    facts.push({
      title: L.languages,
      node: cv.languages.map((l) => (
        <View key={l.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <Text style={{ fontSize: 8.8 }}>{l.name}</Text>
          {languageLevel(l.level) ? <Dots value={languageLevel(l.level)} on={accent} off={tint(accent, 0.8)} size={5} /> : <Text style={{ fontSize: 8, color: '#6b7280' }}>{l.level}</Text>}
        </View>
      )),
    });
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.4, paddingVertical: 34, paddingHorizontal: 38, color: '#1f2937' }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: BLOCK, height: BLOCK, backgroundColor: accent, borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
          {hasPhoto(cv) ? <Photo cv={{ ...cv, settings: { ...cv.settings, photoShape: 'square' } }} size={BLOCK - 22} /> : <Text style={{ fontFamily: SERIF, fontSize: 54, fontWeight: 700, color: '#ffffff' }}>{initialsOf(cv)}</Text>}
        </View>
        <View style={{ flex: 1, paddingLeft: 22, justifyContent: 'center' }}>
          <Text style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>{fullName(cv.personal) || ' '}</Text>
          {cv.personal.title ? <Text style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: accent, marginTop: 5 }}>{cv.personal.title}</Text> : null}
          {cv.summary ? <Text style={{ fontSize: 9.2, color: '#374151', marginTop: 8, textAlign: 'justify' }}>{cv.summary}</Text> : null}
        </View>
      </View>
      {facts.length ? (
        <View wrap={false} style={{ flexDirection: 'row', marginTop: 14, paddingVertical: 10, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: accent }}>
          {facts.map((f, i) => (
            <View key={f.title} style={{ flex: 1, paddingLeft: i ? 10 : 0, marginLeft: i ? 10 : 0, borderLeftWidth: i ? 0.6 : 0, borderLeftColor: tint(accent, 0.7) }}>
              <Text style={{ fontSize: 8.6, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: accent, marginBottom: 4 }}>{f.title}</Text>
              {f.node}
            </View>
          ))}
        </View>
      ) : null}
      {orderMain(cv, exp, edu)}
      <Certifications cv={cv} L={L} th={th} />
      {cv.softSkills.length || cv.interests.length ? (
        <View wrap={false}>
          {th.heading([cv.softSkills.length ? L.softSkills : '', cv.interests.length ? L.interests : ''].filter(Boolean).join(' & '))}
          <Text style={{ fontSize: 9 }}>{[...cv.softSkills, ...cv.interests].join(' · ')}</Text>
        </View>
      ) : null}
      <SignatureBlock cv={cv} L={L} />
      <FreeMark cv={cv} />
    </Page>,
  );
}

/** Cadre (Pro) : page encadrée d'un double filet, en-tête centré, typographie classique. */
function Cadre({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const contacts = contactItems(cv, L);
  const th: Theme = {
    accent,
    text: '#27272a',
    muted: '#71717a',
    head: SERIF,
    timeline: false,
    heading: (title) => (
      <View minPresenceAhead={40} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 7 }}>
        <View style={{ flex: 1, height: 0.6, backgroundColor: tint(accent, 0.5) }} />
        <Text style={{ fontFamily: SERIF, fontSize: 11.5, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: accent, marginHorizontal: 10 }}>{title}</Text>
        <View style={{ flex: 1, height: 0.6, backgroundColor: tint(accent, 0.5) }} />
      </View>
    ),
  };
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.42, paddingVertical: 44, paddingHorizontal: 50, color: '#27272a' }}>
      <View fixed style={{ position: 'absolute', top: 16, bottom: 16, left: 16, right: 16, borderWidth: 1.6, borderColor: accent }} />
      <View fixed style={{ position: 'absolute', top: 20, bottom: 20, left: 20, right: 20, borderWidth: 0.5, borderColor: tint(accent, 0.4) }} />
      <View style={{ alignItems: 'center' }}>
        {hasPhoto(cv) ? (
          <View style={{ marginBottom: 8 }}>
            <Photo cv={cv} size={78} border={tint(accent, 0.5)} />
          </View>
        ) : (
          <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1.2, borderColor: accent, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: accent }}>{initialsOf(cv)}</Text>
          </View>
        )}
        <View style={{ width: '100%' }}>
          <Text style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: '#18181b', textAlign: 'center', lineHeight: 1.2 }}>{fullName(cv.personal) || ' '}</Text>
        </View>
        {cv.personal.title ? (
          <View style={{ width: '100%' }}>
            <Text style={{ fontFamily: SERIF, fontSize: 11.5, letterSpacing: 0.6, color: accent, textAlign: 'center', marginTop: 2 }}>{cv.personal.title}</Text>
          </View>
        ) : null}
        {contacts.length ? (
          <View style={{ width: '100%' }}>
            <Text style={{ fontSize: 8.5, color: '#52525b', textAlign: 'center', marginTop: 7 }}>{contacts.map((c) => c.value).join('   |   ')}</Text>
          </View>
        ) : null}
      </View>
      <Summary cv={cv} L={L} th={th} />
      {orderMain(cv, <Experience key="exp" cv={cv} L={L} th={th} />, <Education key="edu" cv={cv} L={L} th={th} />)}
      <Certifications cv={cv} L={L} th={th} />
      <InlineExtras cv={cv} L={L} th={th} />
      <SignatureBlock cv={cv} L={L} />
      <FreeMark cv={cv} />
    </Page>,
  );
}

/** Mosaïque (Pro) : chaque rubrique dans une carte arrondie, en grille sur deux colonnes. */
function Mosaique({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const contacts = contactItems(cv, L);
  const card = { backgroundColor: '#ffffff', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 0.6, borderColor: tint(accent, 0.75) };
  const th: Theme = {
    accent,
    text: '#1f2937',
    muted: '#6b7280',
    head: FONT,
    heading: (title) => (
      <View minPresenceAhead={30} style={{ flexDirection: 'row', marginBottom: 7 }}>
        <Text style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#ffffff', backgroundColor: accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9 }}>{title}</Text>
      </View>
    ),
  };
  const noContact = { ...cv, personal: { ...cv.personal, email: '', phone: '', address: '', city: '', country: '', linkedin: '', website: '', drivingLicense: '', birthDate: '' }, settings: { ...cv.settings, showNationality: false, showBirthDate: false } };
  const side = (title: string) => <View style={{ marginTop: 4 }}>{th.heading(title)}</View>;
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.1, lineHeight: 1.4, paddingVertical: 28, paddingHorizontal: 28, backgroundColor: tint(accent, 0.94), color: '#1f2937' }}>
      <View style={[card, { flexDirection: 'row', alignItems: 'center', padding: 16 }]}>
        {hasPhoto(cv) ? <View style={{ marginRight: 16 }}><Photo cv={cv} size={78} /></View> : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 25, fontWeight: 700, color: '#0f172a', lineHeight: 1.12 }}>{fullName(cv.personal) || ' '}</Text>
          {cv.personal.title ? <Text style={{ fontSize: 11, fontWeight: 600, color: accent, marginTop: 3 }}>{cv.personal.title}</Text> : null}
          {contacts.length ? <Text style={{ fontSize: 8.4, color: '#475569', marginTop: 6 }}>{contacts.map((c) => c.value).join('  ·  ')}</Text> : null}
        </View>
      </View>
      {cv.summary ? (
        <View style={card}>
          {th.heading(L.profile)}
          <Text style={{ textAlign: 'justify' }}>{cv.summary}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          {orderMain(
            cv,
            cv.experiences.length ? (
              <View key="exp" style={card}>
                <Experience cv={cv} L={L} th={{ ...th, heading: (t) => th.heading(t) }} />
              </View>
            ) : null,
            cv.education.length ? (
              <View key="edu" style={card}>
                <Education cv={cv} L={L} th={th} />
              </View>
            ) : null,
          )}
        </View>
        <View style={{ width: 168 }}>
          <View style={card}>
            <SideColumn cv={noContact} L={L} heading={side} text="#1f2937" muted="#6b7280" dot={accent} dotOff={tint(accent, 0.8)} tags={{ bg: tint(accent, 0.88), fg: '#1f2937' }} extra={<Certifications cv={cv} L={L} th={{ ...th, heading: (t) => side(t) }} />} />
          </View>
        </View>
      </View>
      <SignatureBlock cv={cv} L={L} />
      <FreeMark cv={cv} />
    </Page>,
  );
}

export function CollectionTemplate({ cv, id }: { cv: CvDocument; id: CollectionId }) {
  switch (id) {
    case 'simple':
      return <Simple cv={cv} />;
    case 'bicolore':
      return <Bicolore cv={cv} />;
    case 'compact':
      return <Compact cv={cv} />;
    case 'ardoise':
      return <Ardoise cv={cv} />;
    case 'galerie':
      return <Galerie cv={cv} />;
    case 'cadre':
      return <Cadre cv={cv} />;
    default:
      return <Mosaique cv={cv} />;
  }
}
