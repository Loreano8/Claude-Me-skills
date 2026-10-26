import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { CvDocument } from '../../types.ts';
import { achievementsList, fullName } from '../../lib/cv.ts';
import { LABELS } from '../labels.ts';
import { Bullets, Photo, SignatureBlock, FreeMark } from '../parts.tsx';
import { FONT, contactItems, dateRange, tint } from '../theme.ts';

const SIDEBAR = 182;

const s = StyleSheet.create({
  page: { fontFamily: FONT, fontSize: 9.2, color: '#1f2937', lineHeight: 1.4, paddingVertical: 30, flexDirection: 'row' },
  sidebarBg: { position: 'absolute', top: 0, bottom: 0, left: 0, width: SIDEBAR },
  sidebar: { width: SIDEBAR, paddingHorizontal: 18, color: '#ffffff' },
  main: { flex: 1, paddingLeft: 24, paddingRight: 28 },
  name: { fontSize: 23, fontWeight: 700, lineHeight: 1.15 },
  title: { fontSize: 10.5, fontWeight: 500, letterSpacing: 0.7, textTransform: 'uppercase', color: '#4b5563', marginTop: 4 },
  sideHeading: { fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 16, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.35)' },
  heading: { fontSize: 10.5, fontWeight: 700, letterSpacing: 0.9, textTransform: 'uppercase', marginTop: 16, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1 },
  itemTitle: { fontSize: 10.2, fontWeight: 700, flex: 1 },
  dates: { fontSize: 8.6, color: '#6b7280', marginLeft: 8 },
  org: { fontWeight: 500, marginTop: 1 },
});

export function ModernTemplate({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const light = tint(accent, 0.75);
  const contacts = contactItems(cv, L);

  return (
    <Document title={`CV – ${fullName(cv.personal)}`} author={fullName(cv.personal)} creator="CV Studio">
      <Page size="A4" style={s.page}>
        <View fixed style={[s.sidebarBg, { backgroundColor: accent }]} />

        <View style={s.sidebar}>
          {cv.settings.showPhoto && cv.photo ? (
            <View style={{ alignItems: 'center', marginBottom: 4 }}>
              <Photo cv={cv} size={112} border={tint(accent, 0.3)} />
            </View>
          ) : null}

          {contacts.length > 0 && (
            <View>
              <Text style={s.sideHeading}>{L.contact}</Text>
              {contacts.map((c, i) => (
                <Text key={i} style={{ marginBottom: 4, fontSize: 8.6 }}>
                  {c.value}
                </Text>
              ))}
            </View>
          )}

          {cv.skills.length > 0 && (
            <View>
              <Text style={s.sideHeading}>{L.skills}</Text>
              <Bullets items={cv.skills} color={light} style={{ fontSize: 8.8 }} />
            </View>
          )}

          {cv.softSkills.length > 0 && (
            <View>
              <Text style={s.sideHeading}>{L.softSkills}</Text>
              <Bullets items={cv.softSkills} color={light} style={{ fontSize: 8.8 }} />
            </View>
          )}

          {cv.languages.length > 0 && (
            <View>
              <Text style={s.sideHeading}>{L.languages}</Text>
              {cv.languages.map((l) => (
                <View key={l.id} style={{ marginBottom: 4 }}>
                  <Text style={{ fontWeight: 600, fontSize: 8.8 }}>{l.name}</Text>
                  {l.level ? <Text style={{ fontSize: 8.4, color: light }}>{l.level}</Text> : null}
                </View>
              ))}
            </View>
          )}

          {cv.interests.length > 0 && (
            <View>
              <Text style={s.sideHeading}>{L.interests}</Text>
              <Text style={{ fontSize: 8.8 }}>{cv.interests.join(' · ')}</Text>
            </View>
          )}
        </View>

        <View style={s.main}>
          <Text style={[s.name, { color: accent }]}>{fullName(cv.personal) || ' '}</Text>
          {cv.personal.title ? <Text style={s.title}>{cv.personal.title}</Text> : null}

          {cv.summary ? (
            <View>
              <Text style={[s.heading, { color: accent, borderBottomColor: light }]}>{L.profile}</Text>
              <Text style={{ textAlign: 'justify' }}>{cv.summary}</Text>
            </View>
          ) : null}

          {cv.experiences.length > 0 && (
            <View>
              <Text minPresenceAhead={60} style={[s.heading, { color: accent, borderBottomColor: light }]}>
                {L.experience}
              </Text>
              {cv.experiences.map((e) => (
                <View key={e.id} style={{ marginBottom: 9 }}>
                  <View wrap={false}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                      <Text style={s.itemTitle}>{e.position}</Text>
                      <Text style={s.dates}>{dateRange(e.startDate, e.endDate, e.current, L)}</Text>
                    </View>
                    <Text style={[s.org, { color: accent }]}>{[e.company, e.location].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Bullets items={achievementsList(e.achievements)} color={accent} />
                </View>
              ))}
            </View>
          )}

          {cv.education.length > 0 && (
            <View>
              <Text minPresenceAhead={40} style={[s.heading, { color: accent, borderBottomColor: light }]}>
                {L.education}
              </Text>
              {cv.education.map((e) => (
                <View key={e.id} wrap={false} style={{ marginBottom: 7 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                    <Text style={s.itemTitle}>{e.degree}</Text>
                    <Text style={s.dates}>{dateRange(e.startDate, e.endDate, false, L)}</Text>
                  </View>
                  <Text style={[s.org, { color: accent }]}>{[e.school, e.location].filter(Boolean).join(' · ')}</Text>
                  {e.details ? <Text style={{ color: '#4b5563', marginTop: 1 }}>{e.details}</Text> : null}
                </View>
              ))}
            </View>
          )}

          {cv.certifications.length > 0 && (
            <View>
              <Text minPresenceAhead={30} style={[s.heading, { color: accent, borderBottomColor: light }]}>
                {L.certifications}
              </Text>
              {cv.certifications.map((c) => (
                <Text key={c.id} style={{ marginBottom: 3 }}>
                  <Text style={{ fontWeight: 600 }}>{c.name}</Text>
                  {[c.issuer, c.date].filter(Boolean).length ? ` — ${[c.issuer, c.date].filter(Boolean).join(', ')}` : ''}
                </Text>
              ))}
            </View>
          )}

          <SignatureBlock cv={cv} L={L} />
        </View>
        <FreeMark cv={cv} left={SIDEBAR} />
      </Page>
    </Document>
  );
}
