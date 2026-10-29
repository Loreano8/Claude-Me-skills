import type { ReactNode } from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { TemplateStyle } from '../../../shared/schema.ts';
import type { CvDocument } from '../../types.ts';
import { achievementsList, fullName } from '../../lib/cv.ts';
import { LABELS, type Labels } from '../labels.ts';
import { Bullets, Photo, SignatureBlock, FreeMark } from '../parts.tsx';
import { FONT, SERIF, contactItems, dateRange, tint } from '../theme.ts';

// Moteur de mise en page : un seul composant produit tous les modèles décrits par une fiche de style
// (catalogue CVCasa, ou style repris d'un CV importé par l'utilisateur).

const SIDEBAR = 178;
const LABEL_COL = 112;

const DENSITY = {
  compact: { font: 8.9, gap: 11, pad: 28, item: 7 },
  normal: { font: 9.3, gap: 14, pad: 34, item: 9 },
  airy: { font: 9.7, gap: 18, pad: 42, item: 11 },
} as const;

/** Couleurs d'une zone : page blanche, ou colonne latérale (couleur, teinte claire, foncé). */
interface Palette {
  text: string;
  muted: string;
  heading: string;
  rule: string;
  tagBg: string;
  tagText: string;
  bullet: string;
}

interface Ctx {
  cv: CvDocument;
  st: TemplateStyle;
  L: Labels;
  d: (typeof DENSITY)[keyof typeof DENSITY];
  body: string;
  head: string;
}

function pagePalette(accent: string): Palette {
  return { text: '#1f2937', muted: '#6b7280', heading: accent, rule: tint(accent, 0.7), tagBg: tint(accent, 0.88), tagText: '#1f2937', bullet: accent };
}

function sidebarPalette(st: TemplateStyle): Palette & { bg: string } {
  const a = st.accent;
  if (st.sidebarTone === 'light') {
    return { bg: tint(a, 0.9), text: '#1f2937', muted: '#4b5563', heading: a, rule: tint(a, 0.6), tagBg: '#ffffff', tagText: '#1f2937', bullet: a };
  }
  const bg = st.sidebarTone === 'dark' ? '#1f2937' : a;
  const soft = st.sidebarTone === 'dark' ? tint(a, 0.55) : tint(a, 0.75);
  return { bg, text: '#ffffff', muted: soft, heading: st.sidebarTone === 'dark' ? soft : '#ffffff', rule: 'rgba(255,255,255,0.35)', tagBg: 'rgba(255,255,255,0.16)', tagText: '#ffffff', bullet: soft };
}

function Heading({ children, c, p, minPresenceAhead = 40 }: { children: string; c: Ctx; p: Palette; minPresenceAhead?: number }) {
  const common: Style = { fontFamily: c.head, fontWeight: 700, marginTop: c.d.gap, marginBottom: 6 };
  switch (c.st.headingStyle) {
    case 'caps':
      return (
        <Text minPresenceAhead={minPresenceAhead} style={{ ...common, fontSize: 9.6, letterSpacing: 0.6, textTransform: 'uppercase', color: p.heading }}>
          {children}
        </Text>
      );
    case 'bar':
      return (
        <View wrap={false} minPresenceAhead={minPresenceAhead} style={{ ...common, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 3, height: 12, backgroundColor: p.bullet, marginRight: 6, borderRadius: 1 }} />
          <Text style={{ fontSize: 11, color: p.text === '#ffffff' ? '#ffffff' : '#111827' }}>{children}</Text>
        </View>
      );
    case 'pill': {
      const onColor = p.text === '#ffffff';
      return (
        <View wrap={false} minPresenceAhead={minPresenceAhead} style={{ ...common, flexDirection: 'row' }}>
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: onColor ? c.st.accent : '#ffffff',
              backgroundColor: onColor ? '#ffffff' : c.st.accent,
              paddingVertical: 2.5,
              paddingHorizontal: 7,
              borderRadius: 4,
            }}
          >
            {children}
          </Text>
        </View>
      );
    }
    case 'plain':
      return (
        <Text minPresenceAhead={minPresenceAhead} style={{ ...common, fontSize: 12, color: p.text === '#ffffff' ? '#ffffff' : '#111827' }}>
          {children}
        </Text>
      );
    default:
      return (
        <Text
          minPresenceAhead={minPresenceAhead}
          style={{ ...common, fontSize: 11, color: p.heading, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: p.rule }}
        >
          {children}
        </Text>
      );
  }
}

function Tags({ items, p }: { items: string[]; p: Palette }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {items.map((t, i) => (
        <Text key={i} style={{ fontSize: 8.4, backgroundColor: p.tagBg, color: p.tagText, paddingVertical: 2, paddingHorizontal: 5, borderRadius: 3, marginRight: 4, marginBottom: 4 }}>
          {t}
        </Text>
      ))}
    </View>
  );
}

function SkillList({ items, c, p, forceList }: { items: string[]; c: Ctx; p: Palette; forceList?: boolean }) {
  if (c.st.skillsStyle === 'tags') return <Tags items={items} p={p} />;
  if (c.st.skillsStyle === 'inline' && !forceList) return <Text>{items.join(' · ')}</Text>;
  return <Bullets items={items} color={p.bullet} />;
}

// ---- Blocs de contenu --------------------------------------------------------

function Summary({ c, p }: { c: Ctx; p: Palette }) {
  if (!c.cv.summary) return null;
  return <Text style={{ textAlign: 'justify', color: p.text }}>{c.cv.summary}</Text>;
}

function Experiences({ c, p }: { c: Ctx; p: Palette }) {
  return (
    <>
      {c.cv.experiences.map((e) => (
        <View key={e.id} style={{ marginBottom: c.d.item }}>
          <View wrap={false}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <Text style={{ flex: 1, fontFamily: c.head, fontWeight: 700, fontSize: c.d.font + 1 }}>{e.position}</Text>
              <Text style={{ fontSize: c.d.font - 0.7, color: p.muted, marginLeft: 8 }}>{dateRange(e.startDate, e.endDate, e.current, c.L)}</Text>
            </View>
            <Text style={{ color: c.st.accent, fontWeight: 600, marginTop: 1 }}>{[e.company, e.location].filter(Boolean).join(' · ')}</Text>
          </View>
          <Bullets items={achievementsList(e.achievements)} color={p.bullet} />
        </View>
      ))}
    </>
  );
}

function Educations({ c, p }: { c: Ctx; p: Palette }) {
  return (
    <>
      {c.cv.education.map((e) => (
        <View key={e.id} wrap={false} style={{ marginBottom: c.d.item - 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={{ flex: 1, fontFamily: c.head, fontWeight: 700, fontSize: c.d.font + 0.6 }}>{e.degree}</Text>
            <Text style={{ fontSize: c.d.font - 0.7, color: p.muted, marginLeft: 8 }}>{dateRange(e.startDate, e.endDate, false, c.L)}</Text>
          </View>
          <Text style={{ color: c.st.accent, fontWeight: 600, marginTop: 1 }}>{[e.school, e.location].filter(Boolean).join(' · ')}</Text>
          {e.details ? <Text style={{ color: p.muted, marginTop: 1 }}>{e.details}</Text> : null}
        </View>
      ))}
    </>
  );
}

function Certifications({ c }: { c: Ctx }) {
  return (
    <>
      {c.cv.certifications.map((x) => (
        <Text key={x.id} style={{ marginBottom: 3 }}>
          <Text style={{ fontWeight: 600 }}>{x.name}</Text>
          {[x.issuer, x.date].filter(Boolean).length ? `, ${[x.issuer, x.date].filter(Boolean).join(', ')}` : ''}
        </Text>
      ))}
    </>
  );
}

function LanguagesBlock({ c, p, inline }: { c: Ctx; p: Palette; inline: boolean }) {
  if (inline) return <Text>{c.cv.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(' · ')}</Text>;
  return (
    <>
      {c.cv.languages.map((l) => (
        <View key={l.id} style={{ marginBottom: 4 }}>
          <Text style={{ fontWeight: 600 }}>{l.name}</Text>
          {l.level ? <Text style={{ fontSize: c.d.font - 0.6, color: p.muted }}>{l.level}</Text> : null}
        </View>
      ))}
    </>
  );
}

interface Block {
  key: string;
  title: string;
  node: ReactNode;
  ahead?: number;
}

/** Sections principales, dans l'ordre du modèle. */
function mainBlocks(c: Ctx, p: Palette): Block[] {
  const { cv, L } = c;
  const exp: Block | false = cv.experiences.length > 0 && { key: 'exp', title: L.experience, node: <Experiences c={c} p={p} />, ahead: 70 };
  const edu: Block | false = cv.education.length > 0 && { key: 'edu', title: L.education, node: <Educations c={c} p={p} /> };
  return [
    !!cv.summary && { key: 'sum', title: L.profile, node: <Summary c={c} p={p} /> },
    ...(c.st.educationFirst ? [edu, exp] : [exp, edu]),
    cv.certifications.length > 0 && { key: 'cert', title: L.certifications, node: <Certifications c={c} /> },
  ].filter((b): b is Block => Boolean(b));
}

/** Sections secondaires : colonne latérale, ou bas de page dans les modèles à une colonne. */
function sideBlocks(c: Ctx, p: Palette, inSidebar: boolean): Block[] {
  const { cv, L } = c;
  const blocks: (Block | false)[] = [
    cv.skills.length > 0 && { key: 'skills', title: L.skills, node: <SkillList items={cv.skills} c={c} p={p} /> },
    cv.softSkills.length > 0 && { key: 'soft', title: L.softSkills, node: <SkillList items={cv.softSkills} c={c} p={p} /> },
    cv.languages.length > 0 && { key: 'lang', title: L.languages, node: <LanguagesBlock c={c} p={p} inline={!inSidebar} /> },
    cv.interests.length > 0 && { key: 'int', title: L.interests, node: <Text>{cv.interests.join(' · ')}</Text> },
  ];
  return blocks.filter((b): b is Block => Boolean(b));
}

function Sections({ blocks, c, p }: { blocks: Block[]; c: Ctx; p: Palette }) {
  return (
    <>
      {blocks.map((b) => (
        <View key={b.key}>
          <Heading c={c} p={p} minPresenceAhead={b.ahead}>
            {b.title}
          </Heading>
          {b.node}
        </View>
      ))}
    </>
  );
}

/** Style Europass : titre de section dans la marge de gauche, contenu à droite. */
function LabelledSections({ blocks, c }: { blocks: Block[]; c: Ctx }) {
  return (
    <>
      {blocks.map((b) => (
        <View key={b.key} style={{ flexDirection: 'row', marginTop: c.d.gap }}>
          <Text minPresenceAhead={b.ahead} style={{ width: LABEL_COL, paddingRight: 12, textAlign: 'right', fontFamily: c.head, fontWeight: 700, fontSize: 9.4, color: c.st.accent, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {b.title}
          </Text>
          <View style={{ flex: 1, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: tint(c.st.accent, 0.7) }}>{b.node}</View>
        </View>
      ))}
    </>
  );
}

// ---- En-têtes ----------------------------------------------------------------

function ContactLine({ c, color, center }: { c: Ctx; color: string; center?: boolean }) {
  const items = contactItems(c.cv, c.L);
  if (items.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: center ? 'center' : 'flex-start', marginTop: 6 }}>
      {items.map((it, i) => (
        <Text key={i} style={{ fontSize: c.d.font - 0.5, color, marginRight: 12, marginBottom: 2 }}>
          {it.value}
        </Text>
      ))}
    </View>
  );
}

function NameBlock({ c, color, titleColor, center }: { c: Ctx; color: string; titleColor: string; center?: boolean }) {
  return (
    <View style={{ alignItems: center ? 'center' : 'flex-start' }}>
      <Text style={{ fontFamily: c.head, fontWeight: 700, fontSize: 24, lineHeight: 1.15, color, textAlign: center ? 'center' : 'left' }}>{fullName(c.cv.personal) || ' '}</Text>
      {c.cv.personal.title ? (
        <Text style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.7, textTransform: 'uppercase', color: titleColor, marginTop: 4, textAlign: center ? 'center' : 'left' }}>
          {c.cv.personal.title}
        </Text>
      ) : null}
    </View>
  );
}

function PageHeader({ c }: { c: Ctx }) {
  const center = c.st.headerAlign === 'center';
  const hasPhoto = c.cv.settings.showPhoto && !!c.cv.photo;
  if (center) {
    return (
      <View style={{ alignItems: 'center', paddingBottom: 8, borderBottomWidth: c.st.headingStyle === 'underline' ? 0 : 1, borderBottomColor: tint(c.st.accent, 0.75) }}>
        {hasPhoto ? (
          <View style={{ marginBottom: 8 }}>
            <Photo cv={c.cv} size={78} />
          </View>
        ) : null}
        <NameBlock c={c} color={c.st.accent} titleColor="#4b5563" center />
        <ContactLine c={c} color="#4b5563" center />
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1 }}>
        <NameBlock c={c} color={c.st.accent} titleColor="#4b5563" />
        <ContactLine c={c} color="#4b5563" />
      </View>
      {hasPhoto ? (
        <View style={{ marginLeft: 16 }}>
          <Photo cv={c.cv} size={84} />
        </View>
      ) : null}
    </View>
  );
}

function Banner({ c }: { c: Ctx }) {
  const center = c.st.headerAlign === 'center';
  const hasPhoto = c.cv.settings.showPhoto && !!c.cv.photo;
  const light = tint(c.st.accent, 0.78);
  return (
    <View style={{ backgroundColor: c.st.accent, marginTop: -c.d.pad, paddingHorizontal: c.d.pad, paddingVertical: 24, flexDirection: center ? 'column' : 'row', alignItems: 'center' }}>
      {hasPhoto && center ? (
        <View style={{ marginBottom: 8 }}>
          <Photo cv={c.cv} size={76} border={light} />
        </View>
      ) : null}
      <View style={{ flex: center ? undefined : 1 }}>
        <NameBlock c={c} color="#ffffff" titleColor={light} center={center} />
        <ContactLine c={c} color="#ffffff" center={center} />
      </View>
      {hasPhoto && !center ? (
        <View style={{ marginLeft: 16 }}>
          <Photo cv={c.cv} size={84} border={light} />
        </View>
      ) : null}
    </View>
  );
}

// ---- Pages -------------------------------------------------------------------

export function StudioTemplate({ cv, style }: { cv: CvDocument; style: TemplateStyle }) {
  const st = { ...style, accent: /^#[0-9a-f]{6}$/i.test(style.accent) ? style.accent : '#1f2937' };
  const d = DENSITY[st.density];
  const c: Ctx = {
    cv,
    st,
    L: LABELS[cv.settings.headingLang],
    d,
    body: st.font === 'serif' ? SERIF : FONT,
    head: st.font === 'sans' ? FONT : SERIF,
  };
  const page: Style = { fontFamily: c.body, fontSize: d.font, color: '#1f2937', lineHeight: 1.4 };
  const p = pagePalette(st.accent);
  const markInset = st.layout === 'sidebar-left' ? { left: SIDEBAR } : st.layout === 'sidebar-right' ? { right: SIDEBAR } : {};
  const doc = (children: ReactNode, pageStyle: Style) => (
    <Document title={`CV – ${fullName(cv.personal)}`} author={fullName(cv.personal)} creator="CVCasa">
      <Page size="A4" style={{ ...page, ...pageStyle }}>
        {children}
        <FreeMark cv={cv} {...markInset} />
      </Page>
    </Document>
  );

  if (st.layout === 'sidebar-left' || st.layout === 'sidebar-right') {
    const sp = sidebarPalette(st);
    const right = st.layout === 'sidebar-right';
    const contacts = contactItems(cv, c.L);
    const sidebar = (
      <View style={{ width: SIDEBAR, paddingHorizontal: 16, color: sp.text }}>
        {cv.settings.showPhoto && cv.photo ? (
          <View style={{ alignItems: 'center', marginBottom: 4 }}>
            <Photo cv={cv} size={108} border={sp.text === '#ffffff' ? tint(st.accent, 0.3) : '#ffffff'} />
          </View>
        ) : null}
        {contacts.length > 0 && (
          <View>
            <Heading c={c} p={sp}>
              {c.L.contact}
            </Heading>
            {contacts.map((it, i) => (
              <Text key={i} style={{ marginBottom: 4, fontSize: d.font - 0.6 }}>
                {it.value}
              </Text>
            ))}
          </View>
        )}
        <Sections blocks={sideBlocks(c, sp, true)} c={c} p={sp} />
      </View>
    );
    const main = (
      <View style={{ flex: 1, paddingLeft: right ? d.pad - 4 : 24, paddingRight: right ? 22 : d.pad - 6 }}>
        <NameBlock c={c} color={st.accent} titleColor="#4b5563" />
        <Sections blocks={mainBlocks(c, p)} c={c} p={p} />
        <SignatureBlock cv={cv} L={c.L} />
      </View>
    );
    return doc(
      <>
        <View fixed style={{ position: 'absolute', top: 0, bottom: 0, width: SIDEBAR, backgroundColor: sp.bg, ...(right ? { right: 0 } : { left: 0 }) }} />
        {right ? main : sidebar}
        {right ? sidebar : main}
      </>,
      { flexDirection: 'row', paddingVertical: 30 },
    );
  }

  const blocks = [...mainBlocks(c, p), ...sideBlocks(c, p, false)];

  if (st.layout === 'banner') {
    return doc(
      <>
        <Banner c={c} />
        <View style={{ paddingHorizontal: d.pad }}>
          <Sections blocks={blocks} c={c} p={p} />
          <SignatureBlock cv={cv} L={c.L} />
        </View>
      </>,
      // Marge haute sur toutes les pages ; le bandeau la compense (marge négative) pour toucher le bord sur la première.
      { paddingVertical: d.pad },
    );
  }

  return doc(
    <>
      <PageHeader c={c} />
      {st.layout === 'labels' ? <LabelledSections blocks={blocks} c={c} /> : <Sections blocks={blocks} c={c} p={p} />}
      <SignatureBlock cv={cv} L={c.L} />
    </>,
    { padding: d.pad },
  );
}
