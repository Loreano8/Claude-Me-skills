import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { CvDocument } from '../../types.ts';
import { achievementsList, fullName } from '../../lib/cv.ts';
import { LABELS } from '../labels.ts';
import { Bullets, Photo, SignatureBlock, FreeMark } from '../parts.tsx';
import { FONT, contactItems, dateRange, tint } from '../theme.ts';

const DATE_COL = 92;

const s = StyleSheet.create({
  // paddingTop sert aux pages suivantes ; le bandeau de la 1re page remonte avec une marge négative.
  page: { fontFamily: FONT, fontSize: 9.3, color: '#1f2937', lineHeight: 1.42, paddingTop: 32, paddingBottom: 32 },
  band: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 24, marginTop: -32 },
  name: { fontSize: 24, fontWeight: 700, color: '#ffffff', lineHeight: 1.15 },
  title: { fontSize: 11, fontWeight: 500, letterSpacing: 0.7, textTransform: 'uppercase', marginTop: 5 },
  contacts: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 40, paddingVertical: 9, fontSize: 8.6, color: '#374151' },
  body: { paddingHorizontal: 40 },
  heading: { fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 7, letterSpacing: 0.4 },
  item: { flexDirection: 'row', marginBottom: 9 },
  dateCol: { width: DATE_COL, fontSize: 8.6, fontWeight: 600, paddingTop: 1.5, paddingRight: 8 },
  itemTitle: { fontSize: 10.2, fontWeight: 700 },
  org: { color: '#4b5563', fontWeight: 500 },
  chip: { paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 9, marginRight: 5, marginBottom: 5, fontSize: 8.6 },
});

function Heading({ children, accent }: { children: string; accent: string }) {
  return (
    <View minPresenceAhead={40} style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={[s.heading, { color: accent }]}>{children.toUpperCase()}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: tint(accent, 0.75), marginLeft: 8, marginTop: 9 }} />
    </View>
  );
}

export function ElegantTemplate({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const contacts = contactItems(cv, L);

  return (
    <Document title={`CV – ${fullName(cv.personal)}`} author={fullName(cv.personal)} creator="CV Studio">
      <Page size="A4" style={s.page}>
        <View style={[s.band, { backgroundColor: accent }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{fullName(cv.personal) || ' '}</Text>
            {cv.personal.title ? <Text style={[s.title, { color: tint(accent, 0.7) }]}>{cv.personal.title}</Text> : null}
          </View>
          {cv.settings.showPhoto && cv.photo ? <Photo cv={cv} size={92} border="#ffffff" /> : null}
        </View>

        {contacts.length > 0 && (
          <View style={[s.contacts, { backgroundColor: tint(accent, 0.92) }]}>
            {contacts.map((c, i) => (
              <Text key={i} style={{ marginRight: 14 }}>
                {c.value}
              </Text>
            ))}
          </View>
        )}

        <View style={s.body}>
          {cv.summary ? (
            <View>
              <Heading accent={accent}>{L.profile}</Heading>
              <Text style={{ textAlign: 'justify' }}>{cv.summary}</Text>
            </View>
          ) : null}

          {cv.experiences.length > 0 && (
            <View>
              <Heading accent={accent}>{L.experience}</Heading>
              {cv.experiences.map((e) => (
                <View key={e.id} style={s.item}>
                  <Text style={[s.dateCol, { color: accent }]}>{dateRange(e.startDate, e.endDate, e.current, L)}</Text>
                  <View style={{ flex: 1 }}>
                    <View wrap={false}>
                      <Text style={s.itemTitle}>{e.position}</Text>
                      <Text style={s.org}>{[e.company, e.location].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <Bullets items={achievementsList(e.achievements)} color={accent} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {cv.education.length > 0 && (
            <View>
              <Heading accent={accent}>{L.education}</Heading>
              {cv.education.map((e) => (
                <View key={e.id} style={s.item} wrap={false}>
                  <Text style={[s.dateCol, { color: accent }]}>{dateRange(e.startDate, e.endDate, false, L)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemTitle}>{e.degree}</Text>
                    <Text style={s.org}>{[e.school, e.location].filter(Boolean).join(' · ')}</Text>
                    {e.details ? <Text style={{ marginTop: 1 }}>{e.details}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          {cv.skills.length > 0 && (
            <View wrap={false}>
              <Heading accent={accent}>{L.skills}</Heading>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {cv.skills.map((k, i) => (
                  <Text key={i} style={[s.chip, { backgroundColor: tint(accent, 0.86), color: accent }]}>
                    {k}
                  </Text>
                ))}
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row' }}>
            {(cv.softSkills.length > 0 || cv.interests.length > 0) && (
              <View style={{ flex: 1, paddingRight: 14 }} wrap={false}>
                {cv.softSkills.length > 0 && (
                  <View>
                    <Heading accent={accent}>{L.softSkills}</Heading>
                    <Bullets items={cv.softSkills} color={accent} />
                  </View>
                )}
                {cv.interests.length > 0 && (
                  <View>
                    <Heading accent={accent}>{L.interests}</Heading>
                    <Text>{cv.interests.join(' · ')}</Text>
                  </View>
                )}
              </View>
            )}
            {(cv.languages.length > 0 || cv.certifications.length > 0) && (
              <View style={{ flex: 1 }} wrap={false}>
                {cv.languages.length > 0 && (
                  <View>
                    <Heading accent={accent}>{L.languages}</Heading>
                    {cv.languages.map((l) => (
                      <Text key={l.id} style={{ marginBottom: 2 }}>
                        <Text style={{ fontWeight: 600 }}>{l.name}</Text>
                        {l.level ? ` (${l.level})` : ''}
                      </Text>
                    ))}
                  </View>
                )}
                {cv.certifications.length > 0 && (
                  <View>
                    <Heading accent={accent}>{L.certifications}</Heading>
                    {cv.certifications.map((c) => (
                      <Text key={c.id} style={{ marginBottom: 2 }}>
                        <Text style={{ fontWeight: 600 }}>{c.name}</Text>
                        {[c.issuer, c.date].filter(Boolean).length ? `, ${[c.issuer, c.date].filter(Boolean).join(', ')}` : ''}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          <SignatureBlock cv={cv} L={L} />
        </View>
        <FreeMark cv={cv} />
      </Page>
    </Document>
  );
}
