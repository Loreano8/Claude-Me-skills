import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { CoverLetter, CvDocument } from '../types.ts';
import { fullName } from '../lib/cv.ts';
import { letterParagraphs } from './letterText.ts';
import { FONT } from './theme.ts';

const s = StyleSheet.create({
  page: { fontFamily: FONT, fontSize: 10.2, color: '#111827', lineHeight: 1.5, paddingVertical: 48, paddingHorizontal: 56 },
  sender: { fontSize: 9.6, lineHeight: 1.45 },
  recipient: { marginLeft: 270, marginTop: 18, fontSize: 9.8 },
  date: { marginLeft: 270, marginTop: 16, fontSize: 9.8 },
  subject: { marginTop: 22, fontWeight: 700 },
  paragraph: { marginBottom: 9, textAlign: 'justify' },
});

export function LetterPdf({ letter, cv }: { letter: CoverLetter; cv: CvDocument }) {
  const p = cv.personal;
  const name = fullName(p);
  const cityLine = [p.address, p.city, p.country].filter((x) => x.trim()).join(', ');
  const place = letter.place || p.city;
  const dateLine = [place, letter.date].filter(Boolean).join(', ');

  return (
    <Document title={`Lettre de motivation – ${name}`} author={name} creator="CV Studio">
      <Page size="A4" style={s.page}>
        <View style={s.sender}>
          <Text style={{ fontWeight: 700, fontSize: 11.5, color: letter.accent }}>{name || ' '}</Text>
          {p.title ? <Text>{p.title}</Text> : null}
          {cityLine ? <Text>{cityLine}</Text> : null}
          {p.phone ? <Text>{p.phone}</Text> : null}
          {p.email ? <Text>{p.email}</Text> : null}
        </View>

        <View style={s.recipient}>
          {letter.recipientName ? <Text style={{ fontWeight: 600 }}>{letter.recipientName}</Text> : null}
          {letter.recipientCompany ? <Text>{letter.recipientCompany}</Text> : null}
          {letter.recipientAddress
            ? letter.recipientAddress.split('\n').map((l, i) => <Text key={i}>{l}</Text>)
            : null}
        </View>

        {dateLine ? <Text style={s.date}>{dateLine}</Text> : null}

        {letter.subject ? (
          <Text style={s.subject}>
            Objet : <Text style={{ fontWeight: 400 }}>{letter.subject.replace(/^objet\s*:\s*/i, '')}</Text>
          </Text>
        ) : null}

        <View style={{ marginTop: 20 }}>
          {letter.salutation ? <Text style={{ marginBottom: 10 }}>{letter.salutation}</Text> : null}
          {letterParagraphs(letter.body).map((para, i) => (
            <Text key={i} style={s.paragraph}>
              {para}
            </Text>
          ))}
          {letter.closing ? <Text style={[s.paragraph, { marginTop: 2 }]}>{letter.closing}</Text> : null}
        </View>

        <View wrap={false} style={{ alignItems: 'flex-end', marginTop: 14 }}>
          {letter.showSignature && cv.signature ? (
            <Image src={cv.signature} style={{ height: 48, maxWidth: 170, objectFit: 'contain', marginBottom: 2 }} />
          ) : null}
          <Text style={{ fontWeight: 600 }}>{name}</Text>
        </View>
      </Page>
    </Document>
  );
}
