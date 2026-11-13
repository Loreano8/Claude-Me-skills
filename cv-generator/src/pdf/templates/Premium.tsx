import { Document, Polygon, Svg } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { ReactNode } from 'react';
import type { CvDocument } from '../../types.ts';
import { achievementsList, fullName } from '../../lib/cv.ts';
import { LABELS, type Labels } from '../labels.ts';
import { orderMain } from '../order.ts';
import { Photo, SignatureBlock, FreeMark } from '../parts.tsx';
import { FONT, SERIF, contactItems, dateRange, tint } from '../theme.ts';
import { Page, Text, View } from '../fit.tsx';

/**
 * Modèles Pro « premium » : dessinés à la main, nettement plus travaillés que les modèles gratuits
 * (frise chronologique, niveaux de langue en points, bandeau en biais, monogramme…).
 */
export type PremiumId = 'prestige' | 'horizon' | 'atelier' | 'signature';

const A4_W = 595.28;

/** Niveau de langue (1 à 5) déduit du texte saisi : « C1 », « Courant », « Native »… */
export function languageLevel(level: string): number {
  const l = level.toLowerCase();
  if (/c2|natif|native|maternelle|mother|bilingue|bilingual/.test(l)) return 5;
  if (/c1|courant|fluent|avancé|advanced/.test(l)) return 4;
  if (/b2|professionnel|professional|bon|good|upper/.test(l)) return 3.5;
  if (/b1|intermédiaire|intermediate|moyen/.test(l)) return 3;
  if (/a2|scolaire|élémentaire|elementary|notions|basic/.test(l)) return 2;
  if (/a1|débutant|beginner/.test(l)) return 1;
  return 0;
}

function Dots({ value, on, off, size = 6 }: { value: number; on: string; off: string; size?: number }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', marginTop: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{ width: size, height: size, borderRadius: size / 2, marginRight: 3, backgroundColor: value >= i ? on : value >= i - 0.5 ? tint(on, 0.45) : off }} />
      ))}
    </View>
  );
}

function BulletList({ items, color, size = 8.8 }: { items: string[]; color: string; size?: number }) {
  return (
    <View style={{ marginTop: 3 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 2 }}>
          <View style={{ width: 3.5, height: 3.5, borderRadius: 1.75, backgroundColor: color, marginTop: size * 0.55, marginRight: 6 }} />
          <Text style={{ flex: 1, fontSize: size }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

interface Theme {
  accent: string;
  text: string;
  muted: string;
  head: string;
  heading: (title: string, n?: number) => ReactNode;
  timeline?: boolean;
}

function Experience({ cv, L, th }: { cv: CvDocument; L: Labels; th: Theme }) {
  if (!cv.experiences.length) return null;
  return (
    <View>
      {th.heading(L.experience, 1)}
      {cv.experiences.map((e) => {
        const head = (
          <View wrap={false}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <Text style={{ flex: 1, fontSize: 10.2, fontWeight: 700, color: th.text }}>{e.position}</Text>
              <Text style={{ fontSize: 8.4, color: th.muted, marginLeft: 8 }}>{dateRange(e.startDate, e.endDate, e.current, L)}</Text>
            </View>
            <Text style={{ fontSize: 9, fontWeight: 600, color: th.accent, marginTop: 1 }}>{[e.company, e.location].filter(Boolean).join(' · ')}</Text>
          </View>
        );
        const body = <BulletList items={achievementsList(e.achievements)} color={th.accent} />;
        if (!th.timeline) {
          return (
            <View key={e.id} style={{ marginBottom: 9 }}>
              {head}
              {body}
            </View>
          );
        }
        return (
          <View key={e.id} style={{ flexDirection: 'row' }}>
            <View style={{ width: 14, alignItems: 'center' }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, borderWidth: 1.5, borderColor: th.accent, backgroundColor: '#ffffff', marginTop: 3 }} />
              <View style={{ flex: 1, width: 1, backgroundColor: tint(th.accent, 0.6), marginTop: 2 }} />
            </View>
            <View style={{ flex: 1, paddingLeft: 6, paddingBottom: 9 }}>
              {head}
              {body}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Education({ cv, L, th }: { cv: CvDocument; L: Labels; th: Theme }) {
  if (!cv.education.length) return null;
  return (
    <View>
      {th.heading(L.education, 2)}
      {cv.education.map((e) => (
        <View key={e.id} wrap={false} style={{ marginBottom: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={{ flex: 1, fontSize: 10, fontWeight: 700, color: th.text }}>{e.degree}</Text>
            <Text style={{ fontSize: 8.4, color: th.muted, marginLeft: 8 }}>{dateRange(e.startDate, e.endDate, false, L)}</Text>
          </View>
          <Text style={{ fontSize: 9, color: th.accent, fontWeight: 600, marginTop: 1 }}>{[e.school, e.location].filter(Boolean).join(' · ')}</Text>
          {e.details ? <Text style={{ fontSize: 8.8, color: th.muted, marginTop: 1 }}>{e.details}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function Certifications({ cv, L, th, n }: { cv: CvDocument; L: Labels; th: Theme; n?: number }) {
  if (!cv.certifications.length) return null;
  return (
    <View>
      {th.heading(L.certifications, n)}
      {cv.certifications.map((c) => (
        <Text key={c.id} style={{ fontSize: 9, marginBottom: 3, color: th.text }}>
          <Text style={{ fontWeight: 700 }}>{c.name}</Text>
          {[c.issuer, c.date].filter(Boolean).length ? ` · ${[c.issuer, c.date].filter(Boolean).join(', ')}` : ''}
        </Text>
      ))}
    </View>
  );
}

function Summary({ cv, L, th }: { cv: CvDocument; L: Labels; th: Theme }) {
  if (!cv.summary) return null;
  return (
    <View>
      {th.heading(L.profile, 0)}
      <Text style={{ fontSize: 9.2, color: th.text, textAlign: 'justify' }}>{cv.summary}</Text>
    </View>
  );
}

function MainColumn({ cv, L, th }: { cv: CvDocument; L: Labels; th: Theme }) {
  return (
    <>
      <Summary cv={cv} L={L} th={th} />
      {orderMain(cv, <Experience key="exp" cv={cv} L={L} th={th} />, <Education key="edu" cv={cv} L={L} th={th} />)}
    </>
  );
}

/** Colonne d'informations : contact, compétences, langues (en points), qualités, centres d'intérêt. */
function SideColumn({ cv, L, heading, text, muted, dot, dotOff, tags, extra }: { cv: CvDocument; L: Labels; heading: (t: string) => ReactNode; text: string; muted: string; dot: string; dotOff: string; tags?: { bg: string; fg: string }; extra?: ReactNode }) {
  const contacts = contactItems(cv, L);
  return (
    <>
      {contacts.length > 0 && (
        <View>
          {heading(L.contact)}
          {contacts.map((c, i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
              <View style={{ width: 4, height: 4, backgroundColor: dot, marginTop: 4, marginRight: 6, transform: 'rotate(45deg)' }} />
              <Text style={{ flex: 1, fontSize: 8.5, color: text }}>{c.value}</Text>
            </View>
          ))}
        </View>
      )}
      {cv.skills.length > 0 && (
        <View>
          {heading(L.skills)}
          {tags ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cv.skills.map((s, i) => (
                <Text key={i} style={{ fontSize: 8.2, backgroundColor: tags.bg, color: tags.fg, paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 4, marginRight: 4, marginBottom: 4 }}>
                  {s}
                </Text>
              ))}
            </View>
          ) : (
            cv.skills.map((s, i) => (
              <Text key={i} style={{ fontSize: 8.8, color: text, marginBottom: 3 }}>
                {s}
              </Text>
            ))
          )}
        </View>
      )}
      {cv.languages.length > 0 && (
        <View>
          {heading(L.languages)}
          {cv.languages.map((l) => (
            <View key={l.id} style={{ marginBottom: 5 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 8.8, fontWeight: 600, color: text }}>{l.name}</Text>
                {!languageLevel(l.level) && l.level ? <Text style={{ fontSize: 8, color: muted }}>{l.level}</Text> : null}
              </View>
              <Dots value={languageLevel(l.level)} on={dot} off={dotOff} />
            </View>
          ))}
        </View>
      )}
      {cv.softSkills.length > 0 && (
        <View>
          {heading(L.softSkills)}
          <Text style={{ fontSize: 8.8, color: text }}>{cv.softSkills.join(' · ')}</Text>
        </View>
      )}
      {extra}
      {cv.interests.length > 0 && (
        <View>
          {heading(L.interests)}
          <Text style={{ fontSize: 8.8, color: text }}>{cv.interests.join(' · ')}</Text>
        </View>
      )}
    </>
  );
}

const doc = (cv: CvDocument, children: ReactNode) => (
  <Document title={`CV – ${fullName(cv.personal)}`} author={fullName(cv.personal)} creator="CVCasa">
    {children}
  </Document>
);

/** Prestige : colonne bleu nuit, filets dorés, frise chronologique. Pour cadres et profils confirmés. */
function Prestige({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const gold = cv.settings.accent;
  const navy = '#14213d';
  const W = 196;
  const th: Theme = {
    accent: gold,
    text: '#1f2937',
    muted: '#6b7280',
    head: SERIF,
    timeline: true,
    heading: (title) => (
      <View minPresenceAhead={50} style={{ marginTop: 15, marginBottom: 8 }}>
        <Text style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 600, color: navy }}>{title}</Text>
        <View style={{ width: 28, height: 2, backgroundColor: gold, marginTop: 3 }} />
      </View>
    ),
  };
  const sideHeading = (title: string) => (
    <View style={{ marginTop: 15, marginBottom: 7, flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ fontSize: 8.6, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', color: gold }}>{title}</Text>
      <View style={{ flex: 1, height: 0.6, backgroundColor: tint(navy, 0.35), marginLeft: 6 }} />
    </View>
  );
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.4, flexDirection: 'row', paddingVertical: 30 }}>
      <View fixed style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: W, backgroundColor: navy }} />
      <View fixed style={{ position: 'absolute', top: 0, bottom: 0, left: W, width: 3, backgroundColor: gold }} />
      <View style={{ width: W, paddingHorizontal: 20, color: '#e5e7eb' }}>
        {cv.settings.showPhoto && cv.photo ? (
          <View style={{ alignItems: 'center', marginBottom: 10 }}>
            <View style={{ padding: 3, borderRadius: cv.settings.photoShape === 'round' ? 64 : 8, borderWidth: 1.5, borderColor: gold }}>
              <Photo cv={cv} size={112} />
            </View>
          </View>
        ) : null}
        <SideColumn cv={cv} L={L} heading={sideHeading} text="#e5e7eb" muted="#9ca3af" dot={gold} dotOff={tint(navy, 0.3)} />
      </View>
      <View style={{ flex: 1, paddingLeft: 26, paddingRight: 30 }}>
        <Text style={{ fontFamily: SERIF, fontSize: 27, fontWeight: 700, color: navy, lineHeight: 1.1 }}>{fullName(cv.personal) || ' '}</Text>
        {cv.personal.title ? <Text style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: gold, marginTop: 5 }}>{cv.personal.title}</Text> : null}
        <MainColumn cv={cv} L={L} th={th} />
        <Certifications cv={cv} L={L} th={th} />
        <SignatureBlock cv={cv} L={L} />
      </View>
      <FreeMark cv={cv} left={W} />
    </Page>,
  );
}

/** Horizon : bandeau coupé en biais, photo à cheval, colonne claire à droite. Moderne et dynamique. */
function Horizon({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const BAND = 128;
  const SIDE = 178;
  const hasPhoto = cv.settings.showPhoto && !!cv.photo;
  const th: Theme = {
    accent,
    text: '#1f2937',
    muted: '#6b7280',
    head: FONT,
    heading: (title) => (
      <View minPresenceAhead={50} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 7 }}>
        <View style={{ width: 4, height: 13, borderRadius: 2, backgroundColor: accent, marginRight: 7 }} />
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#111827' }}>{title}</Text>
      </View>
    ),
  };
  const sideHeading = (title: string) => <Text style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: accent, marginTop: 14, marginBottom: 6 }}>{title}</Text>;
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.4, paddingBottom: 30 }}>
      <View fixed style={{ position: 'absolute', top: BAND - 10, bottom: 0, right: 0, width: SIDE, backgroundColor: tint(accent, 0.92) }} />
      <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={A4_W} height={BAND + 20}>
        <Polygon points={`0,0 ${A4_W},0 ${A4_W},${BAND - 18} 0,${BAND + 14}`} fill={accent} />
        <Polygon points={`0,${BAND + 14} ${A4_W},${BAND - 18} ${A4_W},${BAND - 12} 0,${BAND + 20}`} fill={tint(accent, 0.55)} />
      </Svg>
      <View style={{ height: BAND, paddingLeft: 36, paddingRight: hasPhoto ? 170 : 36, justifyContent: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>{fullName(cv.personal) || ' '}</Text>
        {cv.personal.title ? <Text style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: tint(accent, 0.75), marginTop: 5 }}>{cv.personal.title}</Text> : null}
      </View>
      {hasPhoto ? (
        <View style={{ position: 'absolute', top: 38, right: 40, padding: 4, backgroundColor: '#ffffff', borderRadius: cv.settings.photoShape === 'round' ? 64 : 10 }}>
          <Photo cv={cv} size={112} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        <View style={{ flex: 1, paddingLeft: 36, paddingRight: 20 }}>
          <MainColumn cv={cv} L={L} th={th} />
          <Certifications cv={cv} L={L} th={th} />
          <SignatureBlock cv={cv} L={L} />
        </View>
        <View style={{ width: SIDE, paddingHorizontal: 16, paddingTop: hasPhoto ? 22 : 0 }}>
          <SideColumn cv={cv} L={L} heading={sideHeading} text="#1f2937" muted="#6b7280" dot={accent} dotOff={tint(accent, 0.75)} tags={{ bg: '#ffffff', fg: '#1f2937' }} />
        </View>
      </View>
      <FreeMark cv={cv} right={SIDE} />
    </Page>,
  );
}

/** Atelier : monogramme, rubriques numérotées, compétences en étiquettes. Créatif mais lisible. */
function Atelier({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const initials = [cv.personal.firstName, cv.personal.lastName].map((x) => x.trim()[0] ?? '').join('').toUpperCase() || 'CV';
  const hasPhoto = cv.settings.showPhoto && !!cv.photo;
  const num = (n?: number) => (n === undefined ? '' : String(n + 1).padStart(2, '0'));
  const th: Theme = {
    accent,
    text: '#1f2937',
    muted: '#6b7280',
    head: SERIF,
    heading: (title, n) => (
      <View minPresenceAhead={50} style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 15, marginBottom: 7, borderBottomWidth: 0.8, borderBottomColor: tint(accent, 0.7), paddingBottom: 3 }}>
        {n !== undefined ? <Text style={{ fontSize: 15, fontWeight: 700, color: accent, marginRight: 8 }}>{num(n)}</Text> : null}
        <Text style={{ fontFamily: SERIF, fontSize: 13.5, fontWeight: 600, color: '#111827' }}>{title}</Text>
      </View>
    ),
  };
  const box = (title: string) => <Text style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: accent, marginBottom: 5, marginTop: 4 }}>{title}</Text>;
  const contacts = contactItems(cv, L);
  const sections: { key: string; node: ReactNode }[] = [];
  if (cv.skills.length)
    sections.push({
      key: 'skills',
      node: (
        <>
          {box(L.skills)}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cv.skills.map((s, i) => (
              <Text key={i} style={{ fontSize: 8.2, backgroundColor: tint(accent, 0.86), paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 9, marginRight: 4, marginBottom: 4 }}>
                {s}
              </Text>
            ))}
          </View>
        </>
      ),
    });
  if (cv.languages.length)
    sections.push({
      key: 'lang',
      node: (
        <>
          {box(L.languages)}
          {cv.languages.map((l) => (
            <View key={l.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <Text style={{ fontSize: 8.8, fontWeight: 600 }}>{l.name}</Text>
              {languageLevel(l.level) ? <Dots value={languageLevel(l.level)} on={accent} off={tint(accent, 0.8)} size={5.5} /> : <Text style={{ fontSize: 8, color: '#6b7280' }}>{l.level}</Text>}
            </View>
          ))}
        </>
      ),
    });
  if (cv.softSkills.length || cv.interests.length)
    sections.push({
      key: 'more',
      node: (
        <>
          {cv.softSkills.length ? (
            <>
              {box(L.softSkills)}
              <Text style={{ fontSize: 8.8, marginBottom: 6 }}>{cv.softSkills.join(' · ')}</Text>
            </>
          ) : null}
          {cv.interests.length ? (
            <>
              {box(L.interests)}
              <Text style={{ fontSize: 8.8 }}>{cv.interests.join(' · ')}</Text>
            </>
          ) : null}
        </>
      ),
    });
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.4, paddingVertical: 34, paddingLeft: 46, paddingRight: 38, color: '#1f2937' }}>
      <View fixed style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 12, backgroundColor: accent }} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {hasPhoto ? (
          <Photo cv={cv} size={78} />
        ) : (
          <View style={{ width: 66, height: 66, borderRadius: 14, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: '#ffffff' }}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>{fullName(cv.personal) || ' '}</Text>
          {cv.personal.title ? <Text style={{ fontSize: 10.5, fontWeight: 600, color: accent, marginTop: 3 }}>{cv.personal.title}</Text> : null}
          {contacts.length ? <Text style={{ fontSize: 8.4, color: '#4b5563', marginTop: 5 }}>{contacts.map((c) => c.value).join('   ·   ')}</Text> : null}
        </View>
      </View>
      <MainColumn cv={cv} L={L} th={th} />
      {sections.length ? (
        <View wrap={false} style={{ flexDirection: 'row', marginTop: 14, backgroundColor: tint(accent, 0.95), borderRadius: 8, padding: 12 }}>
          {sections.map((s, i) => (
            <View key={s.key} style={{ flex: 1, paddingLeft: i ? 12 : 0, marginLeft: i ? 12 : 0, borderLeftWidth: i ? 0.8 : 0, borderLeftColor: tint(accent, 0.75) }}>
              {s.node}
            </View>
          ))}
        </View>
      ) : null}
      <Certifications cv={cv} L={L} th={th} n={3} />
      <SignatureBlock cv={cv} L={L} />
      <FreeMark cv={cv} left={12} />
    </Page>,
  );
}

/** Signature : nom centré en capitales espacées, doubles filets, deux colonnes. Sobre et haut de gamme. */
function SignatureTpl({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const ink = '#1c1917';
  const contacts = contactItems(cv, L);
  const th: Theme = {
    accent,
    text: '#292524',
    muted: '#78716c',
    head: SERIF,
    heading: (title) => (
      <View minPresenceAhead={50} style={{ marginTop: 14, marginBottom: 7, alignItems: 'flex-start' }}>
        <Text style={{ fontFamily: SERIF, fontSize: 11, fontWeight: 600, letterSpacing: 2.2, textTransform: 'uppercase', color: accent }}>{title}</Text>
        <View style={{ width: '100%', height: 0.6, backgroundColor: tint(ink, 0.75), marginTop: 3 }} />
      </View>
    ),
  };
  const side = (title: string) => <Text style={{ fontFamily: SERIF, fontSize: 10, fontWeight: 600, letterSpacing: 1.8, textTransform: 'uppercase', color: accent, marginTop: 14, marginBottom: 6 }}>{title}</Text>;
  const rule: Style = { height: 0.8, backgroundColor: accent };
  return doc(
    cv,
    <Page size="A4" style={{ fontFamily: FONT, fontSize: 9.2, lineHeight: 1.45, paddingVertical: 36, paddingHorizontal: 44, color: '#292524' }}>
      <View style={{ alignItems: 'center' }}>
        {cv.settings.showPhoto && cv.photo ? (
          <View style={{ marginBottom: 10 }}>
            <Photo cv={cv} size={84} border={tint(accent, 0.6)} />
          </View>
        ) : null}
        <View style={{ width: '100%' }}>
          <Text style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 600, letterSpacing: 4, lineHeight: 1.25, color: ink, textAlign: 'center' }}>{(fullName(cv.personal) || ' ').toUpperCase()}</Text>
        </View>
        {cv.personal.title ? (
          <View style={{ width: '100%', marginTop: 4 }}>
            <Text style={{ fontSize: 10, letterSpacing: 2.5, lineHeight: 1.3, color: accent, textAlign: 'center' }}>{cv.personal.title.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ marginTop: 12 }}>
        <View style={rule} />
        <View style={[rule, { height: 0.4, marginTop: 1.5 }]} />
      </View>
      {contacts.length ? <Text style={{ fontSize: 8.5, color: '#57534e', textAlign: 'center', marginTop: 6, marginBottom: 2 }}>{contacts.map((c) => c.value).join('   |   ')}</Text> : null}
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        <View style={{ width: 150, paddingRight: 16, borderRightWidth: 0.6, borderRightColor: tint(ink, 0.8) }}>
          <SideColumn cv={{ ...cv, personal: { ...cv.personal, email: '', phone: '', address: '', city: '', country: '', linkedin: '', website: '', drivingLicense: '', birthDate: '' }, settings: { ...cv.settings, showNationality: false, showBirthDate: false } }} L={L} heading={side} text="#292524" muted="#78716c" dot={accent} dotOff={tint(accent, 0.8)} extra={<Certifications cv={cv} L={L} th={{ ...th, heading: (t) => side(t) }} />} />
        </View>
        <View style={{ flex: 1, paddingLeft: 18 }}>
          <MainColumn cv={cv} L={L} th={th} />
          <SignatureBlock cv={cv} L={L} />
        </View>
      </View>
      <FreeMark cv={cv} />
    </Page>,
  );
}

export function PremiumTemplate({ cv, id }: { cv: CvDocument; id: PremiumId }) {
  switch (id) {
    case 'prestige':
      return <Prestige cv={cv} />;
    case 'horizon':
      return <Horizon cv={cv} />;
    case 'atelier':
      return <Atelier cv={cv} />;
    default:
      return <SignatureTpl cv={cv} />;
  }
}
