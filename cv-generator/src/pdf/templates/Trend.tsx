import type { ReactNode } from 'react';
import type { CvDocument } from '../../types.ts';
import { fullName } from '../../lib/cv.ts';
import { LABELS, type Labels } from '../labels.ts';
import { Photo, SignatureBlock, FreeMark } from '../parts.tsx';
import { FONT, SERIF, contactItems, tint } from '../theme.ts';
import { Page, Text, View } from '../fit.tsx';
import { Certifications, Dots, MainColumn, SideColumn, doc, languageLevel, type Theme } from './Premium.tsx';

/**
 * Série « tendance » (Pro) : la typographie fait le style.
 * Affiche (nom en très grand), Bloc (aplat de couleur asymétrique), Duo (en-tête coupé en deux), Éditorial (façon magazine).
 */
export type TrendId = 'affiche' | 'bloc' | 'duo' | 'editorial';

const hasPhoto = (cv: CvDocument) => cv.settings.showPhoto && !!cv.photo;
const square = (cv: CvDocument): CvDocument => ({ ...cv, settings: { ...cv.settings, photoShape: 'square' } });
const withoutContact = (cv: CvDocument): CvDocument => ({
  ...cv,
  personal: { ...cv.personal, email: '', phone: '', address: '', city: '', country: '', linkedin: '', website: '', drivingLicense: '', birthDate: '' },
  settings: { ...cv.settings, showNationality: false, showBirthDate: false },
});

/** Compétences, langues (en points), qualités et centres d'intérêt en colonnes. */
function Columns({ cv, L, accent, title }: { cv: CvDocument; L: Labels; accent: string; title: (t: string) => ReactNode }) {
  const cols: { key: string; node: ReactNode }[] = [];
  if (cv.skills.length) cols.push({ key: 's', node: <>{title(L.skills)}<Text style={{ fontSize: 8.9 }}>{cv.skills.join(' · ')}</Text></> });
  if (cv.languages.length)
    cols.push({
      key: 'l',
      node: (
        <>
          {title(L.languages)}
          {cv.languages.map((l) => (
            <View key={l.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <Text style={{ fontSize: 8.9 }}>{l.name}</Text>
              {languageLevel(l.level) ? <Dots value={languageLevel(l.level)} on={accent} off={tint(accent, 0.8)} size={5} /> : <Text style={{ fontSize: 8, color: '#6b7280' }}>{l.level}</Text>}
            </View>
          ))}
        </>
      ),
    });
  if (cv.softSkills.length || cv.interests.length)
    cols.push({
      key: 'm',
      node: (
        <>
          {cv.softSkills.length ? <>{title(L.softSkills)}<Text style={{ fontSize: 8.9, marginBottom: 6 }}>{cv.softSkills.join(' · ')}</Text></> : null}
          {cv.interests.length ? <>{title(L.interests)}<Text style={{ fontSize: 8.9 }}>{cv.interests.join(' · ')}</Text></> : null}
        </>
      ),
    });
  if (!cols.length) return null;
  return (
    <View wrap={false} style={{ flexDirection: 'row' }}>
      {cols.map((c, i) => (
        <View key={c.key} style={{ flex: 1, paddingLeft: i ? 18 : 0 }}>
          {c.node}
        </View>
      ))}
    </View>
  );
}

/** Affiche : prénom et nom en très grand sur deux lignes, épais filet noir, noir et blanc avec une seule couleur. */
function Affiche({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const ink = '#0a0a0a';
  const contacts = contactItems(cv, L);
  const first = cv.personal.firstName.trim();
  const last = cv.personal.lastName.trim();
  const th: Theme = {
    accent,
    text: '#171717',
    muted: '#737373',
    head: FONT,
    heading: (title) => (
      <View minPresenceAhead={40} style={{ marginTop: 16, marginBottom: 7 }}>
        <Text style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3, color: ink }}>{title}</Text>
      </View>
    ),
  };
  const side = (title: string) => <Text style={{ fontSize: 8.4, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', color: ink, marginTop: 16, marginBottom: 6 }}>{title}</Text>;
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.42, paddingVertical: 40, paddingHorizontal: 44, color: '#171717' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1.6, lineHeight: 1.02, color: ink }}>{first || fullName(cv.personal) || ' '}</Text>
          {first && last ? <Text style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1.6, lineHeight: 1.02, color: accent }}>{last}</Text> : null}
        </View>
        {hasPhoto(cv) ? <Photo cv={square(cv)} size={84} /> : null}
      </View>
      <View style={{ height: 5, backgroundColor: ink, marginTop: 12 }} />
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {cv.personal.title ? <Text style={{ flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: 2, color: ink }}>{cv.personal.title.toUpperCase()}</Text> : <View style={{ flex: 1 }} />}
      </View>
      {contacts.length ? <Text style={{ fontSize: 8.5, color: '#525252', marginTop: 5 }}>{contacts.map((c) => c.value).join('   /   ')}</Text> : null}
      <View style={{ flexDirection: 'row', marginTop: 2 }}>
        <View style={{ flex: 1, paddingRight: 26 }}>
          <MainColumn cv={cv} L={L} th={th} />
          <SignatureBlock cv={cv} L={L} align="left" />
        </View>
        <View style={{ width: 148 }}>
          <SideColumn cv={withoutContact(cv)} L={L} heading={side} text="#171717" muted="#737373" dot={accent} dotOff="#e5e5e5" extra={<Certifications cv={cv} L={L} th={{ ...th, heading: (t) => side(t) }} />} />
        </View>
      </View>
      <FreeMark cv={cv} />
    </Page>,
  );
}

/** Bloc : grand aplat de couleur décalé à gauche avec le nom et l'accroche, photo et contact à droite. */
function Bloc({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const contacts = contactItems(cv, L);
  const th: Theme = {
    accent,
    text: '#1f2937',
    muted: '#6b7280',
    head: FONT,
    heading: (title) => (
      <View minPresenceAhead={40} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
        <View style={{ width: 11, height: 11, backgroundColor: accent, marginRight: 8 }} />
        <Text style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{title}</Text>
      </View>
    ),
  };
  const small = (title: string) => <Text style={{ fontSize: 8.6, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: accent, marginBottom: 5, marginTop: 12 }}>{title}</Text>;
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.42, paddingVertical: 36, paddingHorizontal: 38, color: '#1f2937' }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 342, backgroundColor: accent, padding: 26, justifyContent: 'center' }}>
          <Text style={{ fontSize: 29, fontWeight: 700, color: '#ffffff', lineHeight: 1.1, letterSpacing: -0.4 }}>{fullName(cv.personal) || ' '}</Text>
          {cv.personal.title ? <Text style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.8, color: tint(accent, 0.7), marginTop: 6 }}>{cv.personal.title.toUpperCase()}</Text> : null}
          {cv.summary ? <Text style={{ fontSize: 9.2, color: '#ffffff', marginTop: 10, lineHeight: 1.5 }}>{cv.summary}</Text> : null}
        </View>
        <View style={{ flex: 1, paddingLeft: 20, justifyContent: 'flex-end' }}>
          {hasPhoto(cv) ? <View style={{ marginBottom: 10 }}><Photo cv={square(cv)} size={96} /></View> : null}
          {contacts.map((c, i) => (
            <Text key={i} style={{ fontSize: 8.6, marginBottom: 3.5, color: '#374151' }}>
              {c.value}
            </Text>
          ))}
        </View>
      </View>
      <MainColumn cv={{ ...cv, summary: '' }} L={L} th={th} />
      <Certifications cv={cv} L={L} th={th} />
      <Columns cv={cv} L={L} accent={accent} title={small} />
      <SignatureBlock cv={cv} L={L} />
      <FreeMark cv={cv} />
    </Page>,
  );
}

/** Duo : en-tête pleine largeur coupé en deux, nom sur fond sombre à gauche, contact sur fond clair à droite. */
function Duo({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const dark = '#111827';
  const PAD_TOP = 34;
  const PAD_X = 40;
  const contacts = contactItems(cv, L);
  const th: Theme = {
    accent,
    text: '#1f2937',
    muted: '#6b7280',
    head: FONT,
    heading: (title) => (
      <View minPresenceAhead={40} style={{ marginTop: 15, marginBottom: 7, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: dark }}>{title}</Text>
        <View style={{ width: 22, height: 3, backgroundColor: accent, marginLeft: 9 }} />
      </View>
    ),
  };
  const side = (title: string) => <Text style={{ fontSize: 8.8, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: dark, marginTop: 15, marginBottom: 6 }}>{title}</Text>;
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.42, paddingTop: PAD_TOP, paddingBottom: 32, paddingHorizontal: PAD_X, color: '#1f2937' }}>
      {/* L'en-tête remonte dans les marges de la page ; les pages suivantes gardent leur marge haute. */}
      <View style={{ flexDirection: 'row', marginTop: -PAD_TOP, marginHorizontal: -PAD_X }}>
        <View style={{ flex: 3, backgroundColor: dark, paddingVertical: 30, paddingLeft: PAD_X, paddingRight: 20, flexDirection: 'row', alignItems: 'center' }}>
          {hasPhoto(cv) ? <View style={{ marginRight: 16 }}><Photo cv={cv} size={78} border={accent} /></View> : null}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, fontWeight: 700, color: '#ffffff', lineHeight: 1.12 }}>{fullName(cv.personal) || ' '}</Text>
            {cv.personal.title ? <Text style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.6, color: tint(accent, 0.3), marginTop: 5 }}>{cv.personal.title.toUpperCase()}</Text> : null}
          </View>
        </View>
        <View style={{ flex: 2, backgroundColor: tint(accent, 0.86), paddingVertical: 22, paddingLeft: 20, paddingRight: PAD_X, justifyContent: 'center' }}>
          {contacts.map((c, i) => (
            <Text key={i} style={{ fontSize: 8.6, color: dark, marginBottom: 3 }}>
              {c.value}
            </Text>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        <View style={{ flex: 1, paddingRight: 24 }}>
          <MainColumn cv={cv} L={L} th={th} />
          <SignatureBlock cv={cv} L={L} align="left" />
        </View>
        <View style={{ width: 158 }}>
          <SideColumn cv={withoutContact(cv)} L={L} heading={side} text="#1f2937" muted="#6b7280" dot={accent} dotOff="#e5e7eb" tags={{ bg: tint(accent, 0.86), fg: dark }} extra={<Certifications cv={cv} L={L} th={{ ...th, heading: (t) => side(t) }} />} />
        </View>
      </View>
      <FreeMark cv={cv} />
    </Page>,
  );
}

/** Éditorial : façon magazine. Grand nom à empattement, accroche en exergue, rubriques ouvertes par un filet. */
function Editorial({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const ink = '#18181b';
  const contacts = contactItems(cv, L);
  const th: Theme = {
    accent,
    text: '#27272a',
    muted: '#71717a',
    head: SERIF,
    heading: (title) => (
      <View minPresenceAhead={40} style={{ marginTop: 16, marginBottom: 8, borderTopWidth: 0.8, borderTopColor: ink, paddingTop: 6 }}>
        <Text style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 700, color: ink }}>{title}</Text>
      </View>
    ),
  };
  const small = (title: string) => <Text style={{ fontSize: 8.4, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase', color: accent, marginBottom: 5, marginTop: 4 }}>{title}</Text>;
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.45, paddingVertical: 42, paddingHorizontal: 48, color: '#27272a' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 7.8, fontWeight: 700, letterSpacing: 3, color: accent }}>CURRICULUM VITAE</Text>
        <View style={{ flex: 1, height: 0.6, backgroundColor: '#d4d4d8', marginLeft: 10 }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 700, color: ink, lineHeight: 1.08, letterSpacing: -0.5 }}>{fullName(cv.personal) || ' '}</Text>
          {cv.personal.title ? <Text style={{ fontSize: 11, fontWeight: 500, color: '#52525b', marginTop: 5 }}>{cv.personal.title}</Text> : null}
          {contacts.length ? <Text style={{ fontSize: 8.4, color: '#71717a', marginTop: 6 }}>{contacts.map((c) => c.value).join('   ·   ')}</Text> : null}
        </View>
        {hasPhoto(cv) ? <View style={{ marginLeft: 16 }}><Photo cv={square(cv)} size={88} /></View> : null}
      </View>
      {cv.summary ? (
        <View style={{ marginTop: 16, paddingLeft: 14, borderLeftWidth: 2.5, borderLeftColor: accent }}>
          <Text style={{ fontFamily: SERIF, fontSize: 12, lineHeight: 1.5, color: ink }}>{cv.summary}</Text>
        </View>
      ) : null}
      <MainColumn cv={{ ...cv, summary: '' }} L={L} th={th} />
      <Certifications cv={cv} L={L} th={th} />
      {cv.skills.length || cv.languages.length || cv.softSkills.length || cv.interests.length ? (
        <View wrap={false}>
          {th.heading(L.skills)}
          <Columns cv={cv} L={L} accent={accent} title={small} />
        </View>
      ) : null}
      <SignatureBlock cv={cv} L={L} />
      <FreeMark cv={cv} />
    </Page>,
  );
}

export function TrendTemplate({ cv, id }: { cv: CvDocument; id: TrendId }) {
  switch (id) {
    case 'affiche':
      return <Affiche cv={cv} />;
    case 'bloc':
      return <Bloc cv={cv} />;
    case 'duo':
      return <Duo cv={cv} />;
    default:
      return <Editorial cv={cv} />;
  }
}
