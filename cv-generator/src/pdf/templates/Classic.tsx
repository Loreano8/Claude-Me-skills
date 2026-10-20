import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { CvDocument } from '../../types.ts';
import { achievementsList, fullName } from '../../lib/cv.ts';
import { LABELS } from '../labels.ts';
import { Bullets, Photo, SignatureBlock } from '../parts.tsx';
import { FONT, contactItems, dateRange } from '../theme.ts';

// Une seule colonne, intitulés standards : c'est la mise en page la mieux lue par les ATS.
const s = StyleSheet.create({
  page: { fontFamily: FONT, fontSize: 9.6, color: '#111827', lineHeight: 1.4, paddingVertical: 36, paddingHorizontal: 42 },
  name: { fontSize: 22, fontWeight: 700, lineHeight: 1.15 },
  title: { fontSize: 11.5, fontWeight: 500, marginTop: 3 },
  contact: { flexDirection: 'row', flexWrap: 'wrap', fontSize: 8.8, color: '#374151', marginTop: 6 },
  heading: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 14, marginBottom: 6, paddingBottom: 2, borderBottomWidth: 1.2 },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  itemTitle: { fontWeight: 700, fontSize: 10.2, flex: 1 },
  dates: { fontSize: 9, color: '#374151', marginLeft: 8 },
  org: { fontStyle: 'italic', color: '#374151' },
  label: { fontWeight: 700 },
});

export function ClassicTemplate({ cv }: { cv: CvDocument }) {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const contacts = contactItems(cv, L);
  const heading = [s.heading, { color: accent, borderBottomColor: accent }];

  return (
    <Document title={`CV – ${fullName(cv.personal)}`} author={fullName(cv.personal)} creator="CV Studio">
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={[s.name, { color: accent }]}>{fullName(cv.personal) || ' '}</Text>
            {cv.personal.title ? <Text style={s.title}>{cv.personal.title}</Text> : null}
            {contacts.length > 0 && (
              <View style={s.contact}>
                {contacts.map((c, i) => (
                  <Text key={i}>
                    {c.value}
                    {i < contacts.length - 1 ? <Text style={{ color: '#9ca3af' }}>{'  |  '}</Text> : null}
                  </Text>
                ))}
              </View>
            )}
          </View>
          {cv.settings.showPhoto && cv.photo ? (
            <View style={{ marginLeft: 16 }}>
              <Photo cv={cv} size={86} />
            </View>
          ) : null}
        </View>

        {cv.summary ? (
          <View>
            <Text style={heading}>{L.profile}</Text>
            <Text style={{ textAlign: 'justify' }}>{cv.summary}</Text>
          </View>
        ) : null}

        {cv.experiences.length > 0 && (
          <View>
            <Text minPresenceAhead={60} style={heading}>
              {L.experience}
            </Text>
            {cv.experiences.map((e) => (
              <View key={e.id} style={{ marginBottom: 8 }}>
                <View wrap={false}>
                  <View style={s.row}>
                    <Text style={s.itemTitle}>{e.position}</Text>
                    <Text style={s.dates}>{dateRange(e.startDate, e.endDate, e.current, L)}</Text>
                  </View>
                  <Text style={s.org}>{[e.company, e.location].filter(Boolean).join(', ')}</Text>
                </View>
                <Bullets items={achievementsList(e.achievements)} color="#111827" />
              </View>
            ))}
          </View>
        )}

        {cv.education.length > 0 && (
          <View>
            <Text minPresenceAhead={40} style={heading}>
              {L.education}
            </Text>
            {cv.education.map((e) => (
              <View key={e.id} wrap={false} style={{ marginBottom: 6 }}>
                <View style={s.row}>
                  <Text style={s.itemTitle}>{e.degree}</Text>
                  <Text style={s.dates}>{dateRange(e.startDate, e.endDate, false, L)}</Text>
                </View>
                <Text style={s.org}>{[e.school, e.location].filter(Boolean).join(', ')}</Text>
                {e.details ? <Text>{e.details}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {(cv.skills.length > 0 || cv.softSkills.length > 0 || cv.languages.length > 0) && (
          <View wrap={false}>
            <Text style={heading}>{L.skills}</Text>
            {cv.skills.length > 0 && (
              <Text style={{ marginBottom: 3 }}>
                <Text style={s.label}>{L.skills} : </Text>
                {cv.skills.join(', ')}
              </Text>
            )}
            {cv.softSkills.length > 0 && (
              <Text style={{ marginBottom: 3 }}>
                <Text style={s.label}>{L.softSkills} : </Text>
                {cv.softSkills.join(', ')}
              </Text>
            )}
            {cv.languages.length > 0 && (
              <Text style={{ marginBottom: 3 }}>
                <Text style={s.label}>{L.languages} : </Text>
                {cv.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(', ')}
              </Text>
            )}
          </View>
        )}

        {cv.certifications.length > 0 && (
          <View wrap={false}>
            <Text style={heading}>{L.certifications}</Text>
            {cv.certifications.map((c) => (
              <Text key={c.id} style={{ marginBottom: 2 }}>
                <Text style={{ fontWeight: 600 }}>{c.name}</Text>
                {[c.issuer, c.date].filter(Boolean).length ? `, ${[c.issuer, c.date].filter(Boolean).join(', ')}` : ''}
              </Text>
            ))}
          </View>
        )}

        {cv.interests.length > 0 && (
          <View wrap={false}>
            <Text style={heading}>{L.interests}</Text>
            <Text>{cv.interests.join(', ')}</Text>
          </View>
        )}

        <SignatureBlock cv={cv} L={L} />
      </Page>
    </Document>
  );
}
